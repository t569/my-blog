import { useEffect, useState } from "react";
import { readSseStream } from "./runtime/client";
import type { LangGraphStreamEvent } from "./types";

/**
 * Watching a multi-agent run: one status per graph node, so each agent can be drawn as its own
 * character with its own state.
 *
 * The stream is the same wire format as a chat. The only thing this adds is keeping `node`
 * apart instead of collapsing every event into one status.
 */

export type SwarmEvent = LangGraphStreamEvent<string, string, Record<string, unknown>>;

export interface SwarmState {
  /** node name → its latest `actionStatus`. A node absent here has not started. */
  agents: Record<string, string>;
  /** The latest status of the run as a whole — events whose `node` is null. */
  run: string;
}

export const initialSwarmState: SwarmState = { agents: {}, run: "idle" };

/** Fold one event in. Pure; replaying a run's full log from scratch reproduces its state. */
export function reduceSwarm(state: SwarmState, event: SwarmEvent): SwarmState {
  if (event.node === null) return { ...state, run: event.actionStatus };
  return { ...state, agents: { ...state.agents, [event.node]: event.actionStatus } };
}

export interface UseSwarmOptions {
  /** Run statuses after which the stream is finished and is not reopened. */
  terminal?: readonly string[];
  /** Extra request options — credentials, an auth header. */
  init?: RequestInit;
  /** Wait before reopening a stream that closed while the run was still going. */
  retryMs?: number;
}

const DEFAULT_TERMINAL = ["done", "failed"] as const;

/**
 * Follow a run's event stream, reconnecting until it reports a terminal status.
 *
 * Reconnecting is expected, not exceptional: a serverless proxy cuts long responses (Vercel
 * Hobby at 60s), and a run can outlast that. The server replays the whole log on every connect,
 * so each connection starts from `initialSwarmState` and the result is the same as if it had
 * never dropped. Pass `null` to watch nothing.
 */
export function useSwarm(url: string | null, options: UseSwarmOptions = {}): SwarmState {
  const [state, setState] = useState<SwarmState>(initialSwarmState);
  const { terminal = DEFAULT_TERMINAL, init, retryMs = 1000 } = options;

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    let cancelled = false;

    void (async () => {
      let finished = false;
      while (!cancelled && !finished) {
        let latest = initialSwarmState;
        try {
          const response = await fetch(url, { ...init, signal: controller.signal });
          if (!response.ok || !response.body) {
            // Not found or forbidden will not fix itself by asking again.
            if (response.status >= 400 && response.status < 500) {
              setState({ ...latest, run: "failed" });
              return;
            }
          } else {
            await readSseStream<SwarmEvent>(response.body, url, (event) => {
              latest = reduceSwarm(latest, event);
              setState(latest);
            });
          }
          finished = terminal.includes(latest.run);
        } catch {
          if (cancelled) return;
        }
        if (!finished && !cancelled) await new Promise((r) => setTimeout(r, retryMs));
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // `init` and `terminal` are read once per url; callers pass literals, and re-subscribing on
    // every render because an object literal is "new" would reopen the stream in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, retryMs]);

  return state;
}
