"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImageUp, RotateCcw, Shuffle, Trash2 } from "lucide-react";
import CharacterFace from "@/components/assistant/CharacterFace";
import { useAdminCharacters, useAdminUpdateCharacters } from "@/hooks/useApi";
import { adminUploadImage } from "@/services/api";
import { useToast } from "@/hooks/useToast";
import { ASSISTANT } from "@/lib/constants";
import {
	CHARACTER_IDS,
	CHARACTER_ROLES,
	EMOTIONS,
	STYLE_CATALOG,
	defaultChoice,
	faceSvg,
	loadStyle,
	type CharacterChoice,
	type CharacterId,
} from "@/lib/assistant/characters";

/**
 * Choose a face for the assistant and each agent, and see every animation it
 * has before saving. Choices are stored server-side (owners.characters), so the
 * assistant's face is what readers see too.
 */

const nameOf = (id: CharacterId) => (id === "assistant" ? ASSISTANT.name : id[0]!.toUpperCase() + id.slice(1));

/** A still thumbnail — twenty live scenes for a picker would be waste. */
function StyleThumb({ choice }: { choice: CharacterChoice }) {
	const [src, setSrc] = useState<string | null>(null);
	useEffect(() => {
		let cancelled = false;
		void loadStyle(choice.style).then((style) => {
			if (!cancelled) setSrc(`data:image/svg+xml;utf8,${encodeURIComponent(faceSvg(style, choice, "idle", 64))}`);
		});
		return () => {
			cancelled = true;
		};
	}, [choice]);
	// eslint-disable-next-line @next/next/no-img-element
	return src ? <img src={src} alt="" className="h-12 w-12" /> : <div className="skeleton h-12 w-12 rounded-full" />;
}

