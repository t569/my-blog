# Memory Condensation Service (design doc)

Backend design for Phase 2's last open item: "integrate external long-term
memory condensation API to avoid bloated agent token states." This lives
entirely outside the `ai-assistant` package boundary (it's server-side, part
of the LangGraph "brain," not the frontend "body") — this doc exists so the
work is specified even though hosting for it isn't decided yet (see
[Open Questions](#open-questions)).

## Problem

`onBehaviorUpdate`/`trackBehaviorEvent` already streams raw `UserBehaviorEvent`s
to the backend on every `invoke()` call (`src/context/AiAssistantProvider.tsx`).
Left unprocessed, a long session accumulates hundreds of raw events, and every
`router_llm` turn would need to re-read that whole log to know the shopper's
preferences — token cost and latency both scale with session length. The fix
is to condense the raw log into a small, stable "profile" that's read (not
recomputed) on every turn.

## Contract with the frontend (already shipped, no change needed)

- Request: `POST {backendEndpoint}` body includes `behaviorEvents: UserBehaviorEvent[]`
  — only the events accumulated since the last `invoke()` (`AiAssistantProvider`
  drains `behaviorBufferRef` on send). The backend is responsible for
  accumulating these across turns; the client never resends history.
- The client does not read or display the profile. It's backend-internal.

## Proposed pipeline

1. **Ingest** — each `invoke()` call appends its `behaviorEvents` to a
   per-thread raw event buffer (keyed by `threadId`, or better, the
   authenticated shopper id if threads don't outlive a session).
2. **Condense trigger** — once the buffer passes a size threshold (e.g. 20
   events) or the thread goes idle, run a condensation pass. Don't condense
   on every turn — that reintroduces the latency/cost problem this is meant
   to solve.
3. **Condense** — a cheap/fast model call (e.g. Haiku-class) turns the raw
   buffer into a compact structured summary, merged with the shopper's
   existing profile rather than replacing it wholesale:
   ```json
   {
     "preferredCategories": ["streetwear", "outerwear"],
     "priceSensitivity": "discount-driven",
     "abandonmentPatterns": ["adds hoodies, drops at checkout when no promo code applied"]
   }
   ```
4. **Store** — persist the profile keyed by shopper id. This does not need a
   vector DB by default: it's one small JSON document per shopper, so a row
   in whatever relational store the backend already has works. A vector
   store only earns its keep if/when profiles need semantic similarity
   search (e.g. "shoppers like this one") rather than a keyed lookup.
5. **Read** — `router_llm` fetches the shopper's condensed profile (not the
   raw event log) and injects it into its prompt context on every turn. The
   raw buffer from step 1 can be trimmed/discarded once condensed.
6. **Feed Dynamic Promo Triggering** (spec §2) — the same profile is what a
   decision node reads to detect a repeated-abandonment pattern and route to
   a promo-generation path instead of `general_response`.

## Build vs. buy

| Option | What it is | Tradeoff |
|---|---|---|
| Roll your own (steps above) | A cron/queue job + a summarization prompt + a JSON column | Full control, ~a day of work, no new infra if the backend already has a DB/queue |
| [LangMem](https://langchain-ai.github.io/langmem/) | LangChain's memory library, built for exactly this (semantic + episodic memory extraction) | Less code to write, but adds a dependency and its own opinions about memory shape |
| Managed LangGraph Platform memory | If the backend ends up hosted on LangGraph Platform | Only relevant once the hosting question below is answered |

Given no consumer of this exists yet, start with the roll-your-own path —
it's the smallest thing that satisfies the contract above, and can be
swapped for LangMem later without the frontend ever knowing (the frontend
only ever sees the resulting `router_llm` behavior, never the profile
itself).

## Open questions

These block turning this doc into a ticket:

1. **Where does the LangGraph backend run at all?** Nothing hosts it
   yet. Until
   that's decided, "store a JSON profile" can't be pinned to a concrete
   table/service.
2. **What identifies a shopper across sessions?** `threadId` today is a
   fresh `crypto.randomUUID()` per provider mount (`AiAssistantProvider.tsx`)
   — it does not survive a page reload or identify a logged-in user across
   devices. Condensation needs a stable key; the natural choice is the
   authenticated user id from the host's existing session, passed to the
   LangGraph backend some way not yet defined.
3. **Condensation trigger policy** — event-count threshold, idle-timeout, or
   both? Affects cost (more frequent = more summarization calls) vs.
   freshness (less frequent = stale profile mid-session).
