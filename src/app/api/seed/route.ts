import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const PROJECTS = [
  { name: "claude-pulse", path: "/Users/dev/claude-pulse" },
  { name: "my-app", path: "/Users/dev/my-app" },
  { name: "api-server", path: "/Users/dev/api-server" },
];

const TOOLS = ["Edit", "Write", "Bash", "Read", "Glob", "Grep", "Agent", "Skill"];
const TOOL_WEIGHTS = [30, 10, 20, 15, 8, 7, 5, 5]; // probability weights

const LANGUAGES: Record<string, string[]> = {
  "claude-pulse": ["typescript", "tsx", "css", "json"],
  "my-app": ["typescript", "tsx", "css", "python"],
  "api-server": ["rust", "toml", "sql", "yaml"],
};

const FILE_PATHS: Record<string, string[]> = {
  "claude-pulse": [
    "src/app/page.tsx",
    "src/app/layout.tsx",
    "src/app/globals.css",
    "src/lib/db.ts",
    "src/lib/schema.ts",
    "src/app/api/overview/route.ts",
    "src/app/projects/page.tsx",
    "src/components/Chart.tsx",
    "src/components/KpiCard.tsx",
    "package.json",
    "tsconfig.json",
    "next.config.ts",
  ],
  "my-app": [
    "src/App.tsx",
    "src/index.tsx",
    "src/components/Header.tsx",
    "src/components/Sidebar.tsx",
    "src/hooks/useAuth.ts",
    "src/hooks/useData.ts",
    "src/pages/Dashboard.tsx",
    "src/pages/Settings.tsx",
    "src/styles/global.css",
    "src/utils/api.ts",
    "tests/App.test.tsx",
    "package.json",
  ],
  "api-server": [
    "src/main.rs",
    "src/routes/mod.rs",
    "src/routes/auth.rs",
    "src/routes/users.rs",
    "src/models/user.rs",
    "src/models/session.rs",
    "src/db/migrations.rs",
    "src/db/pool.rs",
    "Cargo.toml",
    "config.yaml",
    "tests/integration.rs",
    "docker-compose.yml",
  ],
};

const FRAMEWORKS: Record<string, string[]> = {
  "claude-pulse": ["next.js", "react", "tailwindcss", "sqlite"],
  "my-app": ["react", "vite", "tailwindcss", "zustand"],
  "api-server": ["axum", "tokio", "sqlx", "serde"],
};

const BASH_COMMANDS = [
  "npm run dev",
  "npm run build",
  "npm test",
  "npm run lint",
  "cargo build",
  "cargo test",
  "cargo clippy",
  "git status",
  "git diff",
  "git log --oneline -5",
  "docker compose up -d",
  "curl localhost:3000/health",
  "python -m pytest",
  "npx prisma migrate dev",
  "ls -la",
  "cat package.json",
];

const SKILLS = [
  "commit",
  "investigate",
  "review-code",
  "simplify",
  "fix-bug",
  "add-feature",
  "blueprint",
  "check",
];

