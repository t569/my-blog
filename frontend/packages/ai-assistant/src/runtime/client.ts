import type { ApprovalDecision, ChatMessage, LangGraphStreamEvent, UserBehaviorEvent } from "../types";

/**
 * Zero-computation LangGraph runtime adapter. This file does no reasoning, no token
 * accounting, no context management — it only relays bytes to/from `backendEndpoint`
 * over SSE and hands parsed events to the caller. All "brain" work lives remotely (§3).
 */

export interface InvokePayload {
  threadId: string;
  message?: string;
  /** Prior turns, for a stateless backend that keeps no thread of its own. */
  messages?: ChatMessage[];
  behaviorEvents?: UserBehaviorEvent[];
  approvalDecision?: ApprovalDecision;
}

/**
 * Any event shape. The parse below guarantees the four fields exist, not what they hold, so a
 * runtime typed for one graph can be told another's names.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyStreamEvent = LangGraphStreamEvent<any, any, any>;

export interface LangGraphRuntime<E extends AnyStreamEvent = LangGraphStreamEvent> {
  invoke(payload: InvokePayload, onEvent: (event: E) => void, signal?: AbortSignal): Promise<void>;
}

/** Splits a growing SSE buffer into complete `data: {...}` frames plus the unparsed remainder. */
export function extractSseFrames(buffer: string): { frames: string[]; remainder: string } {
  const parts = buffer.split("\n\n");
  const remainder = parts.pop() ?? "";
  return { frames: parts, remainder };
}

/** Parses one SSE frame into a stream event. Returns null on malformed input rather than throwing. */
export function parseSseFrame<E extends AnyStreamEvent = LangGraphStreamEvent>(
  frame: string,
  threadId: string,
): E | null {
  const dataLine = frame.split("\n").find((line) => line.startsWith("data:"));
  if (!dataLine) return null;
  try {
    const parsed = JSON.parse(dataLine.slice("data:".length).trim()) as Partial<E>;
    const event = {
      threadId: parsed.threadId ?? threadId,
      node: parsed.node ?? null,
      actionStatus: parsed.actionStatus ?? "failed",
      state: parsed.state ?? {},
    } as E;
    if (typeof parsed.delta === "string") event.delta = parsed.delta;
    return event;
  } catch {
    return null;
  }
}

/**
 * Reads an SSE body to the end, one event per complete frame.
 *
 * Split out of `invoke` so a GET stream (watching a run something else started) is read by the
 * same parser as the POST one.
 */
export async function readSseStream<E extends AnyStreamEvent = LangGraphStreamEvent>(
  body: ReadableStream<Uint8Array>,
  threadId: string,
  onEvent: (event: E) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    // The frame split is on "\n\n"; a server or proxy that emits CRLF would otherwise produce
    // one frame that never completes.
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    const { frames, remainder } = extractSseFrames(buffer);
    buffer = remainder;
    for (const frame of frames) {
      const event = parseSseFrame<E>(frame, threadId);
      if (event) onEvent(event);
    }
  }
}

export function createLangGraphRuntime<E extends AnyStreamEvent = LangGraphStreamEvent>(
  backendEndpoint: string,
  fetchImpl: typeof fetch = fetch,
): LangGraphRuntime<E> {
  return {
    async invoke(payload, onEvent, signal) {
      const response = await fetchImpl(backendEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal,
      });

      if (!response.ok || !response.body) {
        onEvent({ threadId: payload.threadId, node: null, actionStatus: "failed", state: {} } as E);
        return;
      }

      await readSseStream<E>(response.body, payload.threadId, onEvent);
    },
  };
}
