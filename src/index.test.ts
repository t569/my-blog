import { describe, expect, it } from "vitest";
import { AVATAR_STATE_TRANSITIONS, describeAvatarStatus, resolveAvatarStatus } from "./stateMachine";
import { extractSseFrames, parseSseFrame } from "./runtime/client";
import { calculateProposalTotal } from "./components/ProposalCard";
import { buildLiveAgentHandoff } from "./context/AiAssistantProvider";
import type { LangGraphStreamEvent } from "./types";

describe("resolveAvatarStatus", () => {
  it("maps every documented transition (§6) to its avatar status", () => {
    for (const { actionStatus, avatarStatus } of AVATAR_STATE_TRANSITIONS) {
      expect(resolveAvatarStatus(actionStatus)).toBe(avatarStatus);
    }
  });

  it("falls back to 'idle' for an unrecognized backend status", () => {
    // @ts-expect-error - simulating an untrusted/malformed network payload
    expect(resolveAvatarStatus("bogus")).toBe("idle");
  });
});

describe("describeAvatarStatus", () => {
  it("returns the §6 description for every documented AvatarStatus", () => {
    for (const { avatarStatus, description } of AVATAR_STATE_TRANSITIONS) {
      expect(describeAvatarStatus(avatarStatus)).toBe(description);
    }
  });
});

describe("extractSseFrames", () => {
  it("splits complete frames from an incomplete trailing remainder", () => {
    const { frames, remainder } = extractSseFrames("data: a\n\ndata: b\n\ndata: c");
    expect(frames).toEqual(["data: a", "data: b"]);
    expect(remainder).toBe("data: c");
  });
});

describe("parseSseFrame", () => {
  it("parses a well-formed frame", () => {
    const event = parseSseFrame(
      'data: {"node":"router_llm","actionStatus":"processing","state":{}}',
      "thread-1",
    );
    expect(event).toEqual({ threadId: "thread-1", node: "router_llm", actionStatus: "processing", state: {} });
  });

  it("returns null instead of throwing on malformed JSON", () => {
    expect(parseSseFrame("data: {not json", "thread-1")).toBeNull();
  });

  it("returns null when there is no data line", () => {
    expect(parseSseFrame("event: ping", "thread-1")).toBeNull();
  });
});

describe("calculateProposalTotal", () => {
  it("sums item price times quantity across the proposal", () => {
    const item = { id: "p1", name: "Tee", price: 19.99, imageUrl: "", description: "" };
    const total = calculateProposalTotal([
      { item, quantity: 2 },
      { item: { ...item, id: "p2", price: 5 }, quantity: 3 },
    ]);
    expect(total).toBeCloseTo(54.98);
  });

  it("returns 0 for an empty proposal", () => {
    expect(calculateProposalTotal([])).toBe(0);
  });
});

describe("buildLiveAgentHandoff", () => {
  const escalatedEvent: LangGraphStreamEvent = {
    threadId: "thread-1",
    node: null,
    actionStatus: "escalated",
    state: { messages: [{ role: "user", content: "this is unacceptable" }] },
  };

  it("uses the escalation frame's own message checkpoint when present", () => {
    expect(buildLiveAgentHandoff(escalatedEvent, [{ role: "assistant", content: "stale" }])).toEqual({
      threadId: "thread-1",
      messages: [{ role: "user", content: "this is unacceptable" }],
    });
  });

  it("falls back to the last known messages when the frame omits the checkpoint", () => {
    const fallback = [{ role: "assistant", content: "last known" }];
    expect(buildLiveAgentHandoff({ ...escalatedEvent, state: {} }, fallback)).toEqual({
      threadId: "thread-1",
      messages: fallback,
    });
  });
});