const AGENT_TYPES = ["researcher", "coder", "analyst", "reviewer", "tester"];

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedPick(items: string[], weights: number[]): string {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function isoDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function isoDatetime(daysAgo: number, hourOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(9 + hourOffset, rand(0, 59), rand(0, 59), 0);
  return d.toISOString().replace("T", " ").slice(0, 19);
}

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return Response.json(
      { error: "Seeding is disabled in production" },
      { status: 403 }
    );
  }

  try {
    const db = getDb();

    // Clear existing data
    db.exec("DELETE FROM file_activity");
    db.exec("DELETE FROM daily_summaries");
    db.exec("DELETE FROM tool_events");
    db.exec("DELETE FROM sessions");

    const insertSession = db.prepare(
      `INSERT INTO sessions (id, project, started_at, ended_at, duration_seconds, status)
       VALUES (?, ?, ?, ?, ?, ?)`
    );

    const insertEvent = db.prepare(
      `INSERT INTO tool_events (
        session_id, tool_name, timestamp, file_path, language,
        lines_added, lines_removed, command, detected_framework,
        command_failed, search_pattern, agent_type, agent_description,
        skill_name, skill_args, metadata
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const insertSummary = db.prepare(
      `INSERT INTO daily_summaries (
        date, project, session_count, total_duration_seconds,
        lines_added, lines_removed, net_lines,
        files_created, files_edited, files_read,
        tool_calls, bash_commands, bash_failures, searches,
        agents_spawned, skills_used, frameworks_detected,
        languages, tool_counts
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const insertFileActivity = db.prepare(
      `INSERT OR REPLACE INTO file_activity (
        file_path, project, date, edit_count, write_count, read_count,
        lines_added, lines_removed, language
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    let totalSessions = 0;
    let totalEvents = 0;
    let totalSummaries = 0;
    let totalFileActivity = 0;

    const insertAll = db.transaction(() => {
      for (let daysAgo = 29; daysAgo >= 0; daysAgo--) {
        const date = isoDate(daysAgo);
        const sessionsToday = rand(3, 6);

        for (const proj of PROJECTS) {
          // Not every project is active every day
          if (Math.random() < 0.25) continue;

          const projSessionCount = rand(1, Math.min(sessionsToday, 3));
          let dayLinesAdded = 0;
          let dayLinesRemoved = 0;
          let dayFilesCreated = 0;
          let dayFilesEdited = 0;
          let dayFilesRead = 0;
          let dayToolCalls = 0;
          let dayBashCommands = 0;
          let dayBashFailures = 0;
          let daySearches = 0;
          let dayAgents = 0;
          let dayDuration = 0;
          const daySkills: Record<string, number> = {};
          const dayFrameworks: Record<string, number> = {};
          const dayLanguages: Record<string, number> = {};
          const dayTools: Record<string, number> = {};
          const dayFileMap: Map<
            string,
            {
              edits: number;
              writes: number;
              reads: number;
              added: number;
              removed: number;
              lang: string;
            }
          > = new Map();

          for (let si = 0; si < projSessionCount; si++) {
            const sessionId = `sess-${date}-${proj.name}-${si}`;
            const durationSec = rand(600, 5400); // 10min to 90min
            dayDuration += durationSec;

            const startTime = isoDatetime(daysAgo, si * 3 + rand(0, 2));
            const endDate = new Date(startTime.replace(" ", "T") + "Z");
            endDate.setSeconds(endDate.getSeconds() + durationSec);
            const endTime = endDate
              .toISOString()
              .replace("T", " ")
              .slice(0, 19);

            insertSession.run(
              sessionId,
              proj.name,
              startTime,
              endTime,
              durationSec,
              "completed"
            );
            totalSessions++;

            // Generate tool events
            const eventCount = rand(10, 50);
            for (let ei = 0; ei < eventCount; ei++) {
              const toolName = weightedPick(TOOLS, TOOL_WEIGHTS);
              const evtOffset = (durationSec / eventCount) * ei;
              const evtDate = new Date(startTime.replace(" ", "T") + "Z");
              evtDate.setSeconds(evtDate.getSeconds() + evtOffset);
              const evtTime = evtDate
                .toISOString()
                .replace("T", " ")
                .slice(0, 19);

              let filePath: string | null = null;
              let language: string | null = null;
              let linesAdded = 0;
              let linesRemoved = 0;
              let command: string | null = null;
              let detectedFramework: string | null = null;
              let commandFailed = 0;
              let searchPattern: string | null = null;
              let agentType: string | null = null;
              let agentDesc: string | null = null;
              let skillName: string | null = null;
              let skillArgs: string | null = null;

              const projFiles = FILE_PATHS[proj.name];
              const projLangs = LANGUAGES[proj.name];
              const projFw = FRAMEWORKS[proj.name];

              switch (toolName) {
                case "Edit":
                  filePath = pick(projFiles);
                  language = pick(projLangs);
                  linesAdded = rand(1, 30);
                  linesRemoved = rand(0, 15);
                  detectedFramework = Math.random() < 0.3 ? pick(projFw) : null;
                  dayFilesEdited++;
                  break;
                case "Write":
                  filePath = pick(projFiles);
                  language = pick(projLangs);
                  linesAdded = rand(10, 100);
                  linesRemoved = 0;
                  dayFilesCreated++;
                  break;
                case "Read":
                  filePath = pick(projFiles);
                  language = pick(projLangs);
                  dayFilesRead++;
                  break;
                case "Bash":
                  command = pick(BASH_COMMANDS);
                  commandFailed = Math.random() < 0.08 ? 1 : 0;
                  detectedFramework = Math.random() < 0.4 ? pick(projFw) : null;
                  dayBashCommands++;
                  if (commandFailed) dayBashFailures++;
                  break;
                case "Glob":
                case "Grep":
                  searchPattern = `*.${pick(["ts", "tsx", "rs", "py", "json"])}`;
                  daySearches++;
                  break;
                case "Agent":
                  agentType = pick(AGENT_TYPES);
                  agentDesc = `${agentType} agent for ${proj.name}`;
                  dayAgents++;
                  break;
                case "Skill":
                  skillName = pick(SKILLS);
                  skillArgs = proj.name;
                  daySkills[skillName] = (daySkills[skillName] || 0) + 1;
                  break;
              }

              dayLinesAdded += linesAdded;
              dayLinesRemoved += linesRemoved;
              dayToolCalls++;
              dayTools[toolName] = (dayTools[toolName] || 0) + 1;

              if (language) {
                dayLanguages[language] = (dayLanguages[language] || 0) + 1;
              }
              if (detectedFramework) {
                dayFrameworks[detectedFramework] =
                  (dayFrameworks[detectedFramework] || 0) + 1;
              }

              // Track file activity
              if (filePath) {
                const fa = dayFileMap.get(filePath) || {
                  edits: 0,
                  writes: 0,
                  reads: 0,
                  added: 0,
                  removed: 0,
                  lang: language || "",
                };
                if (toolName === "Edit") fa.edits++;
                if (toolName === "Write") fa.writes++;
                if (toolName === "Read") fa.reads++;
                fa.added += linesAdded;
                fa.removed += linesRemoved;
                dayFileMap.set(filePath, fa);
              }

              insertEvent.run(
                sessionId,
                toolName,
                evtTime,
                filePath,
                language,
                linesAdded,
                linesRemoved,
                command,
                detectedFramework,
                commandFailed,
                searchPattern,
                agentType,
                agentDesc,
                skillName,
                skillArgs,
                "{}"
              );
              totalEvents++;
            }
          }

          // Insert daily summary
          insertSummary.run(
            date,
            proj.name,
            projSessionCount,
            dayDuration,
            dayLinesAdded,
            dayLinesRemoved,
            dayLinesAdded - dayLinesRemoved,
            dayFilesCreated,
            dayFilesEdited,
            dayFilesRead,
            dayToolCalls,
            dayBashCommands,
            dayBashFailures,
            daySearches,
            dayAgents,
            JSON.stringify(daySkills),
            JSON.stringify(dayFrameworks),
            JSON.stringify(dayLanguages),
            JSON.stringify(dayTools)
          );
          totalSummaries++;

          // Insert file activity
          for (const [fp, fa] of dayFileMap) {
            insertFileActivity.run(
              fp,
              proj.name,
              date,
              fa.edits,
              fa.writes,
              fa.reads,
              fa.added,
              fa.removed,
              fa.lang
            );
            totalFileActivity++;
          }
        }
      }
    });

    insertAll();

    return Response.json({
      ok: true,
      inserted: {
        sessions: totalSessions,
        toolEvents: totalEvents,
        dailySummaries: totalSummaries,
        fileActivity: totalFileActivity,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
