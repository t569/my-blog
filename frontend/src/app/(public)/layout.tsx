import PublicNavbar from "@/components/layout/PublicNavbar";
import PublicFooter from "@/components/layout/PublicFooter";
import AssistantMount from "@/components/assistant/AssistantMount";
import { ASSISTANT } from "@/lib/constants";

export default function PublicLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="flex min-h-screen flex-col">
			<PublicNavbar />
			<div className="flex-1">{children}</div>
			<PublicFooter />
			{ASSISTANT.enabled && <AssistantMount />}
		</div>
	);
}
