import { useAiAssistant } from "../hooks/useAiAssistant";

/**
 * Renders the "Why this?" disclosure per recommendation (§7). Uses native
 * <details>/<summary> for the toggle so no click-state has to be tracked here.
 */
export function ExplainabilityPanel() {
  const { assistantState, navigateToProduct } = useAiAssistant();
  const { recommendations } = assistantState;

  if (recommendations.length === 0) return null;

  return (
    <ul className="ai-assistant-explainability-panel">
      {recommendations.map(({ item, reason }) => (
        <li key={item.id} className="ai-assistant-recommendation">
          <img src={item.imageUrl} alt="" />
          <button type="button" className="ai-assistant-recommendation-name" onClick={() => navigateToProduct(item.id)}>
            {item.name}
          </button>
          <details className="ai-assistant-recommendation-why">
            <summary>Why this?</summary>
            <p>{reason}</p>
          </details>
        </li>
      ))}
    </ul>
  );
}
