/**
 * d3jusdevspace — Axios API Client
 *
 * Centralised HTTP client with:
 *  - Base URL pointing at the Next.js API proxy (`/api/proxy`)
 *  - Automatic `Authorization` header injection for admin routes
 *  - Standardised error normalisation
 */

import axios, {
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";
import type { ApiError } from "@/types";
import { getSession, signOut } from "next-auth/react";

/* ============================================================================
  Configuration
============================================================================ */

const IS_BROWSER = typeof window !== "undefined";

const API_BASE_URL = IS_BROWSER
  ? "/api/proxy"
  : `${process.env.BACKEND_URL ?? "http://localhost:8000"}/api/v1`;

// Two callers, two different things to be patient about.
//
// In the browser a person is watching a spinner, so 20s is already generous —
// past that, failing is kinder than waiting.
//
// On the server the caller is a build or a background revalidation, and the
// backend may be a free instance that spins down when idle and needs the better
// part of a minute to wake. Nobody is watching that wait, and giving up on it
// turns a slow cold start into a missing page.
const TIMEOUT_MS = IS_BROWSER ? 20_000 : 90_000;

/* ============================================================================
  Client Instance
============================================================================ */

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: TIMEOUT_MS,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});


/* ============================================================================
  Request Interceptor — attach Authorization token
============================================================================ */

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // Retrieve the NextAuth session which contains our custom HS256 accessToken
    if (typeof window !== "undefined") {
      const session = await getSession();
      if (session?.accessToken && config.headers) {
        config.headers.Authorization = `Bearer ${session.accessToken}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

/* ============================================================================
  Response Interceptor — normalise errors
============================================================================ */

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ detail?: string }>) => {
    const apiError: ApiError = {
      detail:
        error.response?.data?.detail ??
        error.message ??
        "An unexpected error occurred.",
      status: error.response?.status ?? 500,
    };

    // Handle 401 globally — clear NextAuth session & redirect to login
    if (apiError.status === 401 && typeof window !== "undefined") {
      // Don't redirect if already on a public page
      if (window.location.pathname.startsWith("/admin")) {
        signOut({ callbackUrl: "/admin/login" });
      }
    }

    return Promise.reject(apiError);
  },
);

export default apiClient;
