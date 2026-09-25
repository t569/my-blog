# Changelog

## 0.2.1

- `useAssistantStream(endpoint, { onEvent })`: every raw stream event, for whatever a host
  wants beyond the conversation — e.g. which sources an answer used.

## 0.2.0: generic assistants

Additive: every 0.1 export is unchanged and still at the root.

- `useAssistantStream` / `applyChatEvent`: a plain streaming chat, stateless on the backend.
- `useSwarm` / `reduceSwarm`: one status per graph node, for animating each agent of a
  multi-agent run separately; reconnects across proxy timeouts.
- `createStatusResolver`: bring your own avatar state machine.
- `LangGraphStreamEvent` is generic over node, status and state (defaults are the commerce ones);
  events may carry a token `delta`. `InvokePayload` accepts prior `messages`.
- `readSseStream` exported; tolerates CRLF framing.
- **Fix:** `resolveAvatarStatus` returned an `Object.prototype` function for untrusted
  statuses like `"constructor"` instead of falling back to `idle`.

## 0.1.0 — extracted

First release as a standalone repository, extracted from [Quickuder](https://quickuder-1.onrender.com/)'s
shopping assistant.

- `createLangGraphRuntime`: zero-computation SSE relay to a LangGraph backend.
- Table-driven avatar state machine (`AVATAR_STATE_TRANSITIONS`, `resolveAvatarStatus`).
- `<AiAssistantProvider>` / `useAiAssistant()`, `ProposalCard`, `ExplainabilityPanel`, `Avatar`.
