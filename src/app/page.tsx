"use client";

import { useEffect, useState } from "react";

interface OverviewData {
  kpis: {
    totalSessions: number;
    netLines: number;
    totalHours: number;
    projectCount: number;
    currentStreak: number;
  };
  dailyActivity: Array<{
    date: string;
    sessions: number;
    lines: number;
    files: number;
    tools: number;
  }>;
  topSkills: Array<{ name: string; count: number }>;
  topFrameworks: Array<{ name: string; count: number }>;
  toolDistribution: Array<{ name: string; count: number }>;
  recentSessions: Array<{
    id: string;
    project: string;
    duration: number;
    lines: number;
    tools: number;
    startedAt: string;
  }>;
}

function KpiCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 p-5">
      <p className="font-mono text-xs uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p className="mt-2 font-mono text-2xl font-semibold text-zinc-50">
        {value}
      </p>
      {sub && (
        <p className="mt-1 font-mono text-xs text-zinc-600">{sub}</p>
      )}
    </div>
  );
}

function TagPanel({
  title,
  items,
}: {
  title: string;
  items: Array<{ name: string; count: number }>;
}) {
  const max = items.length > 0 ? items[0].count : 1;
  return (
    <div className="rounded-lg border border-zinc-800 p-5">
      <h3 className="mb-4 font-mono text-xs uppercase tracking-wider text-zinc-500">
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="font-mono text-xs text-zinc-600">No data</p>
      ) : (
        <div className="space-y-2">
          {items.slice(0, 8).map((item) => (
            <div key={item.name} className="flex items-center gap-3">
              <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="absolute left-0 top-0 h-full rounded-full bg-violet-500/70"
                  style={{ width: `${(item.count / max) * 100}%` }}
                />
              </div>
              <span className="w-24 truncate font-mono text-xs text-zinc-400">
                {item.name}
              </span>
              <span className="w-8 text-right font-mono text-xs text-zinc-600">
                {item.count}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function OverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/overview")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-6">
        <p className="font-mono text-sm text-red-400">
          Failed to load: {error}
        </p>
        <p className="mt-2 font-mono text-xs text-zinc-500">
          Run POST /api/seed to generate demo data, or check that the database
          exists at ~/.claude-pulse/tracker.db
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="font-mono text-lg font-semibold">Overview</h1>
        <div className="grid grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-lg border border-zinc-800 bg-zinc-900/50"
            />
          ))}
        </div>
      </div>
    );
  }

  const { kpis, dailyActivity, topSkills, topFrameworks, toolDistribution, recentSessions } = data;

  return (
    <div className="space-y-8">
      <h1 className="font-mono text-lg font-semibold">Overview</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-4">
        <KpiCard
          label="Total Sessions"
          value={kpis.totalSessions.toLocaleString()}
        />
        <KpiCard
          label="Lines Written"
          value={kpis.netLines >= 0 ? `+${kpis.netLines.toLocaleString()}` : kpis.netLines.toLocaleString()}
          sub="net"
        />
        <KpiCard
          label="Total Time"
          value={`${kpis.totalHours.toFixed(1)}h`}
        />
        <KpiCard
          label="Projects"
          value={kpis.projectCount.toString()}
        />
        <KpiCard
          label="Streak"
          value={`${kpis.currentStreak}d`}
          sub="consecutive days"
        />
      </div>

      {/* Daily Activity Table */}
      <div className="rounded-lg border border-zinc-800 p-5">
        <h2 className="mb-4 font-mono text-xs uppercase tracking-wider text-zinc-500">
          Daily Activity (Last 14 Days)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full font-mono text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                <th className="pb-2 pr-6">Date</th>
                <th className="pb-2 pr-6 text-right">Sessions</th>
                <th className="pb-2 pr-6 text-right">Lines</th>
                <th className="pb-2 pr-6 text-right">Files</th>
                <th className="pb-2 text-right">Tools</th>
              </tr>
            </thead>
            <tbody>
              {dailyActivity.map((day) => (
                <tr
                  key={day.date}
                  className="border-b border-zinc-800/50 text-zinc-300"
                >
                  <td className="py-2 pr-6">{formatDate(day.date)}</td>
                  <td className="py-2 pr-6 text-right">{day.sessions}</td>
                  <td className="py-2 pr-6 text-right">
                    <span className={day.lines >= 0 ? "text-green-400" : "text-red-400"}>
                      {day.lines >= 0 ? `+${day.lines}` : day.lines}
                    </span>
                  </td>
                  <td className="py-2 pr-6 text-right">{day.files}</td>
                  <td className="py-2 text-right">{day.tools}</td>
                </tr>
              ))}
              {dailyActivity.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="py-4 text-center text-xs text-zinc-600"
                  >
                    No activity recorded
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tag Panels */}
      <div className="grid grid-cols-3 gap-4">
        <TagPanel title="Top Skills" items={topSkills} />
        <TagPanel title="Top Frameworks" items={topFrameworks} />
        <TagPanel title="Tool Distribution" items={toolDistribution} />
      </div>

      {/* Recent Sessions */}
      <div className="rounded-lg border border-zinc-800 p-5">
        <h2 className="mb-4 font-mono text-xs uppercase tracking-wider text-zinc-500">
          Recent Sessions
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full font-mono text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                <th className="pb-2 pr-6">Project</th>
                <th className="pb-2 pr-6">Started</th>
                <th className="pb-2 pr-6 text-right">Duration</th>
                <th className="pb-2 pr-6 text-right">Lines</th>
                <th className="pb-2 text-right">Tools</th>
              </tr>
            </thead>
            <tbody>
              {recentSessions.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-zinc-800/50 text-zinc-300"
                >
                  <td className="py-2 pr-6">
                    <span className="text-violet-400">{s.project}</span>
                  </td>
                  <td className="py-2 pr-6 text-zinc-500">
                    {formatDate(s.startedAt)}
                  </td>
                  <td className="py-2 pr-6 text-right">
                    {s.duration > 0 ? formatDuration(s.duration) : "--"}
                  </td>
                  <td className="py-2 pr-6 text-right">
                    <span className={s.lines >= 0 ? "text-green-400" : "text-red-400"}>
                      {s.lines >= 0 ? `+${s.lines}` : s.lines}
                    </span>
                  </td>
                  <td className="py-2 text-right">{s.tools}</td>
                </tr>
              ))}
              {recentSessions.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="py-4 text-center text-xs text-zinc-600"
                  >
                    No sessions recorded
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
