import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createLangGraphRuntime } from "./runtime/client";
import type { ChatMessage, LangGraphStreamEvent } from "./types";

/**
 * A plain streaming chat — the domain-free counterpart to the commerce provider.
 *
 * No proposals, no selection, no callbacks: messages in, a streamed reply out, and the backend's
 * `actionStatus` exposed raw so the host can map it to whatever its character does (resolve it
 * with `createStatusResolver`).
 */

/** What a chat backend streams: any node/status names, state that may carry a messages snapshot. */
export type ChatStreamEvent = LangGraphStreamEvent<string, string, { messages: ChatMessage[] }>;

export interface ChatState {
  messages: ChatMessage[];
  /** The last `actionStatus` the backend sent, or `idle` before any. */
  actionStatus: string;
}

export const initialChatState: ChatState = { messages: [], actionStatus: "idle" };

/**
 * Fold one stream event into the conversation. Pure, so it is the part under test.
 *
 * A `delta` extends the reply being streamed, starting one if the last turn is the user's. A
 * `state.messages` snapshot, when a backend sends one instead, replaces the list outright.
 */
export function applyChatEvent(state: ChatState, event: ChatStreamEvent): ChatState {
  let messages = state.messages;
  if (event.delta) {
    const last = messages[messages.length - 1];
    messages =
      last?.role === "assistant"
        ? [...messages.slice(0, -1), { ...last, content: last.content + event.delta }]
        : [...messages, { role: "assistant", content: event.delta }];
  } else if (event.state.messages) {
    messages = event.state.messages;
  }
  return { messages, actionStatus: event.actionStatus };
}

export interface UseAssistantStreamOptions {
  /** How many prior turns to send with each message, for a backend that keeps no thread. */
  history?: number;
  fetchImpl?: typeof fetch;
  /**
   * Every raw event, as it arrives — for whatever a host wants from the stream
   * beyond the conversation (which sources an answer drew on, say).
   */
  onEvent?: (event: ChatStreamEvent) => void;
}

export interface AssistantStream extends ChatState {
  isStreaming: boolean;
  send: (message: string) => Promise<void>;
  /** Abandon the reply in flight. What already arrived stays. */
  stop: () => void;
}

export function useAssistantStream(
  endpoint: string,
  { history = 12, fetchImpl, onEvent }: UseAssistantStreamOptions = {},
): AssistantStream {
  const runtime = useMemo(
    () => createLangGraphRuntime<ChatStreamEvent>(endpoint, fetchImpl),
    [endpoint, fetchImpl],
  );
  const [state, setState] = useState<ChatState>(initialChatState);
  const [isStreaming, setIsStreaming] = useState(false);

  const threadId = useRef<string>(crypto.randomUUID());
  const messagesRef = useRef(state.messages);
  messagesRef.current = state.messages;
  const abortRef = useRef<AbortController | null>(null);
  // Read through a ref so a new callback each render doesn't restart anything.
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const stop = useCallback(() => abortRef.current?.abort(), []);
  useEffect(() => stop, [stop]);

  const send = useCallback(
    async (message: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const prior = messagesRef.current.slice(-history);
      setState((s) => ({ ...s, messages: [...s.messages, { role: "user", content: message }] }));
      setIsStreaming(true);
      try {
        await runtime.invoke(
          { threadId: threadId.current, message, messages: prior },
          (event) => {
            onEventRef.current?.(event);
            setState((s) => applyChatEvent(s, event));
          },
          controller.signal,
        );
      } catch (err) {
        // A stop is a choice, not a failure; anything else (network gone, backend down) is one.
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setState((s) => ({ ...s, actionStatus: "failed" }));
        }
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
          setIsStreaming(false);
        }
      }
    },
    [runtime, history],
  );

  return { ...state, isStreaming, send, stop };
}
