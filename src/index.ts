export type {
  Item,
  UserBehaviorEvent,
  AvatarStatus,
  AssistantConfig,
  AssistantCallbacks,
  AssistantState,
  Recommendation,
  LiveAgentHandoff,
  LangGraphNode,
  GraphActionStatus,
  LangGraphStreamEvent,
  ApprovalDecision,
  ChatMessage,
} from "./types";

export {
  AVATAR_STATE_TRANSITIONS,
  createStatusResolver,
  resolveAvatarStatus,
  describeAvatarStatus,
  type AvatarTransition,
} from "./stateMachine";

export {
  createLangGraphRuntime,
  readSseStream,
  type AnyStreamEvent,
  type LangGraphRuntime,
  type InvokePayload,
} from "./runtime/client";

/* Domain-free: a plain streaming chat, and a multi-agent run seen one agent at a time. */
export {
  useAssistantStream,
  applyChatEvent,
  initialChatState,
  type AssistantStream,
  type ChatState,
  type ChatStreamEvent,
  type UseAssistantStreamOptions,
} from "./chat";

export {
  useSwarm,
  reduceSwarm,
  initialSwarmState,
  type SwarmEvent,
  type SwarmState,
  type UseSwarmOptions,
} from "./swarm";

/* Commerce: the human-in-the-loop shopping assistant this package was first written for. */

export {
  AiAssistantProvider,
  buildLiveAgentHandoff,
  type AiAssistantProviderProps,
  type AiAssistantContextValue,
} from "./context/AiAssistantProvider";

export { useAiAssistant } from "./hooks/useAiAssistant";

export { ProposalCard, calculateProposalTotal } from "./components/ProposalCard";

export { ExplainabilityPanel } from "./components/ExplainabilityPanel";

export { Avatar } from "./components/Avatar";
