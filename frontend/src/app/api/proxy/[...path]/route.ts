/**
 * d3jusdevspace — API Proxy Route
 *
 * Proxies all `/api/proxy/*` requests to the FastAPI backend.
 *
 * Why proxy?
 *  1. Avoids CORS issues in development (same-origin requests).
 *  2. Allows the backend URL to remain a server-side secret.
 *  3. Provides a single place to add server-side auth header injection,
 *     request logging, or rate-limit logic in the future.
 *
 * The backend URL is read from BACKEND_URL env var (defaults to
 * http://localhost:8000 in dev). The proxy strips the `/api/proxy` prefix
 * and forwards everything after it to `${BACKEND_URL}/api/v1/...`.
 */

import { type NextRequest, NextResponse } from "next/server";

import { timeoutFor } from "@/lib/coldStart";

const BACKEND_URL =
  process.env.BACKEND_URL ?? "http://localhost:8000";

// The platform kills the function before any timeout in this file can fire, so
// the ceiling has to be raised here as well. 60s is the Vercel Hobby maximum —
// the same one src/app/api/cron/agent/route.ts is written against — and
// COLD_START_MS is set below it so the abort below is the one that bites and
// the log says which request gave up.
export const maxDuration = 60;

/**
 * Generic handler that forwards the request to the backend.
 */
async function proxyRequest(request: NextRequest): Promise<NextResponse> {
  // Strip `/api/proxy` prefix to get the target path.
  // e.g. `/api/proxy/posts?page=1` → `/api/v1/posts?page=1`
  const url = new URL(request.url);
  const targetPath = url.pathname.replace(/^\/api\/proxy/, "/api/v1");
  const targetUrl = `${BACKEND_URL}${targetPath}${url.search}`;

  // Build headers — forward everything except host.
  const headers = new Headers(request.headers);
  headers.delete("host");

  // Build fetch options.
  const init: RequestInit = {
    method: request.method,
    headers,
  };

  // Forward body for non-GET/HEAD requests.
  // Multipart form data must be forwarded as raw bytes to preserve
  // the boundary markers; regular JSON bodies use text.
  if (request.method !== "GET" && request.method !== "HEAD") {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      init.body = await request.arrayBuffer();
    } else {
      init.body = await request.text();
    }
  }

  try {
    // Public traffic fails fast; admin calls and the heartbeat wait out a cold
    // start. The rule is shared with the browser-side client in lib/coldStart.ts
    // because both ceilings apply to the same request and the shorter one wins.
    const timeoutMs = timeoutFor(targetPath);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const backendResponse = await fetch(targetUrl, {
      ...init,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    // A stream is passed through as it arrives. Reading it with `.text()` like
    // everything else would hold every event until the backend finished, so a
    // streamed reply would land in one lump at the end.
    if (backendResponse.headers.get("content-type")?.startsWith("text/event-stream")) {
      return new NextResponse(backendResponse.body, {
        status: backendResponse.status,
        headers: {
          "content-type": "text/event-stream",
          "cache-control": "no-cache, no-transform",
          "x-accel-buffering": "no",
        },
      });
    }

    const responseBody = await backendResponse.text();

    // Create a NextResponse that mirrors the backend response.
    const response = new NextResponse(responseBody, {
      status: backendResponse.status,
      statusText: backendResponse.statusText,
    });

    // Forward relevant headers from the backend.
    const forwardHeaders = [
      "content-type",
      "cache-control",
      "x-request-id",
    ];
    for (const header of forwardHeaders) {
      const value = backendResponse.headers.get(header);
      if (value) {
        response.headers.set(header, value);
      }
    }

    return response;
  } catch (error) {
    console.error("[API Proxy] Backend request failed:", error);

    // Gave up waiting and never answered are different problems with different
    // fixes — one is "try again in a moment", the other is "the backend is
    // down" — and the person reading the toast is the one who has to tell them
    // apart.
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json(
        {
          detail:
            "The backend did not answer in time — it may be waking up. Try again in a moment.",
        },
        { status: 504 },
      );
    }

    return NextResponse.json(
      { detail: "Backend service unavailable." },
      { status: 502 },
    );
  }
}

/* ── HTTP Method Handlers ── */

export async function GET(request: NextRequest) {
  return proxyRequest(request);
}

export async function POST(request: NextRequest) {
  return proxyRequest(request);
}

export async function PATCH(request: NextRequest) {
  return proxyRequest(request);
}

export async function PUT(request: NextRequest) {
  return proxyRequest(request);
}

export async function DELETE(request: NextRequest) {
  return proxyRequest(request);
}
