import { createContext, useCallback, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import { resolveAvatarStatus } from "../stateMachine";
import { createLangGraphRuntime } from "../runtime/client";
import type {
  AssistantCallbacks,
  AssistantConfig,
  AssistantState,
  AvatarStatus,
  LangGraphStreamEvent,
  LiveAgentHandoff,
  Item,
  UserBehaviorEvent,
} from "../types";

const initialAssistantState: AssistantState = { messages: [], selection: [], recommendations: [], action_status: "idle" };

/** Pure so it's testable without a DOM renderer. Falls back to `fallbackMessages` when the escalation frame omits the checkpoint. */
export function buildLiveAgentHandoff(
  event: LangGraphStreamEvent,
  fallbackMessages: AssistantState["messages"],
): LiveAgentHandoff {
  return { threadId: event.threadId, messages: event.state.messages ?? fallbackMessages };
}

interface InternalState {
  threadId: string;
  assistantState: AssistantState;
  avatarStatus: AvatarStatus;
  pendingProposal: AssistantState["selection"] | null;
  isStreaming: boolean;
}

type Action =
  | { type: "STREAM_START" }
  | { type: "STREAM_END" }
  | { type: "STREAM_EVENT"; event: LangGraphStreamEvent };

function reducer(state: InternalState, action: Action): InternalState {
  switch (action.type) {
    case "STREAM_START":
      return { ...state, isStreaming: true };
    case "STREAM_END":
      return { ...state, isStreaming: false };
    case "STREAM_EVENT": {
      const { event } = action;
      const avatarStatus = resolveAvatarStatus(event.actionStatus);
      const assistantState = { ...state.assistantState, ...event.state };
      const pendingProposal =
        event.actionStatus === "awaiting_shopper_approval" && event.state.selection
          ? event.state.selection
          : avatarStatus === "idle" || avatarStatus === "error"
            ? null
            : state.pendingProposal;
      return { ...state, assistantState, avatarStatus, pendingProposal };
    }
    default:
      return state;
  }
}

export interface AiAssistantContextValue {
  config: AssistantConfig;
  assistantState: AssistantState;
  avatarStatus: AvatarStatus;
  pendingProposal: AssistantState["selection"] | null;
  isStreaming: boolean;
  sendMessage: (message: string) => Promise<void>;
  trackBehaviorEvent: (event: UserBehaviorEvent) => void;
  approveProposal: () => Promise<void>;
  rejectProposal: () => Promise<void>;
  navigateToProduct: (productId: string) => void;
  addToWishlist: (item: Item) => Promise<boolean>;
  applyPromoCode: (code: string) => Promise<{ success: boolean; discount: number }>;
}

export const AiAssistantContext = createContext<AiAssistantContextValue | null>(null);

export interface AiAssistantProviderProps {
  config: AssistantConfig;
  callbacks: AssistantCallbacks;
  children: ReactNode;
}

export function AiAssistantProvider({ config, callbacks, children }: AiAssistantProviderProps) {
  const [state, dispatch] = useReducer(reducer, {
    threadId: crypto.randomUUID(),
    assistantState: initialAssistantState,
    avatarStatus: "idle",
    pendingProposal: null,
    isStreaming: false,
  });

  const callbacksRef = useRef(callbacks);
  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  const pendingProposalRef = useRef<AssistantState["selection"] | null>(null);
  useEffect(() => {
    pendingProposalRef.current = state.pendingProposal;
  }, [state.pendingProposal]);

  const assistantStateRef = useRef(state.assistantState);
  useEffect(() => {
    assistantStateRef.current = state.assistantState;
  }, [state.assistantState]);

  const behaviorBufferRef = useRef<UserBehaviorEvent[]>([]);

  const runtime = useMemo(() => createLangGraphRuntime(config.backendEndpoint), [config.backendEndpoint]);

  // `apply_changes` confirms the backend committed the proposal; the library never
  // touches the host's selection directly, it only requests the mutation via onCommitItem (§8).
  const onEvent = useCallback((event: LangGraphStreamEvent) => {
    dispatch({ type: "STREAM_EVENT", event });
    if (event.actionStatus === "syncing" && pendingProposalRef.current) {
      for (const { item, quantity } of pendingProposalRef.current) {
        void callbacksRef.current.onCommitItem(item, quantity);
      }
    }
    if (event.actionStatus === "escalated") {
      callbacksRef.current.onEscalateToLiveAgent(buildLiveAgentHandoff(event, assistantStateRef.current.messages));
    }
  }, []);

  const invoke = useCallback(
    async (extra: { message?: string; approvalDecision?: "approved" | "rejected" }) => {
      const behaviorEvents = behaviorBufferRef.current.splice(0, behaviorBufferRef.current.length);
      dispatch({ type: "STREAM_START" });
      try {
        await runtime.invoke({ threadId: state.threadId, behaviorEvents, ...extra }, onEvent);
      } finally {
        dispatch({ type: "STREAM_END" });
      }
    },
    [runtime, state.threadId, onEvent],
  );

  const sendMessage = useCallback((message: string) => invoke({ message }), [invoke]);
  const approveProposal = useCallback(() => invoke({ approvalDecision: "approved" }), [invoke]);
  const rejectProposal = useCallback(() => invoke({ approvalDecision: "rejected" }), [invoke]);

  const trackBehaviorEvent = useCallback((event: UserBehaviorEvent) => {
    behaviorBufferRef.current.push(event);
    callbacksRef.current.onBehaviorUpdate(event);
  }, []);

  const navigateToProduct = useCallback((productId: string) => {
    callbacksRef.current.onNavigateToProduct(productId);
  }, []);

  const addToWishlist = useCallback((item: Item) => callbacksRef.current.onAddToWishlist(item), []);
  const applyPromoCode = useCallback((code: string) => callbacksRef.current.onApplyPromoCode(code), []);

  const value = useMemo<AiAssistantContextValue>(
    () => ({
      config,
      assistantState: state.assistantState,
      avatarStatus: state.avatarStatus,
      pendingProposal: state.pendingProposal,
      isStreaming: state.isStreaming,
      sendMessage,
      trackBehaviorEvent,
      approveProposal,
      rejectProposal,
      navigateToProduct,
      addToWishlist,
      applyPromoCode,
    }),
    [config, state, sendMessage, trackBehaviorEvent, approveProposal, rejectProposal, navigateToProduct, addToWishlist, applyPromoCode],
  );

  return <AiAssistantContext.Provider value={value}>{children}</AiAssistantContext.Provider>;
}
