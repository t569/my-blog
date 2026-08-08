"use client";

import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { useAdminFeatures, useAdminUpdateFeatures } from "@/hooks/useApi";
import { useToast } from "@/hooks/useToast";
import type { FeatureState } from "@/types";

/**
 * Two different reasons a feature isn't running, kept visibly apart:
 *
 *   unavailable — the deployment can't do it (no credentials). Only a deploy
 *                 fixes that, so the switch is disabled and says what's missing.
 *   off         — it can, and you said no. That's the switch.
 *
 * Everything a feature drags with it is listed on its own card, because those
 * parts have no separate switch: the agent's schedule, its manual trigger and
 * its drafts all stop together, and offering three switches would let you ask
 * for states the backend can't honour.
 */
function FeatureCard({
	feature,
	onToggle,
	saving,
}: {
	feature: FeatureState;
	onToggle: (enabled: boolean) => void;
	saving: boolean;
}) {
	const live = feature.available && feature.enabled;

	return (
		<div
			className={`rounded-lg border p-5 transition-colors ${
				live
					? "border-border-default bg-bg-surface"
					: "border-border-subtle bg-bg-surface/50"
			}`}
		>
			<div className="flex items-start justify-between gap-4">
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-2">
						<h3 className="m-0 font-display text-body font-semibold text-text-primary">
							{feature.label}
						</h3>
						<span
							className={`inline-flex items-center gap-1 rounded-sm px-2 py-0.5 font-mono text-xs ${
								live
									? "bg-success-muted text-success"
									: feature.available
										? "bg-bg-elevated text-text-tertiary"
										: "bg-warning-muted text-warning"
							}`}
						>
							{live ? "On" : feature.available ? "Off" : "Unavailable"}
						</span>
					</div>
					<p className="mt-1 mb-0 font-display text-body-sm text-text-secondary">
						{feature.description}
					</p>
				</div>

				<button
					type="button"
					role="switch"
					aria-checked={feature.enabled}
					aria-label={feature.label}
					disabled={!feature.available || saving}
					onClick={() => onToggle(!feature.enabled)}
					className={`relative mt-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full border-none transition-colors ${
						!feature.available
							? "cursor-not-allowed bg-border-subtle opacity-50"
							: `cursor-pointer ${feature.enabled ? "bg-success" : "bg-border-default"}`
					}`}
				>
					<span
						className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
							feature.enabled ? "translate-x-6" : "translate-x-1"
						}`}
					/>
				</button>
			</div>

			{/* What moves together with this switch. */}
			<div className="mt-4 flex flex-wrap gap-1.5">
				{feature.covers.map((part) => (
					<span
						key={part}
						className={`rounded-sm border px-2 py-0.5 font-mono text-xs ${
							live
								? "border-border-subtle text-text-secondary"
								: "border-border-subtle text-text-tertiary line-through"
						}`}
					>
						{part}
					</span>
				))}
			</div>

			{!feature.available && feature.missing.length > 0 && (
				<p className="mt-3 mb-0 flex items-start gap-2 font-mono text-xs text-warning">
					<AlertTriangle size={14} className="mt-px shrink-0" />
					<span>
						Set {feature.missing.join(", ")} in the backend environment, then
						restart. The switch here keeps its position meanwhile.
					</span>
				</p>
			)}

			{live === false && feature.available && feature.fallback && (
				<p className="mt-3 mb-0 font-display text-xs text-text-tertiary">
					{feature.fallback}
				</p>
			)}
		</div>
	);
}

export default function FeatureTogglesForm() {
	const toast = useToast();
	const { data: features, isPending } = useAdminFeatures();
	const updateFeatures = useAdminUpdateFeatures();

	const handleToggle = async (feature: FeatureState, enabled: boolean) => {
		try {
			await updateFeatures.mutateAsync({ [feature.id]: enabled });
			toast.success(`${feature.label} ${enabled ? "enabled" : "disabled"}`);
		} catch (err: any) {
			toast.error(err?.detail || `Failed to update ${feature.label}`);
		}
	};

	if (isPending) {
		return (
			<div className="mx-auto flex w-full max-w-(--breakpoint-md) flex-col gap-4">
				<div className="skeleton h-8 w-48 rounded" />
				<div className="skeleton h-4 w-96 rounded" />
				<div className="skeleton mt-4 h-36 rounded-lg" />
				<div className="skeleton h-36 rounded-lg" />
				<div className="skeleton h-36 rounded-lg" />
			</div>
		);
	}

	return (
		<div className="mx-auto flex w-full max-w-(--breakpoint-md) flex-col">
			<div className="mb-8 flex flex-col gap-2">
				<h1 className="m-0 font-display text-h2 font-bold text-text-primary">
					Features
				</h1>
				<p className="m-0 font-display text-body-sm text-text-secondary">
					Turn optional parts of the site on and off. Credentials decide what
					this deployment <em>can</em> do; these switches decide what it
					should. Everything here is optional — the blog itself never depends
					on any of it.
				</p>
			</div>

			<div className="flex flex-col gap-4">
				{features?.map((feature) => (
					<FeatureCard
						key={feature.id}
						feature={feature}
						saving={updateFeatures.isPending}
						onToggle={(enabled) => handleToggle(feature, enabled)}
					/>
				))}
			</div>

			<p className="mt-8 flex items-center gap-2 font-mono text-xs text-text-tertiary">
				{updateFeatures.isPending ? (
					<>
						<Loader2 size={14} className="animate-spin" />
						Saving...
					</>
				) : (
					<>
						<Check size={14} />
						Changes save immediately — no Save button, nothing to forget.
					</>
				)}
			</p>
		</div>
	);
}
