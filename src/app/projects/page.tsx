"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ProjectRow {
  project: string;
  sessions: number;
  durationSeconds: number;
  linesAdded: number;
  linesRemoved: number;
  netLines: number;
  files: number;
  agents: number;
  lastActive: string;
}

type SortKey = keyof ProjectRow;

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDate(iso: string): string {
  if (!iso) return "--";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("lastActive");
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => setProjects(d.projects ?? []))
      .catch((e) => setError(e.message));
  }, []);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const sorted = [...projects].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
    return sortAsc ? cmp : -cmp;
  });

  const sortIcon = (key: SortKey) => {
    if (key !== sortKey) return "";
    return sortAsc ? " ▲" : " ▼";
  };

  if (error) {
    return (
      <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-6">
        <p className="font-mono text-sm text-red-400">Failed to load: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="font-mono text-lg font-semibold">Projects</h1>

      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full font-mono text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
              {(
                [
                  ["project", "Project"],
                  ["sessions", "Sessions"],
                  ["durationSeconds", "Duration"],
                  ["netLines", "Lines (+/-)"],
                  ["files", "Files"],
                  ["agents", "Agents"],
                  ["lastActive", "Last Active"],
                ] as [SortKey, string][]
              ).map(([key, label]) => (
                <th
                  key={key}
                  className="cursor-pointer px-5 py-3 hover:text-zinc-300"
                  onClick={() => handleSort(key)}
                >
                  {label}
                  {sortIcon(key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr
                key={p.project}
                className="border-b border-zinc-800/50 text-zinc-300 transition-colors hover:bg-zinc-900/50"
              >
                <td className="px-5 py-3">
                  <Link
                    href={`/projects/${encodeURIComponent(p.project)}`}
                    className="text-violet-400 hover:underline"
                  >
                    {p.project}
                  </Link>
                </td>
                <td className="px-5 py-3">{p.sessions}</td>
                <td className="px-5 py-3">{formatDuration(p.durationSeconds)}</td>
                <td className="px-5 py-3">
                  <span className="text-green-400">+{p.linesAdded}</span>
                  {" / "}
                  <span className="text-red-400">-{p.linesRemoved}</span>
                </td>
                <td className="px-5 py-3">{p.files}</td>
                <td className="px-5 py-3">{p.agents}</td>
                <td className="px-5 py-3 text-zinc-500">{formatDate(p.lastActive)}</td>
              </tr>
            ))}
            {projects.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-5 py-8 text-center text-xs text-zinc-600"
                >
                  No projects found. Seed demo data via POST /api/seed.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
