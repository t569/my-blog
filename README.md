# @t569/ai-assistant

The headless half of an animated AI assistant: a streaming client for a
LangGraph (or any SSE) backend, a table-driven state machine that turns what the
backend is doing into what the avatar should look like, and React bindings.

It renders nothing opinionated. Your app decides what the character looks like;
this package decides *when* it is thinking, speaking or waiting on you. Pair it
with [`@t569/scene-engine`](https://github.com/t569/scene-engine)'s `character`
plugin for a face that moves.

## Install

```bash
npm install github:t569/ai-assistant        # or copy it in with git subtree
```

Peer dependency: `react >= 18`. No other runtime dependencies.

## The pieces

Two shapes of assistant share one runtime and one wire format.

### Generic: any assistant

| Export | What it does |
|---|---|
| `useAssistantStream(endpoint, { history? })` | A streaming chat: `{ messages, actionStatus, isStreaming, send, stop }`. Sends the last `history` turns with each message, so the backend can stay stateless. |
| `useSwarm(url, { terminal?, init? })` | Follows a multi-agent run: `{ agents: { [node]: status }, run }`, one status per graph node, so each agent can be drawn as its own character. Reconnects until the run is terminal; expects the server to replay its log on each connect. |
| `createStatusResolver(table, fallback)` | Your own state machine: backend `actionStatus` → your avatar vocabulary (`thinking`, `speaking`, `sleeping`…). Unknown input falls back. |
| `applyChatEvent`, `reduceSwarm` | The pure folds behind the two hooks, for non-React hosts and for tests. |
| `createLangGraphRuntime(endpoint, fetch?)` | POSTs `{ threadId, message?, messages?, … }` and hands you one event per SSE frame. Malformed frames are dropped, never thrown. |
| `readSseStream(body, id, onEvent)` | The frame reader on its own, for a GET stream. |

```tsx
const resolve = createStatusResolver(
  [
    { actionStatus: "processing", avatarStatus: "thinking" },
    { actionStatus: "speaking", avatarStatus: "speaking" },
    { actionStatus: "failed", avatarStatus: "error" },
  ],
  "idle",
);

function Chat() {
  const { messages, actionStatus, send } = useAssistantStream("/api/assistant/chat");
  const mood = resolve(actionStatus);        // drive your character with this
  // …render messages, call send(text)
}
```

### Commerce: the shopping assistant it was first built for

| Export | What it does |
|---|---|
| `<AiAssistantProvider>` / `useAiAssistant()` | Messages, recommendations, a human-in-the-loop proposal to approve or reject, and host callbacks for every side effect. |
| `AVATAR_STATE_TRANSITIONS`, `resolveAvatarStatus`, `describeAvatarStatus` | The commerce state machine as a table, its resolver and its accessible labels. |
| `ProposalCard`, `ExplainabilityPanel`, `Avatar` | Minimal UI for the above. `Avatar` is only class names and data attributes to hang your own animation on. |

### Wire format

Each SSE frame is one JSON object:

```json
data: {"threadId":"…","node":"router_llm","actionStatus":"processing","state":{"messages":[…]}}
```

`node` says which graph node emitted it (or `null`), `actionStatus` which phase
the run is in, and `state` is a partial snapshot merged into the client's copy.
A chat backend that streams tokens adds `"delta": "…"`, which extends the reply
instead of resending it. The frontend never computes any of this, it only relays it.

## Design rules

- **Black box.** Nothing here imports host code. Every side effect (commit an
  item, navigate, escalate to a human) is a callback the host implements.
- **Zero computation.** The runtime relays bytes. Reasoning, memory and token
  budgets live on the backend.
- **Deterministic avatar.** The avatar's state is *derived* from stream events
  through one table. Nothing sets it directly, so it can't drift.

Full specification: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
Backend memory design: [`docs/memory-condensation-service.md`](docs/memory-condensation-service.md).

## Development

```bash
npm install
npm test            # vitest
npm run typecheck
npm run build       # → dist/
```

## Origin

Written for [Quickuder](https://quickuder-1.onrender.com/)'s shopping
assistant, then extracted when a second consumer (a blog mascot and agent-swarm
view) justified making it generic. MIT.
