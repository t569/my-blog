/**
 * Boundary contract between the host app and @t569/ai-assistant.
 * Nothing in this package may import host code; every interaction with the
 * host crosses this file's types. See specifications_and_architecture.md §5.
 */

export interface Item {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  description: string;
}

export interface UserBehaviorEvent {
  eventType: "product_view" | "category_dwell" | "cart_abandonment";
  payload: {
    targetId: string;
    durationMs?: number;
    metadata?: Record<string, string | number | boolean>;
  };
}

/** Frontend-facing animation state. Deterministically derived, never set directly. */
export type AvatarStatus = "idle" | "thinking" | "awaiting_approval" | "syncing" | "error" | "escalated";

export interface AssistantConfig {
  avatarStyle: "techwear" | "streetwear" | "cyberpunk";
  backendEndpoint: string;
}

/** Conversation history handed off when a sentiment flag escalates the thread to a human agent (§7). */
export interface LiveAgentHandoff {
  threadId: string;
  messages: Array<{ role: string; content: string }>;
}

/** The core contract between the library and the host app. Library calls out; host implements. */
export interface AssistantCallbacks {
  onCommitItem: (item: Item, quantity: number) => Promise<boolean>;
  onAddToWishlist: (item: Item) => Promise<boolean>;
  onApplyPromoCode: (code: string) => Promise<{ success: boolean; discount: number }>;
  onNavigateToProduct: (productId: string) => void;
  onBehaviorUpdate: (event: UserBehaviorEvent) => void;
  onEscalateToLiveAgent: (handoff: LiveAgentHandoff) => void;
}

/** A suggested item plus the backend's stated reasoning, for the "Why this?" panel (§7). */
export interface Recommendation {
  item: Item;
  reason: string;
}

/** Core state properties tracked by the library, mirroring the LangGraph checkpoint. */
export interface AssistantState {
  messages: Array<{ role: string; content: string }>;
  selection: Array<{ item: Item; quantity: number }>;
  recommendations: Recommendation[];
  action_status: "idle" | "awaiting_shopper_approval" | "approved" | "rejected";
}

/** The 5 backend nodes the frontend must be able to attribute a stream event to (§4). */
export type LangGraphNode =
  | "router_llm"
  | "prepare_proposal"
  | "apply_changes"
  | "sync_ui_state"
  | "general_response";

/**
 * Status vocabulary emitted per stream event to drive the Avatar State Machine (§6).
 * Distinct from AssistantState.action_status: that field tracks selection-proposal approval,
 * this one tracks graph execution phase for animation purposes.
 */
export type GraphActionStatus = "idle" | "processing" | "awaiting_shopper_approval" | "syncing" | "failed" | "escalated";

/**
 * A single event decoded off the LangGraph stream. The frontend never computes this, only relays it.
 *
 * Generic so a host whose graph is not the commerce one can name its own nodes, statuses and
 * state; the defaults are the commerce contract, so existing code reads exactly as before.
 */
export interface LangGraphStreamEvent<
  N extends string = LangGraphNode,
  A extends string = GraphActionStatus,
  S = AssistantState,
> {
  threadId: string;
  node: N | null;
  actionStatus: A;
  state: Partial<S>;
  /**
   * Text to append to the reply being streamed, when the backend streams tokens.
   * Carried beside `state` rather than inside it because re-sending the whole reply per token
   * is quadratic in its length.
   */
  delta?: string;
}

/** One turn of a plain conversation. */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** Approval decision for a proposal parked at `prepare_proposal` awaiting HITL input. */
export type ApprovalDecision = "approved" | "rejected";
