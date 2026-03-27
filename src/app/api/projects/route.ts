import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

interface ProjectSummaryRow {
  project: string;
  sessions: number;
  duration_seconds: number;
  lines_added: number;
  lines_removed: number;
  net_lines: number;
  files: number;
  agents: number;
  last_active: string;
}

export async function GET() {
  try {
    const db = getDb();

    const rows = db
      .prepare(
        `SELECT
          d.project,
          SUM(d.session_count) as sessions,
          SUM(d.total_duration_seconds) as duration_seconds,
          SUM(d.lines_added) as lines_added,
          SUM(d.lines_removed) as lines_removed,
          SUM(d.net_lines) as net_lines,
          SUM(d.files_edited) + SUM(d.files_created) as files,
          SUM(d.agents_spawned) as agents,
          MAX(d.date) as last_active
        FROM daily_summaries d
        GROUP BY d.project
        ORDER BY last_active DESC`
      )
      .all() as ProjectSummaryRow[];

    const projects = rows.map((r) => ({
      project: r.project,
      sessions: r.sessions,
      durationSeconds: r.duration_seconds,
      linesAdded: r.lines_added,
      linesRemoved: r.lines_removed,
      netLines: r.net_lines,
      files: r.files,
      agents: r.agents,
      lastActive: r.last_active,
    }));

    return Response.json({ projects });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
