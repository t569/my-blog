import { describe, expect, it } from "vitest";
import { createStatusResolver, resolveAvatarStatus } from "./stateMachine";
import { parseSseFrame, readSseStream } from "./runtime/client";
import { applyChatEvent, initialChatState, type ChatStreamEvent } from "./chat";
import { initialSwarmState, reduceSwarm, type SwarmEvent } from "./swarm";

const ev = (over: Partial<ChatStreamEvent>): ChatStreamEvent => ({
  threadId: "t",
  node: null,
  actionStatus: "speaking",
  state: {},
  ...over,
});

describe("createStatusResolver", () => {
  const resolve = createStatusResolver(
    [
      { actionStatus: "processing", avatarStatus: "thinking" },
      { actionStatus: "speaking", avatarStatus: "speaking" },
    ],
    "idle",
  );

  it("maps table rows and falls back for anything else", () => {
    expect(resolve("processing")).toBe("thinking");
    expect(resolve("nonsense")).toBe("idle");
  });

  it("does not find Object.prototype members in an untrusted status", () => {
    // Regression: the object-literal lookup this replaced returned a function for these.
    for (const key of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
      expect(resolve(key)).toBe("idle");
      // @ts-expect-error - untrusted network input, deliberately outside the union
      expect(resolveAvatarStatus(key)).toBe("idle");
    }
  });
});

describe("parseSseFrame", () => {
  it("carries a delta through, and omits it when absent", () => {
    expect(parseSseFrame('data: {"actionStatus":"speaking","delta":"Hel"}', "t")?.delta).toBe("Hel");
    expect(parseSseFrame('data: {"actionStatus":"speaking"}', "t")).not.toHaveProperty("delta");
  });
});

describe("readSseStream", () => {
  it("reassembles frames split across chunks, including CRLF framing", async () => {
    const chunks = ['data: {"actionStatus":"proc', 'essing"}\r\n\r\ndata: {"actionStatus":"idle"}\r\n', "\r\n"];
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        for (const s of chunks) c.enqueue(new TextEncoder().encode(s));
        c.close();
      },
    });
    const seen: string[] = [];
    await readSseStream(body, "t", (e) => seen.push(e.actionStatus));
    expect(seen).toEqual(["processing", "idle"]);
  });
});

describe("applyChatEvent", () => {
  it("starts a reply after a user turn and extends it with each delta", () => {
    let s = { ...initialChatState, messages: [{ role: "user" as const, content: "hi" }] };
    s = applyChatEvent(s, ev({ delta: "Hel" }));
    s = applyChatEvent(s, ev({ delta: "lo" }));
    expect(s.messages).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", content: "Hello" },
    ]);
    expect(s.actionStatus).toBe("speaking");
  });

  it("lets a messages snapshot replace the list, and a status-only event change only the status", () => {
    const snapshot = [{ role: "assistant" as const, content: "whole" }];
    let s = applyChatEvent(initialChatState, ev({ state: { messages: snapshot } }));
    expect(s.messages).toEqual(snapshot);
    s = applyChatEvent(s, ev({ actionStatus: "idle" }));
    expect(s).toEqual({ messages: snapshot, actionStatus: "idle" });
  });
});

describe("reduceSwarm", () => {
  const e = (node: string | null, actionStatus: string): SwarmEvent => ({ threadId: "r", node, actionStatus, state: {} });

  it("tracks each agent separately and the run apart from them", () => {
    const log = [
      e(null, "running"),
      e("orchestrator", "processing"),
      e("orchestrator", "done"),
      e("research", "processing"),
      e("tone", "processing"),
      e("tone", "done"),
    ];
    const s = log.reduce(reduceSwarm, initialSwarmState);
    expect(s).toEqual({
      run: "running",
      agents: { orchestrator: "done", research: "processing", tone: "done" },
    });
  });

  it("is a pure fold, so replaying the log after a reconnect gives the same state", () => {
    const log = [e("writer", "processing"), e("writer", "failed"), e(null, "failed")];
    expect(log.reduce(reduceSwarm, initialSwarmState)).toEqual(log.reduce(reduceSwarm, initialSwarmState));
  });
});
