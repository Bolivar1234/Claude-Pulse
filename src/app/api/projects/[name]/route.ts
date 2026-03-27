import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

interface DailySummaryRow {
  date: string;
  session_count: number;
  total_duration_seconds: number;
  lines_added: number;
  lines_removed: number;
  net_lines: number;
  files_edited: number;
  files_created: number;
  files_read: number;
  tool_calls: number;
  agents_spawned: number;
}

interface FileActivityRow {
  file_path: string;
  total_edits: number;
  total_writes: number;
  total_added: number;
  total_removed: number;
  language: string | null;
}

interface SessionRow {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  summary: string | null;
  status: string;
  tool_count: number;
  lines_added: number;
  lines_removed: number;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const project = decodeURIComponent(name);
    const db = getDb();

    // KPIs for this project
    const kpis = db
      .prepare(
        `SELECT
          COALESCE(SUM(session_count), 0) as sessions,
          COALESCE(SUM(total_duration_seconds), 0) as duration,
          COALESCE(SUM(lines_added), 0) as lines_added,
          COALESCE(SUM(lines_removed), 0) as lines_removed,
          COALESCE(SUM(net_lines), 0) as net_lines,
          COALESCE(SUM(files_edited) + SUM(files_created), 0) as files,
          COALESCE(SUM(agents_spawned), 0) as agents
        FROM daily_summaries
        WHERE project = ?`
      )
      .get(project) as {
      sessions: number;
      duration: number;
      lines_added: number;
      lines_removed: number;
      net_lines: number;
      files: number;
      agents: number;
    };

    // Daily summaries for the last 14 days
    const dailyRows = db
      .prepare(
        `SELECT
          date,
          session_count,
          total_duration_seconds,
          lines_added,
          lines_removed,
          net_lines,
          files_edited,
          files_created,
          files_read,
          tool_calls,
          agents_spawned
        FROM daily_summaries
        WHERE project = ?
        ORDER BY date DESC
        LIMIT 14`
      )
      .all(project) as DailySummaryRow[];

    // Top 10 most edited files
    const topFiles = db
      .prepare(
        `SELECT
          file_path,
          SUM(edit_count) + SUM(write_count) as total_edits,
          SUM(write_count) as total_writes,
          SUM(lines_added) as total_added,
          SUM(lines_removed) as total_removed,
          language
        FROM file_activity
        WHERE project = ?
        GROUP BY file_path
        ORDER BY total_edits DESC
        LIMIT 10`
      )
      .all(project) as FileActivityRow[];

    // Recent 20 sessions
    const sessions = db
      .prepare(
        `SELECT
          s.id,
          s.started_at,
          s.ended_at,
          s.duration_seconds,
          s.summary,
          s.status,
          COUNT(e.id) as tool_count,
          COALESCE(SUM(e.lines_added), 0) as lines_added,
          COALESCE(SUM(e.lines_removed), 0) as lines_removed
        FROM sessions s
        LEFT JOIN tool_events e ON e.session_id = s.id
        WHERE s.project = ?
        GROUP BY s.id
        ORDER BY s.started_at DESC
        LIMIT 20`
      )
      .all(project) as SessionRow[];

    return Response.json({
      project,
      kpis: {
        sessions: kpis.sessions,
        duration: kpis.duration,
        linesAdded: kpis.lines_added,
        linesRemoved: kpis.lines_removed,
        netLines: kpis.net_lines,
        files: kpis.files,
        agents: kpis.agents,
      },
      dailyActivity: dailyRows.map((r) => ({
        date: r.date,
        sessions: r.session_count,
        duration: r.total_duration_seconds,
        linesAdded: r.lines_added,
        linesRemoved: r.lines_removed,
        netLines: r.net_lines,
        files: r.files_edited + r.files_created,
        filesRead: r.files_read,
        tools: r.tool_calls,
        agents: r.agents_spawned,
      })),
      topFiles: topFiles.map((f) => ({
        filePath: f.file_path,
        edits: f.total_edits,
        writes: f.total_writes,
        linesAdded: f.total_added,
        linesRemoved: f.total_removed,
        language: f.language,
      })),
      recentSessions: sessions.map((s) => ({
        id: s.id,
        startedAt: s.started_at,
        endedAt: s.ended_at,
        duration: s.duration_seconds ?? 0,
        summary: s.summary,
        status: s.status,
        tools: s.tool_count,
        lines: s.lines_added - s.lines_removed,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
