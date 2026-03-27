"use client";

import { useEffect, useState } from "react";

interface DayData {
  date: string;
  sessions: number;
  duration: number;
  linesAdded: number;
  linesRemoved: number;
  netLines: number;
  toolCalls: number;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getIntensity(value: number, max: number): number {
  if (max === 0 || value === 0) return 0;
  const ratio = value / max;
  if (ratio < 0.15) return 1;
  if (ratio < 0.35) return 2;
  if (ratio < 0.6) return 3;
  return 4;
}

const INTENSITY_COLORS = [
  "bg-zinc-800/50",        // 0: no activity
  "bg-violet-900/40",      // 1: low
  "bg-violet-700/50",      // 2: medium-low
  "bg-violet-500/60",      // 3: medium-high
  "bg-violet-400/80",      // 4: high
];

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function CalendarHeatmap({ days }: { days: DayData[] }) {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    data: DayData;
  } | null>(null);

  // Build a map of date -> day data
  const dayMap = new Map(days.map((d) => [d.date, d]));

  // Find max lines for intensity scaling
  const maxLines = Math.max(...days.map((d) => d.linesAdded + d.linesRemoved), 1);

  // Build the 90-day grid using UTC dates (DB stores UTC)
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const startDate = new Date(todayUTC);
  startDate.setUTCDate(startDate.getUTCDate() - 89);

  // Adjust start to previous Monday (UTC)
  const startDay = startDate.getUTCDay();
  const mondayOffset = startDay === 0 ? -6 : 1 - startDay;
  startDate.setUTCDate(startDate.getUTCDate() + mondayOffset);

  // Generate all dates from startDate to today (UTC)
  const cells: Array<{ date: string; dayOfWeek: number; data: DayData | null }> = [];
  const current = new Date(startDate);

  while (current <= todayUTC) {
    const dateStr = current.toISOString().slice(0, 10);
    cells.push({
      date: dateStr,
      dayOfWeek: current.getUTCDay() === 0 ? 6 : current.getUTCDay() - 1, // Mon=0, Sun=6
      data: dayMap.get(dateStr) || null,
    });
    current.setUTCDate(current.getUTCDate() + 1);
  }

  // Group into weeks (columns)
  const weeks: Array<typeof cells> = [];
  let currentWeek: typeof cells = [];
  let lastWeekStart = -1;

  for (const cell of cells) {
    if (cell.dayOfWeek === 0 && currentWeek.length > 0) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    currentWeek.push(cell);
  }
  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }

  return (
    <div className="rounded-lg border border-zinc-800 p-5">
      <h2 className="mb-4 font-mono text-xs uppercase tracking-wider text-zinc-500">
        Activity Heatmap (Last 90 Days)
      </h2>
      <div className="relative">
        <div className="flex gap-1">
          {/* Day labels */}
          <div className="flex flex-col gap-1 pr-2">
            {DAY_LABELS.map((label, i) => (
              <div
                key={label}
                className="flex h-3.5 items-center font-mono text-[10px] text-zinc-600"
              >
                {i % 2 === 0 ? label : ""}
              </div>
            ))}
          </div>
          {/* Weeks */}
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              {Array.from({ length: 7 }).map((_, di) => {
                const cell = week.find((c) => c.dayOfWeek === di);
                if (!cell) {
                  return <div key={di} className="h-3.5 w-3.5" />;
                }
                const totalLines = cell.data
                  ? cell.data.linesAdded + cell.data.linesRemoved
                  : 0;
                const intensity = getIntensity(totalLines, maxLines);
                return (
                  <div
                    key={di}
                    className={`h-3.5 w-3.5 cursor-pointer rounded-sm ${INTENSITY_COLORS[intensity]} transition-colors hover:ring-1 hover:ring-violet-400/50`}
                    onMouseEnter={(e) => {
                      if (cell.data) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltip({
                          x: rect.left,
                          y: rect.top - 60,
                          data: cell.data,
                        });
                      }
                    }}
                    onMouseLeave={() => setTooltip(null)}
                    title={
                      cell.data
                        ? `${cell.date}: +${cell.data.linesAdded}/-${cell.data.linesRemoved} lines, ${cell.data.sessions} sessions`
                        : `${cell.date}: no activity`
                    }
                  />
                );
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-3 flex items-center gap-2">
          <span className="font-mono text-[10px] text-zinc-600">Less</span>
          {INTENSITY_COLORS.map((color, i) => (
            <div
              key={i}
              className={`h-3 w-3 rounded-sm ${color}`}
            />
          ))}
          <span className="font-mono text-[10px] text-zinc-600">More</span>
        </div>
      </div>

      {/* Tooltip rendered as fixed overlay */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 rounded border border-zinc-700 bg-zinc-900 px-3 py-2 shadow-lg"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <p className="font-mono text-xs text-zinc-300">
            {tooltip.data.date}
          </p>
          <p className="font-mono text-[10px] text-zinc-500">
            {tooltip.data.sessions} sessions |{" "}
            <span className="text-green-400">+{tooltip.data.linesAdded}</span>
            {" / "}
            <span className="text-red-400">-{tooltip.data.linesRemoved}</span>
          </p>
        </div>
      )}
    </div>
  );
}

export default function TimelinePage() {
  const [days, setDays] = useState<DayData[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/timeline")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => setDays(d.days ?? []))
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-6">
        <p className="font-mono text-sm text-red-400">
          Failed to load: {error}
        </p>
      </div>
    );
  }

  const last30 = days.slice(-30).reverse();

  return (
    <div className="space-y-8">
      <h1 className="font-mono text-lg font-semibold">Timeline</h1>

      <CalendarHeatmap days={days} />

      {/* Daily Breakdown Table */}
      <div className="rounded-lg border border-zinc-800 p-5">
        <h2 className="mb-4 font-mono text-xs uppercase tracking-wider text-zinc-500">
          Daily Breakdown (Last 30 Days)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full font-mono text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                <th className="pb-2 pr-6">Date</th>
                <th className="pb-2 pr-6 text-right">Sessions</th>
                <th className="pb-2 pr-6 text-right">Duration</th>
                <th className="pb-2 pr-6 text-right">Lines +/-</th>
                <th className="pb-2 pr-6 text-right">Net Lines</th>
                <th className="pb-2 text-right">Tools</th>
              </tr>
            </thead>
            <tbody>
              {last30.map((day) => (
                <tr
                  key={day.date}
                  className="border-b border-zinc-800/50 text-zinc-300"
                >
                  <td className="py-2 pr-6">{formatDate(day.date)}</td>
                  <td className="py-2 pr-6 text-right">{day.sessions}</td>
                  <td className="py-2 pr-6 text-right">
                    {formatDuration(day.duration)}
                  </td>
                  <td className="py-2 pr-6 text-right">
                    <span className="text-green-400">+{day.linesAdded}</span>
                    {" / "}
                    <span className="text-red-400">-{day.linesRemoved}</span>
                  </td>
                  <td className="py-2 pr-6 text-right">
                    <span
                      className={
                        day.netLines >= 0 ? "text-green-400" : "text-red-400"
                      }
                    >
                      {day.netLines >= 0 ? `+${day.netLines}` : day.netLines}
                    </span>
                  </td>
                  <td className="py-2 text-right">{day.toolCalls}</td>
                </tr>
              ))}
              {last30.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
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
    </div>
  );
}
