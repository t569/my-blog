"use client";

import { useState } from "react";
import { useAdminAnalytics } from "@/hooks/useApi";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { BarChart } from "@/components/ui/charts/bar-chart";
import { DonutChart } from "@/components/ui/charts/donut-chart";
import { FunnelChart } from "@/components/ui/charts/funnel-chart";
import { ChartCard } from "@/components/ui/charts/primitives";

const RANGES = [7, 30, 90];

const dayLabel = (iso: string) =>
	new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});

export default function AnalyticsPage() {
	const [days, setDays] = useState(30);
	const { data, isLoading, error } = useAdminAnalytics(days);

	return (
		<div className="flex flex-col gap-6 p-6 lg:p-10">
			<header className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<h1 className="m-0 font-display text-2xl text-text-primary">
						Analytics
					</h1>
					<p className="m-0 mt-1 text-sm text-text-tertiary">
						Cookieless. A visit is one reader on one day (UTC); returning readers count again.
					</p>
				</div>
				<div
					role="radiogroup"
					aria-label="Range"
					className="inline-flex rounded-full bg-bg-subtle p-0.5"
				>
					{RANGES.map((r) => (
						<button
							key={r}
							type="button"
							role="radio"
							aria-checked={days === r}
							onClick={() => setDays(r)}
							className={`h-8 rounded-full px-3.5 text-xs font-medium transition-colors ${
								days === r
									? "bg-bg-surface text-text-primary shadow-sm"
									: "text-text-tertiary"
							}`}
						>
							{r}d
						</button>
					))}
				</div>
			</header>

			{isLoading ? (
				<LoadingSpinner />
			) : error || !data ? (
				<p className="text-sm text-danger">
					Couldn&apos;t load analytics{error ? `: ${error.detail}` : "."}
				</p>
			) : (
				<>
					<ChartCard
						title="Traffic"
						description={`${data.totals.visitors.toLocaleString()} visits · ${data.totals.views.toLocaleString()} page views`}
					>
						<BarChart
							data={data.daily.map((d) => ({
								label: dayLabel(d.date),
								visitors: d.visitors,
								views: d.views,
							}))}
							series={[
								{ key: "visitors", label: "Visits" },
								{ key: "views", label: "Page views" },
							]}
						/>
					</ChartCard>

					<div className="grid gap-6 lg:grid-cols-2">
						<ChartCard title="Reading depth" description="Of all visits">
							<FunnelChart stages={data.funnel} />
						</ChartCard>
						<ChartCard title="Sources" description="Visits by referring site">
							{data.referrers.length ? (
								<DonutChart data={data.referrers} centerLabel="Visits" />
							) : (
								<p className="text-sm text-text-tertiary">No visits yet.</p>
							)}
						</ChartCard>
					</div>

					<ChartCard title="Top pages">
						<ol className="m-0 flex list-none flex-col p-0 text-sm">
							{data.top_pages.map((p) => (
								<li
									key={p.path}
									className="flex justify-between gap-4 border-b border-border-subtle py-2 last:border-0"
								>
									<a
										href={p.path}
										target="_blank"
										className="truncate text-text-secondary no-underline hover:text-accent"
									>
										{p.path}
									</a>
									<span className="tabular-nums text-text-primary">
										{p.views.toLocaleString()}
									</span>
								</li>
							))}
						</ol>
					</ChartCard>
				</>
			)}
		</div>
	);
}
