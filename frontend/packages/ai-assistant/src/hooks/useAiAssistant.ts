import { useContext } from "react";
import { AiAssistantContext, type AiAssistantContextValue } from "../context/AiAssistantProvider";

export function useAiAssistant(): AiAssistantContextValue {
  const context = useContext(AiAssistantContext);
  if (!context) {
    throw new Error("useAiAssistant must be used within <AiAssistantProvider>");
  }
  return context;
}
