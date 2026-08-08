import { SITE } from "@/lib/constants";

export default function PublicFooter() {
	return (
		<footer className="w-full border-t border-border-subtle bg-bg-surface py-8">
			<div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 md:flex-row lg:px-8">
				{/* Left: Social Links */}
				<div className="flex items-center gap-6 font-mono text-xs uppercase text-text-secondary">
					<a
						href={SITE.twitter}
						className="hover:text-accent transition-colors"
					>
						Twitter
					</a>
					<a
						href={SITE.github}
						className="hover:text-accent transition-colors"
					>
						GitHub
					</a>
					{/* Hidden when the env override is blank — a fork that has no
					    LinkedIn shouldn't render a dead link. */}
					{SITE.linkedin && (
						<a
							href={SITE.linkedin}
							className="hover:text-accent transition-colors"
						>
							LinkedIn
						</a>
					)}
				</div>

				{/* Right: Copyright */}
				<div className="font-mono text-xs uppercase text-text-tertiary">
					© {new Date().getFullYear()} {SITE.name} // {SITE.motto}
				</div>
			</div>
		</footer>
	);
}
