import { useAiAssistant } from "../hooks/useAiAssistant";
import type { AssistantState } from "../types";

/** Pure so it's testable without a DOM renderer. */
export function calculateProposalTotal(proposal: AssistantState["selection"]): number {
  return proposal.reduce((sum, { item, quantity }) => sum + item.price * quantity, 0);
}

/**
 * Renders the HITL approval gate described in §7: intercepts `awaiting_approval`
 * and blocks on an explicit Finalize/Reject click before `apply_changes` may run.
 */
export function ProposalCard() {
  const { avatarStatus, pendingProposal, isStreaming, approveProposal, rejectProposal } = useAiAssistant();

  if (avatarStatus !== "awaiting_approval" || !pendingProposal) return null;

  const total = calculateProposalTotal(pendingProposal);

  return (
    <div className="ai-assistant-proposal-card" role="dialog" aria-label="Proposed selection changes">
      <ul className="ai-assistant-proposal-items">
        {pendingProposal.map(({ item, quantity }) => (
          <li key={item.id} className="ai-assistant-proposal-item">
            <img src={item.imageUrl} alt="" />
            <span className="ai-assistant-proposal-item-name">{item.name}</span>
            <span className="ai-assistant-proposal-item-qty">x{quantity}</span>
            <span className="ai-assistant-proposal-item-price">${(item.price * quantity).toFixed(2)}</span>
          </li>
        ))}
      </ul>
      <div className="ai-assistant-proposal-total">Total: ${total.toFixed(2)}</div>
      <div className="ai-assistant-proposal-actions">
        <button type="button" className="ai-assistant-proposal-reject" disabled={isStreaming} onClick={() => void rejectProposal()}>
          Reject
        </button>
        <button type="button" className="ai-assistant-proposal-confirm" disabled={isStreaming} onClick={() => void approveProposal()}>
          Finalize Purchase
        </button>
      </div>
    </div>
  );
}
