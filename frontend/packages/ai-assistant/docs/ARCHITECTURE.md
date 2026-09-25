# Specifications & Architecture: @t569/ai-assistant

## 1. System Architecture & Philosophy
The `@t569/ai-assistant` is a production-grade, framework-agnostic UI and state library first built for [Quickuder](https://quickuder-1.onrender.com/). It manages an AI avatar shopping assistant utilizing a Human-in-the-Loop (HITL) progressive autonomy model, where the AI handles recommendations but delegates sensitive cart or financial modifications to human approval.

To maintain a scalable and secure ecosystem, the library operates as a strict "black box." It is completely decoupled from the host's internal routing and state management. All interactions with the core e-commerce engine occur through explicit, heavily typed TypeScript callbacks.

## 2. Adaptive Behavior & Pattern Learning
To ensure the assistant dynamically adapts to shifting customer behavior without micro-managing state on the client, the system implements an isolated feedback loop:
* **Behavior Event Telemetry:** The host application stream-injects continuous user interactions (e.g., categories viewed, dwell time, abandoned options) via the `onBehaviorUpdate` hook.
* **Semantic Memory Compaction:** Rather than keeping raw history buffers that bloat agent context tokens, behavioral logs are offloaded to an external contextual profile service via the LangGraph state channel. This compiles a compact semantic representation of user preferences.
* **Dynamic Promo Triggering:** The backend utilizes this condensed behavioral vector to dynamically alter node paths—generating specialized, hyper-targeted promotional offers when a repetitive abandonment pattern is identified.

## 3. Resource Optimization & Lean Agent Design
To prevent runtime bloat, conserve device memory, and protect client-side battery and processing power, the library enforces a zero-computation frontend runtime:
* **Offloaded State & Execution:** 100% of LLM reasoning, token manipulation, tool matching, and vector arithmetic is executed remotely over the LangGraph API. The frontend only maintains primitive UI mappings.
* **Context Condensation Service:** To avoid multi-megabyte context window costs and high token processing latency, the agent utilizes a specialized external memory compaction API (e.g., LangMem or an external long-term vector store) to condense historical context down to high-density semantic insights before execution loops.
* **Asset Optimization:** Character transitions and animation triggers are managed via a lightweight, pre-compiled state machine engine, bypassing complex real-time geometric engines on the device.

## 4. LangGraph Backend Integration
The library acts as the visual frontend ("body") reacting to state changes dictated by the remote LangGraph backend ("brain"). The LangGraph implementation must utilize built-in persistence to pause execution safely, wait for human input, and resume. 

The backend architecture consists of 5 essential nodes that the frontend library must track:
1.  **`router_llm`**: Receives input and routes to standard Q&A or cart modification.
2.  **`prepare_proposal`**: Extracts intended actions and sets the state to `awaiting_shopper_approval`, triggering a backend interrupt.
3.  **`apply_changes`**: Executes only after shopper approval, modifying the live cart.
4.  **`sync_ui_state`**: Generates a confirmation response and resets the status to `idle`.
5.  **`general_response`**: Handles standard product queries without pausing execution.

## 5. State Boundary Contract
The assistant communicates exclusively through a rigid boundary layer. The host injects the environment state, and the library emits side effects via lifecycle callbacks.

```typescript
export interface Item {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  description: string;
}

export interface UserBehaviorEvent {
  eventType: 'product_view' | 'category_dwell' | 'cart_abandonment';
  payload: {
    targetId: string;
    durationMs?: number;
    metadata?: Record<string, any>;
  };
}

export type AvatarStatus = 'idle' | 'thinking' | 'awaiting_approval' | 'syncing' | 'error' | 'escalated';

export interface AssistantConfig {
  avatarStyle: 'techwear' | 'streetwear' | 'cyberpunk';
  backendEndpoint: string;
}

export interface Recommendation {
  item: Item;
  reason: string;
}

export interface LiveAgentHandoff {
  threadId: string;
  messages: Array<{ role: string; content: string }>;
}

// The core contract between the Library and the host
export interface AssistantCallbacks {
  onCommitItem: (item: Item, quantity: number) => Promise<boolean>;
  onAddToWishlist: (item: Item) => Promise<boolean>;
  onApplyPromoCode: (code: string) => Promise<{ success: boolean; discount: number }>;
  onNavigateToProduct: (productId: string) => void;
  onBehaviorUpdate: (event: UserBehaviorEvent) => void;
  onEscalateToLiveAgent: (handoff: LiveAgentHandoff) => void;
}

// Core state properties tracked by the library, mirroring LangGraph
export interface AssistantState {
  messages: Array<{ role: string; content: string }>;
  selection: Array<{ item: Item; quantity: number }>;
  recommendations: Recommendation[];
  action_status: "idle" | "awaiting_shopper_approval" | "approved" | "rejected";
}
```

## 6. The Avatar State Machine & Transitions
The avatar UI component must react deterministically to the `action_status` updates received from the LangGraph thread. 

| LangGraph Current Node | `action_status` Payload | Library `AvatarStatus` | Expected Visual/Animation State |
| :--- | :--- | :--- | :--- |
| *None (Awaiting Input)* | `"idle"` | `'idle'` | Ambient breathing animation loop. |
| `router_llm` | `"processing"` | `'thinking'` | Micro-expressions indicating analysis (e.g., searching, chin tap). |
| `prepare_proposal` | `"awaiting_shopper_approval"` | `'awaiting_approval'` | Avatar physically presents a modal or proposed selection to the user. |
| `apply_changes` | `"syncing"` | `'syncing'` | Affirmative reaction (e.g., thumbs up) while the callback resolves. |
| *Network Exception* | `"failed"` | `'error'` | Confused or apologetic gesture loop. |
| *Sentiment Escalation* | `"escalated"` | `'escalated'` | Handing off to a live human agent; conversation history travels via `onEscalateToLiveAgent`. |

## 7. Generative UI & Component Slots
* **Visual Carts & Proposals:** When the graph hits a breakpoint at `prepare_proposal`, the API response returns `awaiting_shopper_approval` alongside the proposed items. The UI must intercept this status to display an interactive visual modal rather than plain text, requiring the user to click a "Finalize Purchase" or "Confirm" button.
* **Explainability:** The UI must support rendering contextual "Why this?" buttons alongside recommendations, empowering users to view the logic behind specific product suggestions.
* **Live Chat Handoff:** The library must implement a smooth transition protocol. If sentiment flags trigger an escalation, the UI transitions to a live agent, ensuring conversation history travels with the ticket.

## 8. React & React Native Integration
* **Context Preservation:** The library must export an `<AiAssistantProvider>` to encapsulate its own state management, thread history, and active animation tracking across both React (web) and React Native (mobile) environments.
* **Navigation Isolation:** When a user interacts with an AI-recommended product link, the library must strictly fire `onNavigateToProduct`. It must not manage route stacks internally to ensure the host application maintains an unbroken navigation back-stack.

---

## 9. CLAUDE.md Maintenance & Project Auditing Guide
To ensure continuous integration and structured maintenance, the root `CLAUDE.md` must be created or updated with the following guidelines. This allows Claude to remember build instructions, test commands, code style constraints, and how to verify compliance during iterative edits.

```markdown
# CLAUDE.md - @t569/ai-assistant Runbook

## Core Commands
* **Build Library:** `pnpm --filter @t569/ai-assistant build`
* **Run Tests:** `pnpm --filter @t569/ai-assistant test`
* **Lint Code:** `pnpm --filter @t569/ai-assistant lint`
* **Typecheck:** `pnpm --filter @t569/ai-assistant typecheck`

## Architecture & Code Style Constraints
1. **Strict Agnosticism:** Never import modules from outside the package boundary (`packages/ai-assistant`). External mutations must always pass through `AssistantCallbacks`.
2. **State Syncing:** Local state machine updates must map 1:1 to LangGraph `action_status` states.
3. **Typing Rule:** Zero `any` usage. All payload data definitions must fully resolve down to primitive strings, numbers, or explicit models (`Item`, etc.).
4. **Animation Handling:** Animation transitions must occur seamlessly using a state-to-morphing function layer. Do not mix structural state logic inside animation component definitions.

## Project Auditing Checklists
When changing or adding custom behaviors:
- [ ] Run type-checking to verify that the `AssistantCallbacks` contract remains unbroken.
- [ ] Ensure any new node transition updates the discrete `AvatarStatus` mapping inside the State Machine matrix.
- [ ] Verify that UI navigation actions continue to fire `onNavigateToProduct` rather than directly appending to history chains.
```

---

## 10. Project Progress & Roadmap Tracker
This section tracks implementation phases. Progress can be cross-compiled or manually checked off as components transition from definition to production.

- [x] **Phase 1: Core Type Contract & Workspace Setup**
  - [x] Initialize workspace environment under `ai-assistant/` (standalone `npm` package, not a pnpm monorepo — no pnpm workspace exists in this repo yet).
  - [x] Bind all `AssistantCallbacks` and `Item` TypeScript definitions (renamed from `Product` — see §11.1).
  - [x] Configure package-local `build`/`typecheck`/`test`/`lint` scripts.
- [ ] **Phase 2: LangGraph Connector & Contextual Core**
  - [x] Write SSE/Streaming adapter to consume LangGraph thread steps (`src/runtime/client.ts`).
  - [x] Implement `onBehaviorUpdate` event telemetry pipes to stream user activity (`trackBehaviorEvent` in `AiAssistantProvider`).
  - [ ] Integrate external long-term memory condensation API to avoid bloated agent token states (lives on the backend, outside this package's boundary). Design: [`docs/memory-condensation-service.md`](./docs/memory-condensation-service.md) — blocked on the open questions listed there (backend hosting, stable shopper identity across sessions).
- [ ] **Phase 3: State Machine & Avatar Animation Layer**
  - [x] Map `action_status` updates directly to `AvatarStatus` transitions (`src/stateMachine.ts`).
  - [x] Establish deterministic layout morphing routines for React web views (`src/components/Avatar.tsx` maps `AvatarStatus`+`avatarStyle` to class/data-attribute hooks; React Native variant deferred, no RN host exists in this repo yet).
- [ ] **Phase 4: Generative UI Component Matrix**
  - [x] Complete proposal checkout cards with manual shopper approval gates (`src/components/ProposalCard.tsx`).
  - [x] Finalize "Why this?" contextual explainability panel rendering (`src/components/ExplainabilityPanel.tsx`).
  - [x] Implement live chat handoff logic (`escalated` status added to `GraphActionStatus`/`AvatarStatus`; `AiAssistantProvider` fires `onEscalateToLiveAgent` with the conversation history via `buildLiveAgentHandoff`).

---

## 11. Open Design Questions

### 11.1 Generalizing beyond e-commerce

Decision made 2026-07-02: aim for a fully generic, publishable package rather
than a single-app one. That's a two-tier change, not one:

- **Tier 1 — rename to vertical-neutral terms, keep the shape. DONE.**
  `Product` → `Item` (id/name/price/imageUrl/description still fits retail,
  food ordering, ticketing — anything with a priced, browsable unit),
  `AssistantState.cart` → `AssistantState.selection`, `onAddToCart` →
  `onCommitItem`, `Recommendation.product` → `Recommendation.item`. No new
  abstraction, no behavior change — ships something usable outside
  the original app immediately for any "browse → propose → approve → commit"
  vertical. `onNavigateToProduct`/`onAddToWishlist`/`onApplyPromoCode` were
  left as-is (not part of the agreed rename; still e-commerce-flavored
  naming for a callback that's really domain-agnostic under the hood).
- **Tier 2 — parameterize over the domain entirely** (`AiAssistantProvider<TItem,
  TAction>`, no built-in notion of "selection" or "price" at all) so the
  package fits verticals that aren't item/selection-shaped (a scheduling
  assistant, a support bot). This is the "usable for anything" bar, but
  there is no second consumer today to validate the abstraction against —
  building it now risks the classic mistake of guessing a generic shape
  from a single real use case and getting it wrong (an interface with one
  implementation). **Still deferred** until a real second consumer exists.

### 11.2 Character animation sourcing (tradeoffs, no pick made)

| Option | Effort | Fidelity | New runtime dep | Notes |
|---|---|---|---|---|
| Lottie (After Effects → JSON) | Needs a motion designer per pose/transition | Highest | `lottie-react` (small) | Best if a designer is already on the project; each `AvatarStatus` needs its own exported clip |
| Rive | Needs someone to learn Rive's editor | High, interactive | `@rive-app/react-canvas` | Rive's own state machine could replace/duplicate `src/stateMachine.ts` — would need a decision on which owns the transition logic |
| Sprite sheet / CSS keyframes | Lowest — can be AI-generated or hand-drawn stills | Lowest (frame-swap, no interpolation) | None | Fits today's `Avatar.tsx` design directly: it already just emits a `data-avatar-status` class hook, so this is a CSS-only addition, no component change |
| 3D (Three.js / Spline) | Highest (rigging, a 3D artist) | Highest production value | `three`/`@react-three/fiber` | Matches the "techwear/streetwear/cyberpunk" avatar styles best aesthetically but is the most expensive path by far |

No dependency has been added for any of these — `Avatar.tsx` only emits
class/data-attribute hooks today, so whichever is picked plugs in without
changing the component's contract. The sprite/CSS route is the only one
with zero new dependency and no new skill requirement, consistent with this
package's "zero-computation frontend" philosophy (§3) — worth defaulting to
it unless production visual quality is a hard requirement now.
