import { useAiAssistant } from "../hooks/useAiAssistant";
import { describeAvatarStatus } from "../stateMachine";

/**
 * The avatar's own rendering is just a deterministic state->className mapping (§3's
 * "pre-compiled state machine, bypassing complex real-time geometric engines"). The
 * actual sprite/animation/model per `avatarStyle`+`AvatarStatus` combination is the
 * host's CSS/Lottie/whatever to attach via these class and data-attribute hooks.
 */
export function Avatar() {
  const { avatarStatus, config } = useAiAssistant();

  return (
    <div
      className={`ai-assistant-avatar ai-assistant-avatar--${config.avatarStyle} ai-assistant-avatar--${avatarStatus}`}
      data-avatar-style={config.avatarStyle}
      data-avatar-status={avatarStatus}
      role="img"
      aria-label={describeAvatarStatus(avatarStatus)}
    />
  );
}