export default function CharactersPage() {
	const { data, isLoading } = useAdminCharacters();
	const save = useAdminUpdateCharacters();
	const toast = useToast();

	const [selected, setSelected] = useState<CharacterId>("assistant");
	const [draft, setDraft] = useState<Record<string, CharacterChoice | null>>({});
	const [uploading, setUploading] = useState(false);
	const fileRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (data) setDraft(data.characters);
	}, [data]);

	const effective = (id: CharacterId): CharacterChoice => draft[id] ?? defaultChoice(id, ASSISTANT.seed);
	const current = effective(selected);
	const dirty = useMemo(
		() => JSON.stringify(draft) !== JSON.stringify(data?.characters ?? {}),
		[draft, data],
	);

	const update = (patch: Partial<CharacterChoice>) =>
		setDraft((d) => ({ ...d, [selected]: { ...effective(selected), ...patch } }));

	const onUpload = async (file: File | undefined) => {
		if (!file) return;
		setUploading(true);
		try {
			const { url } = await adminUploadImage(file);
			update({ image_url: url });
		} catch {
			toast.error("Upload failed — image uploads need Cloudinary configured on the backend.");
		} finally {
			setUploading(false);
			if (fileRef.current) fileRef.current.value = "";
		}
	};

	const onSave = async () => {
		try {
			await save.mutateAsync(draft);
			toast.success("Characters saved");
		} catch (e) {
			const detail = (e as { detail?: string }).detail;
			toast.error(typeof detail === "string" ? detail : "Could not save characters.");
		}
	};

	if (isLoading) return <div className="skeleton h-64 w-full rounded-xl" />;

	return (
		<div className="flex flex-col gap-8">
			<header className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<h1 className="font-display text-h3 font-semibold text-text-primary">Characters</h1>
					<p className="mt-1 max-w-2xl text-sm text-text-secondary">
						Faces for {ASSISTANT.name} and the agents. {ASSISTANT.name}&apos;s face is the one readers see
						in the chat; the agents appear when you watch a run.
					</p>
				</div>
				<button
					type="button"
					onClick={onSave}
					disabled={!dirty || save.isPending || data?.ready === false}
					className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-text-inverse disabled:opacity-40"
				>
					{save.isPending ? "Saving…" : "Save changes"}
				</button>
			</header>

			{data?.ready === false && (
				<p className="rounded-lg border border-warning bg-warning-muted px-4 py-3 text-sm text-text-primary">
					{data.hint}{" "}Until then you can preview faces here, but they can&apos;t be saved.
				</p>
			)}

			<div className="grid gap-8 lg:grid-cols-[16rem_1fr]">
				{/* ── who ── */}
				<ul className="m-0 flex list-none flex-col gap-1 p-0" aria-label="Characters">
					{CHARACTER_IDS.map((id) => (
						<li key={id}>
							<button
								type="button"
								onClick={() => setSelected(id)}
								aria-current={selected === id}
								className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
									selected === id ? "bg-accent-muted" : "hover:bg-bg-elevated"
								}`}
							>
								<CharacterFace choice={effective(id)} emotion="idle" label="" className="h-10 w-10 shrink-0" />
								<span className="min-w-0">
									<span className="block font-display text-sm font-semibold text-text-primary">{nameOf(id)}</span>
									<span className="block truncate text-xs text-text-tertiary">{CHARACTER_ROLES[id]}</span>
								</span>
							</button>
						</li>
					))}
				</ul>

				{/* ── how ── */}
				<section className="flex flex-col gap-8" aria-label={`${nameOf(selected)}'s face`}>
					<div>
						<h2 className="mb-3 font-mono text-[0.7rem] uppercase tracking-widest text-text-tertiary">
							Every animation
						</h2>
						<div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
							{EMOTIONS.map((emotion) => (
								<figure key={emotion} className="m-0 flex flex-col items-center gap-2 rounded-xl border border-border-subtle bg-bg-surface p-3">
									<CharacterFace
										choice={current}
										emotion={emotion}
										label={`${nameOf(selected)}, ${emotion}`}
										className="h-20 w-20"
									/>
									<figcaption className="font-mono text-[0.65rem] uppercase text-text-secondary">{emotion}</figcaption>
								</figure>
							))}
						</div>
					</div>

					<div>
						<h2 className="mb-3 font-mono text-[0.7rem] uppercase tracking-widest text-text-tertiary">Photo</h2>
						<div className="flex flex-wrap items-center gap-3">
							<input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onUpload(e.target.files?.[0])} />
							<button
								type="button"
								onClick={() => fileRef.current?.click()}
								disabled={uploading}
								className="inline-flex items-center gap-2 rounded-lg border border-border-default px-3 py-2 text-sm text-text-primary hover:bg-bg-elevated disabled:opacity-40"
							>
								<ImageUp className="h-4 w-4" /> {uploading ? "Uploading…" : current.image_url ? "Replace photo" : "Use a photo"}
							</button>
							{current.image_url && (
								<button
									type="button"
									onClick={() => update({ image_url: null })}
									className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger hover:bg-danger-muted"
								>
									<Trash2 className="h-4 w-4" /> Remove photo
								</button>
							)}
							<p className="w-full text-xs text-text-tertiary">
								A photo replaces the drawn face. It still moves with each emotion, but it can&apos;t change expression.
							</p>
						</div>
					</div>

					<fieldset disabled={!!current.image_url} className="m-0 border-0 p-0 disabled:opacity-40">
						<legend className="mb-3 font-mono text-[0.7rem] uppercase tracking-widest text-text-tertiary">Style</legend>
						<div className="mb-4 flex items-center gap-2">
							<label htmlFor="seed" className="text-sm text-text-secondary">
								Seed
							</label>
							<input
								id="seed"
								value={current.seed}
								maxLength={64}
								onChange={(e) => update({ seed: e.target.value || "seed" })}
								className="w-48 rounded-lg border border-border-subtle bg-bg-page px-3 py-1.5 text-sm text-text-primary"
							/>
							<button
								type="button"
								onClick={() => update({ seed: Math.random().toString(36).slice(2, 10) })}
								className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-text-secondary hover:bg-bg-elevated"
							>
								<Shuffle className="h-4 w-4" /> Shuffle
							</button>
						</div>
						<div className="grid grid-cols-3 gap-2 sm:grid-cols-5 xl:grid-cols-10">
							{STYLE_CATALOG.map((s) => (
								<button
									key={s.id}
									type="button"
									onClick={() => update({ style: s.id })}
									aria-pressed={current.style === s.id}
									className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-[0.65rem] text-text-secondary ${
										current.style === s.id ? "border-accent bg-accent-muted" : "border-border-subtle hover:bg-bg-elevated"
									}`}
								>
									<StyleThumb choice={{ style: s.id, seed: current.seed }} />
									{s.label}
								</button>
							))}
						</div>
					</fieldset>

					<div>
						<button
							type="button"
							onClick={() => setDraft((d) => ({ ...d, [selected]: null }))}
							className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary"
						>
							<RotateCcw className="h-4 w-4" /> Back to the built-in face
						</button>
					</div>
				</section>
			</div>
		</div>
	);
}
