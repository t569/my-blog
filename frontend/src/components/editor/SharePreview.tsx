"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Eye, Loader2, Check, UserPlus, MessageSquare } from "lucide-react";
import {
	adminCreatePreviewLink,
	adminDeleteComment,
	adminListSuggestions,
} from "@/services/api";
import type { Comment } from "@/types";
import CustomSelect from "@/components/ui/CustomSelect";
import { useToast } from "@/hooks/useToast";

const EXPIRY_OPTIONS = [
	{ value: "1", label: "1 hour" },
	{ value: "24", label: "24 hours" },
	{ value: "72", label: "3 days" },
	{ value: "168", label: "7 days" },
];

interface SharePreviewProps {
	postId: string;
	/** Add a suggester to the post's collaborators. */
	onCredit: (name: string) => void;
}

/** Mint expiring preview links and work through the suggestions they bring. */
export default function SharePreview({ postId, onCredit }: SharePreviewProps) {
	const [hours, setHours] = useState("72");
	const [suggest, setSuggest] = useState(true);
	const [minting, setMinting] = useState(false);
	const [suggestions, setSuggestions] = useState<Comment[]>([]);
	const toast = useToast();

	const load = () =>
		adminListSuggestions(postId)
			.then(setSuggestions)
			.catch(() => {});

	useEffect(() => {
		load();
	}, [postId]); // eslint-disable-line react-hooks/exhaustive-deps

	const share = async () => {
		setMinting(true);
		try {
			const { token, expires_at } = await adminCreatePreviewLink(postId, {
				hours: Number(hours),
				suggest,
			});
			await navigator.clipboard.writeText(
				`${window.location.origin}/preview/${token}`,
			);
			toast.success(
				`Preview link copied · expires ${format(new Date(expires_at), "MMM d, HH:mm")}`,
			);
		} catch (err: any) {
			toast.error(err?.detail || "Could not create a preview link.");
		} finally {
			setMinting(false);
		}
	};

	const dismiss = async (id: string) => {
		try {
			await adminDeleteComment(id);
			setSuggestions((prev) => prev.filter((s) => s.id !== id));
		} catch {
			toast.error("Could not dismiss the suggestion.");
		}
	};

	return (
		<div className="flex flex-col gap-3">
			<label className="font-mono text-xs font-bold uppercase tracking-widest text-text-tertiary">
				Share preview
			</label>
			<CustomSelect
				value={hours}
				onChange={(val) => setHours(val)}
				options={EXPIRY_OPTIONS}
			/>
			<label className="flex items-center gap-2 font-mono text-[0.7rem] text-text-secondary">
				<input
					type="checkbox"
					checked={suggest}
					onChange={(e) => setSuggest(e.target.checked)}
				/>
				Allow suggestions
			</label>
			<button
				type="button"
				onClick={share}
				disabled={minting}
				className="flex w-full items-center justify-center gap-2 rounded-md border border-border-default bg-transparent py-2.5 font-mono text-xs font-bold text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary"
			>
				{minting ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}
				Copy preview link
			</button>
			<p className="font-mono text-[0.6rem] text-text-tertiary">
				Shows the last saved version. Save first.
			</p>

			<div className="mt-2 flex items-center justify-between">
				<span className="flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-widest text-text-tertiary">
					<MessageSquare size={10} />
					Suggestions ({suggestions.length})
				</span>
				<button
					type="button"
					onClick={load}
					className="font-mono text-[0.65rem] text-text-tertiary hover:text-accent"
				>
					refresh
				</button>
			</div>
			{suggestions.map((s) => (
				<div
					key={s.id}
					className="flex flex-col gap-2 rounded-md border border-border-subtle bg-bg-elevated p-3"
				>
					<div className="flex justify-between font-mono text-[0.65rem] text-text-tertiary">
						<span className="font-bold text-text-primary">
							{s.display_name}
						</span>
						<span>{format(new Date(s.created_at), "MMM d, HH:mm")}</span>
					</div>
					{/* Plain text on purpose: this is reader input. */}
					<p className="whitespace-pre-wrap break-words text-xs text-text-secondary">
						{s.body}
					</p>
					<div className="flex gap-2">
						{s.display_name && (
							<button
								type="button"
								onClick={() => onCredit(s.display_name!)}
								className="btn-ghost flex h-7 flex-1 items-center justify-center gap-1 text-[0.65rem]"
								title="Add to the post's collaborators"
							>
								<UserPlus size={10} />
								Credit
							</button>
						)}
						<button
							type="button"
							onClick={() => dismiss(s.id)}
							className="btn-ghost flex h-7 flex-1 items-center justify-center gap-1 text-[0.65rem]"
						>
							<Check size={10} />
							Done
						</button>
					</div>
				</div>
			))}
		</div>
	);
}
