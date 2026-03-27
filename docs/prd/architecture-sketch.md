# Claude Pulse -- Architecture Sketch

*Generated: 2026-03-27*

---

## System Overview

```
 ┌─────────────────────────────────────────────────────────────────────┐
 │                     Developer's Machine                            │
 │                                                                    │
 │  ┌──────────┐  ┌──────────┐  ┌──────────┐                         │
 │  │ Terminal  │  │ Terminal  │  │ Terminal  │   Claude Code          │
 │  │ Session 1 │  │ Session 2 │  │ Session 3 │   Instances            │
 │  └────┬─────┘  └────┬─────┘  └────┬─────┘                         │
 │       │              │              │                               │
 │       │  PostToolUse / SessionStart / Stop / TaskCreated            │
 │       │  (JSON on stdin)                                            │
 │       ▼              ▼              ▼                               │
 │  ┌──────────────────────────────────────────┐                      │
 │  │            hook.sh  (POSIX shell + jq)   │                      │
 │  │                                          │                      │
 │  │  1. Parse JSON stdin                     │                      │
 │  │  2. Extract metadata (tool, files, etc.) │                      │
 │  │  3. Write event to SQLite via sqlite3    │◄──── Context Query   │
 │  │  4. Query recent activity (SessionStart) │                      │
 │  │  5. Output additionalContext JSON        │                      │
 │  └──────────┬──────────────┬────────────────┘                      │
 │             │              │                                        │
 │        INSERT          SELECT (SessionStart only)                   │
 │             │              │                                        │
 │             ▼              ▼                                        │
 │  ┌──────────────────────────────────────────┐                      │
 │  │     ~/.claude-pulse/tracker.db           │                      │
 │  │     SQLite 3 + WAL mode                  │                      │
 │  │                                          │                      │
 │  │  Tables:                                 │                      │
 │  │   - sessions                             │                      │
 │  │   - tool_events (append-only)            │                      │
 │  │   - projects                             │                      │
 │  │   - daily_summaries (pre-computed)       │                      │
 │  │   - plan_snapshots                       │                      │
 │  │   - settings                             │                      │
 │  │   - schema_version                       │                      │
 │  └──────────┬───────────────────────────────┘                      │
 │             │                                                       │
 │        SELECT (read-only)                                           │
 │             │                                                       │
 │             ▼                                                       │
 │  ┌──────────────────────────────────────────┐                      │
 │  │   Dashboard — Next.js on :3141           │                      │
 │  │                                          │                      │
 │  │   /overview    — KPIs, charts, trends    │                      │
 │  │   /projects    — project listing         │                      │
 │  │   /projects/:id — project detail         │                      │
 │  │   /timeline    — calendar heatmap        │                      │
 │  │   /sessions/:id — session detail         │                      │
 │  │   /settings    — config, export, purge   │                      │
 │  └──────────────────────────────────────────┘                      │
 │                                                                    │
 │  ┌─────────────────────┐  ┌─────────────────────┐                  │
 │  │  CLI (node)         │  │  MCP Server (v2+)   │                  │
 │  │  claude-pulse init  │  │  Query tools for     │                  │
 │  │  claude-pulse start │  │  in-session access   │                  │
 │  │  claude-pulse status│  │                      │                  │
 │  └─────────────────────┘  └─────────────────────┘                  │
 │                                                                    │
 │  Optional reads:                                                   │
 │  .lazy/plan.json  ──►  plan status injection                       │
 │  .claude/ralph-loop.local.md  ──►  iteration injection             │
 └─────────────────────────────────────────────────────────────────────┘
```

**Data flow direction:** Claude Code terminals push events DOWN through hook.sh into SQLite. The dashboard reads UP from SQLite. Context injection flows BACK from SQLite through hook.sh stdout into Claude Code sessions.

---

## Component Inventory

### 1. Hook Script

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Capture Claude Code hook events, write to SQLite, inject context back on SessionStart |
| **Inputs** | JSON on stdin from Claude Code hooks (PostToolUse, SessionStart, Stop, StopFailure, TaskCreated, CwdChanged, PreCompact) |
| **Outputs** | SQLite INSERT statements; stdout JSON with `additionalContext` on SessionStart and file-hotspot PostToolUse events |
| **Technology** | POSIX shell (`#!/bin/sh`), `jq` for JSON parsing, `sqlite3` CLI for database writes |
| **Location** | `~/.claude-pulse/hook.sh` (single script, event type passed as argument or detected from JSON) |
| **Decision** | **Build.** No existing tool captures Claude Code hook events. Shell chosen over Node.js for sub-100ms execution with zero startup overhead. |

### 2. SQLite Database

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Persistent, local-only storage for all activity data |
| **Inputs** | INSERT statements from hook.sh; UPDATE/DELETE from CLI (retention purge) |
| **Outputs** | SELECT results to dashboard (via better-sqlite3), hook.sh (via sqlite3 CLI), and MCP server |
| **Technology** | SQLite 3 with WAL journal mode, schema versioning via `schema_version` table |
| **Location** | `~/.claude-pulse/tracker.db` |
| **Decision** | **Build schema, integrate SQLite.** SQLite is the only database that satisfies local-only, zero-config, concurrent WAL writes, and file-based portability. No alternatives considered. |

### 3. Dashboard

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Visual display of activity data: KPIs, charts, timelines, session drill-down |
| **Inputs** | SQLite reads via `better-sqlite3` (server-side) |
| **Outputs** | HTML pages on localhost:3141 |
| **Technology** | Next.js 14+ (App Router), React, Tailwind CSS, Recharts (charts), `better-sqlite3` (database access) |
| **Pages** | Overview, Projects, Project Detail, Timeline, Session Detail, Settings |
| **Decision** | **Build.** Next.js chosen for SSR capability (fast initial paint), built-in API routes (no separate backend), and ecosystem maturity. Recharts chosen over D3 for simplicity. |

### 4. CLI

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Installation, configuration, dashboard lifecycle, status checks |
| **Inputs** | Command-line arguments |
| **Outputs** | File system modifications (hooks, DB init), process management (dashboard server), terminal output |
| **Technology** | Node.js, Commander.js for arg parsing |
| **Commands** | `init`, `start`, `stop`, `status`, `uninstall`, `export`, `purge` |
| **Decision** | **Build.** The CLI is the entry point for all user interaction outside the dashboard. Node.js chosen because the dashboard already requires it, avoiding a second runtime. |

### 5. Context Injector

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Feed historical activity summaries back into Claude Code sessions via hook stdout |
| **Inputs** | SQLite queries (recent sessions, file edit counts, plan state) |
| **Outputs** | JSON on stdout: `{"hookSpecificOutput":{"additionalContext":"..."}}` |
| **Technology** | Part of hook.sh (SessionStart path) and PostToolUse path (hotspot warnings) |
| **Constraints** | Output must never exceed 2000 characters (FR-CTX-6). Must complete within hook timeout (100ms target). |
| **Decision** | **Build.** This is the core differentiator -- no existing tool provides context injection into Claude Code sessions. Implemented as a code path within hook.sh rather than a separate process to avoid latency. |

### 6. MCP Server (v2+)

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Expose activity data as MCP tools queryable from within Claude Code sessions |
| **Inputs** | MCP tool calls from Claude Code |
| **Outputs** | JSON responses (project stats, recent events, session history) |
| **Technology** | Node.js, `@modelcontextprotocol/sdk`, `better-sqlite3` |
| **Tools** | `get_recent_events`, `get_project_stats`, `get_session_history`, `get_file_activity`, `get_daily_summary` |
| **Decision** | **Build (v2+).** Deferred from v1 to reduce scope. The `/pulse` skill and SessionStart injection cover the initial context-sharing need. |

### 7. Aggregator

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Compute daily_summaries from raw tool_events; run retention purges |
| **Inputs** | Raw tool_events rows in SQLite |
| **Outputs** | daily_summaries rows; deleted expired rows |
| **Technology** | SQL queries executed by hook.sh (on first event of a new day) or by CLI (`claude-pulse purge`) |
| **Trigger** | Lazy evaluation: on first event after midnight, compute previous day's summary. Also runnable via CLI on demand. |
| **Decision** | **Build.** Implemented as SQL statements rather than a separate daemon to avoid background processes. The hook detects day boundaries and triggers aggregation inline. |

---

## Data Flow

### Event Capture Flow (every tool call)

```
Step 1: Developer uses Claude Code. Claude invokes a tool (e.g., Edit).
        Claude Code fires the PostToolUse hook.

Step 2: Claude Code pipes JSON to hook.sh stdin:
        {
          "hook_type": "PostToolUse",
          "tool_name": "Edit",
          "tool_input": { "file_path": "/src/app.tsx", "old_string": "...", "new_string": "..." },
          "session_id": "abc123",
          "cwd": "/Users/dev/my-project"
        }

Step 3: hook.sh parses JSON with jq, extracts:
        - tool_name, file_path, session_id, cwd
        - Computes: project (git repo name), language (from extension),
          lines_added/removed (for Edit/Write), framework (for Bash)

Step 4: hook.sh writes to SQLite via sqlite3 CLI:
        INSERT INTO tool_events (timestamp, session_id, project_id, tool_name,
          file_path, language, lines_added, lines_removed, metadata)
        VALUES (...);

Step 5: hook.sh checks for day boundary. If first event of new day:
        INSERT INTO daily_summaries SELECT ... FROM tool_events
        WHERE date = yesterday GROUP BY ...;

Step 6: For PostToolUse Edit/Write -- check file hotspot:
        SELECT COUNT(*) FROM tool_events
        WHERE session_id = ? AND file_path = ? AND tool_name IN ('Edit','Write');
        If count > threshold (default 20):
          Output: {"hookSpecificOutput":{"additionalContext":"Warning: ..."}}

Step 7: hook.sh exits 0. Total time target: <100ms.
```

### Context Injection Flow (session start)

```
Step 1: Developer starts a new Claude Code session.
        Claude Code fires SessionStart hook.

Step 2: hook.sh receives SessionStart JSON with cwd and session_id.

Step 3: hook.sh resolves project from cwd (git repo root).

Step 4: hook.sh queries SQLite for recent context:
        a) Last session in this project (duration, files edited, tools used)
        b) Today's cross-project summary (sessions, events, top projects)
        c) Check for .lazy/plan.json -- parse task progress if present
        d) Check for .claude/ralph-loop.local.md -- parse iteration if present

Step 5: hook.sh assembles additionalContext string (max 2000 chars):
        "Last session: 23min, 47 tool calls, edited 8 files in my-project.
         Today across all projects: 3 sessions, 142 events.
         Plan: 3/5 tasks complete (phase: implementation)."

Step 6: hook.sh outputs to stdout:
        {"hookSpecificOutput":{"additionalContext":"Last session: ..."}}

Step 7: Claude Code injects this context into the session.
        The AI now "knows" what the developer was doing previously.
```

### Dashboard Read Flow

```
Step 1: Developer runs `claude-pulse start` or `npx claude-pulse`.

Step 2: Next.js server starts on localhost:3141.

Step 3: Server-side components open ~/.claude-pulse/tracker.db
        via better-sqlite3 (synchronous, read-only connection).

Step 4: Each page queries the database directly:
        - Overview: SELECT from daily_summaries + aggregate tool_events
        - Projects: SELECT from projects JOIN tool_events
        - Timeline: SELECT date, count(*) FROM tool_events GROUP BY date
        - Session: SELECT from tool_events WHERE session_id = ?

Step 5: React renders charts (Recharts) and tables.
        No API layer -- server components query DB directly.

Step 6: Dashboard auto-refreshes every 30 seconds (configurable)
        to pick up new events from active sessions.
```

---

## Key Technical Decisions

### KTD-1: POSIX Shell for Hook Script (not Node.js)

**Decision:** The hook script is written in POSIX shell (`/bin/sh`) using `jq` and `sqlite3` CLI tools.

**Rationale:**
- Node.js cold start is 80-150ms. Shell + jq + sqlite3 completes in 10-30ms.
- NFR-1 requires 95th percentile under 100ms. Node.js cannot reliably meet this.
- Shell has zero dependencies beyond jq and sqlite3, both widely available.
- The hook performs exactly three operations (parse, insert, optional query) -- a full runtime is unnecessary.

**Trade-off:** Shell is harder to test, harder to maintain for complex logic, and lacks type safety. Mitigated by keeping the script under 200 lines and testing via integration tests that pipe JSON and check DB state.

### KTD-2: SQLite with WAL Mode (not file-per-event, not PostgreSQL)

**Decision:** Single SQLite database at `~/.claude-pulse/tracker.db` with WAL journal mode.

**Rationale:**
- WAL mode allows concurrent readers (dashboard) and writers (multiple hooks) without blocking.
- SQLite is the only zero-config database that requires no daemon, no port, no auth.
- File-per-event would create thousands of files and require aggregation at query time.
- PostgreSQL/MySQL require a running server, defeating the local-first constraint.
- SQLite handles 500 events/day trivially (designed for millions of rows).

**Trade-off:** SQLite does not support remote access or multi-machine sync. Acceptable because Claude Pulse is explicitly local-only in v1.

### KTD-3: Next.js with Server Components (not plain HTML, not Electron)

**Decision:** Dashboard built with Next.js App Router using React Server Components.

**Rationale:**
- Server Components query SQLite directly via `better-sqlite3` -- no separate API server needed.
- SSR delivers fast First Contentful Paint (NFR-2: under 2 seconds).
- Next.js is a single dependency that bundles server, routing, and build tooling.
- Plain HTML + fetch would require a separate API server. Electron would add 200MB+ to install size.
- Recharts provides declarative chart components without D3's complexity.

**Trade-off:** Next.js adds ~80MB to `node_modules`. Acceptable for a developer tool where npm is already present. Production build (`next build`) produces a standalone server for fast startup (NFR-10: under 2 seconds).

### KTD-4: Global Hooks in ~/.claude/settings.json (not project-level)

**Decision:** Claude Pulse hooks are installed globally in `~/.claude/settings.json`, not per-project.

**Rationale:**
- Global hooks fire for ALL projects automatically. No per-project setup required.
- Claude Code merges global and project hooks (additive), so global installation is safe and does not interfere with project-specific hooks.
- Cross-project tracking (FR-DASH-1, success criteria #6) requires a single hook that captures all activity regardless of which project is active.
- Per-project hooks would require running `init` in every repository.

**Trade-off:** Users cannot disable tracking for specific projects via project hooks. Mitigated by adding a project ignore list in `~/.claude-pulse/config.json` that the hook checks before writing.

### KTD-5: Granular Append-Only Events (not pre-aggregated)

**Decision:** Every tool call is stored as an individual row in `tool_events`. Aggregation into `daily_summaries` happens lazily.

**Rationale:**
- Granular events enable drill-down to any session or file (FR-DASH-8).
- Pre-aggregation would lose the ability to reconstruct timelines or compute new metrics.
- Append-only writes are the fastest SQLite operation (no read-before-write).
- Retention policy (DR-5: 90 days default) bounds storage growth.
- Daily summaries are computed once per day and preserved indefinitely, ensuring historical trends survive event purges.

**Trade-off:** More storage than summary-only (estimated 90MB for 90 days at heavy usage vs. ~1MB for summaries alone). Acceptable given modern disk sizes.

### KTD-6: Context Injection in Hook (not separate daemon)

**Decision:** Context injection (additionalContext output) runs inline within hook.sh during SessionStart, not via a separate long-running process.

**Rationale:**
- No background daemon to manage, monitor, or restart.
- SessionStart fires once per session -- the query cost (one SELECT with LIMIT) is negligible.
- The hook already has access to stdin JSON and sqlite3.
- A daemon would add operational complexity (startup on boot, crash recovery, port management).

**Trade-off:** Context injection is limited to hook events (SessionStart, PostToolUse). Cannot proactively push context mid-session. Mitigated by the MCP server (v2+) and `/pulse` skill which provide on-demand querying.

### KTD-7: Single Hook Script with Event Routing (not one script per hook type)

**Decision:** One `hook.sh` script handles all hook types, with internal branching based on the `hook_type` field in the JSON input.

**Rationale:**
- Single file to install, update, and debug.
- Shared utility functions (project detection, language mapping, DB path resolution) are defined once.
- Claude Code settings.json references the same script path for all hook types, with the hook type distinguishable from the input JSON.

**Trade-off:** Script grows larger as more hook types are handled. Mitigated by keeping each handler under 30 lines and extracting shared logic into shell functions at the top of the script.

---

## Build vs Buy vs Integrate

| Component | Decision | Justification |
|-----------|----------|---------------|
| **Hook Script** | **Build** | Nothing exists for Claude Code hook capture. This is the core innovation. |
| **SQLite** | **Integrate** | Use system sqlite3 CLI (hooks) and better-sqlite3 npm package (dashboard). Do not build a database. |
| **jq** | **Integrate** | System dependency for JSON parsing in shell. Universally available, battle-tested. |
| **Next.js** | **Integrate** | Web framework for dashboard. Use as-is with App Router and Server Components. |
| **Recharts** | **Integrate** | Chart library for dashboard visualizations. Declarative React API, no custom charting needed. |
| **better-sqlite3** | **Integrate** | Synchronous SQLite bindings for Node.js. Used by dashboard server components for direct DB access. |
| **Commander.js** | **Integrate** | CLI argument parsing. Standard Node.js CLI framework. |
| **Dashboard UI** | **Build** | No existing dashboard understands Claude Code tool events. All pages are custom. |
| **CLI** | **Build** | Installation, lifecycle management, and configuration are Claude Pulse-specific. |
| **Context Injector** | **Build** | The feedback loop is the product differentiator. No equivalent exists. |
| **Aggregator** | **Build** | SQL aggregation queries specific to the Claude Pulse schema. Trivial to implement. |
| **MCP Server (v2+)** | **Build** | Custom MCP tools exposing Claude Pulse queries. Uses MCP SDK as foundation. |
| **Tailwind CSS** | **Integrate** | Utility CSS framework. Avoids writing custom stylesheets. |

---

## Cost Estimation

### Infrastructure Cost

**Zero.** Claude Pulse is fully local. No cloud services, no APIs, no subscriptions, no telemetry endpoints.

| Resource | Cost |
|----------|------|
| Cloud hosting | $0 -- local only |
| Database hosting | $0 -- SQLite file |
| CDN / assets | $0 -- bundled |
| API calls | $0 -- no external APIs |
| SSL certificates | $0 -- localhost only |

### Package Size

| Component | Estimated Size |
|-----------|---------------|
| hook.sh (shell script) | ~5 KB |
| CLI (Node.js, bundled) | ~2 MB |
| Dashboard (Next.js production build) | ~30 MB |
| node_modules (installed) | ~80 MB |
| **Total npm package (published)** | **~35 MB** |
| **Total installed footprint** | **~85 MB** |

### Database Size Estimates

| Usage Level | Events/Day | 90-Day Event Storage | Annual Summaries | Total |
|-------------|:---------:|:-------------------:|:---------------:|:-----:|
| Light (hobby) | 50 | ~9 MB | ~365 KB | ~10 MB |
| Medium (professional) | 200 | ~36 MB | ~365 KB | ~37 MB |
| Heavy (power user) | 500 | ~90 MB | ~365 KB | ~91 MB |
| Extreme (multi-agent) | 1000 | ~180 MB | ~365 KB | ~181 MB |

Calculation basis: average event record size of 2 KB (DR-1), daily summary of 1 KB (DR-3).

With 90-day retention (default), event storage is bounded. Daily summaries accumulate at ~365 KB/year indefinitely.

### System Dependencies (pre-existing)

| Dependency | Required | Typically Present |
|------------|----------|-------------------|
| Node.js 18+ | Yes (dashboard, CLI) | Yes -- Claude Code requires it |
| sqlite3 CLI | Yes (hooks) | Yes -- pre-installed on macOS; `apt install sqlite3` on Linux |
| jq | Yes (hooks) | Often present; `brew install jq` / `apt install jq` if missing |
| Git | Yes (project detection) | Yes -- developers have git |

---

## Deployment Topology

```
~/.claude-pulse/                    <-- Created by `claude-pulse init`
├── tracker.db                      <-- SQLite database (WAL mode)
├── tracker.db-wal                  <-- WAL file (auto-managed by SQLite)
├── tracker.db-shm                  <-- Shared memory file (auto-managed)
├── hook.sh                         <-- POSIX shell hook script (~200 lines)
├── config.json                     <-- User configuration
│   ├── retention_days_events: 90
│   ├── retention_days_sessions: 180
│   ├── hotspot_threshold: 20
│   ├── context_injection: true
│   ├── ignored_projects: []
│   └── dashboard_port: 3141
└── backups/                        <-- settings.json backups from init

~/.claude/settings.json             <-- Modified by `claude-pulse init`
└── hooks:
    ├── PostToolUse:
    │   └── { command: "~/.claude-pulse/hook.sh", timeout: 3000 }
    ├── SessionStart:
    │   └── { command: "~/.claude-pulse/hook.sh", timeout: 5000 }
    ├── Stop:
    │   └── { command: "~/.claude-pulse/hook.sh", timeout: 3000 }
    ├── StopFailure:
    │   └── { command: "~/.claude-pulse/hook.sh", timeout: 3000 }
    ├── TaskCreated:
    │   └── { command: "~/.claude-pulse/hook.sh", timeout: 3000 }
    └── CwdChanged:
        └── { command: "~/.claude-pulse/hook.sh", timeout: 3000 }

Global npm package (or npx):
└── claude-pulse
    ├── bin/claude-pulse              <-- CLI entry point
    ├── dist/                         <-- Next.js production build
    └── package.json
```

### Process Model

| Process | Lifecycle | Port |
|---------|-----------|------|
| hook.sh | Ephemeral -- spawned by Claude Code per hook event, exits in <100ms | None |
| Dashboard (Next.js) | Long-running -- started by `claude-pulse start`, stopped by `claude-pulse stop` or Ctrl+C | 3141 |
| MCP Server (v2+) | Long-running -- started by `claude-pulse mcp start` | Configured in MCP settings |

There are no background daemons. The hook script is stateless and ephemeral. The dashboard server is explicitly started and stopped by the user. No cron jobs, no launchd agents, no systemd services.

### Security Model

| Concern | Mitigation |
|---------|------------|
| Data privacy | No conversation content stored (FR-CAP-8, NFR-6). Only tool metadata. |
| Network exposure | Dashboard binds to localhost only. No outbound connections (NFR-5). |
| File permissions | tracker.db created with 600 permissions (owner read/write only). |
| Hook failure isolation | Hook exits 0 on any error (NFR-9). Never outputs invalid JSON. Never blocks Claude Code. |
| Settings.json safety | Backup created before every modification (FR-INST-4). Merge is additive, never destructive (FR-INST-2). |

---

## Database Schema

```sql
-- Schema version tracking
CREATE TABLE schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Projects detected from git repos
CREATE TABLE projects (
    id TEXT PRIMARY KEY,            -- git repo name or directory name
    path TEXT NOT NULL,             -- absolute path to repo root
    first_seen TEXT NOT NULL,
    last_active TEXT NOT NULL
);

-- Session lifecycle
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,            -- Claude Code session ID
    project_id TEXT REFERENCES projects(id),
    start_time TEXT NOT NULL,
    end_time TEXT,
    duration_seconds INTEGER,
    status TEXT DEFAULT 'active',   -- active, completed, crashed
    error TEXT,                     -- populated on StopFailure
    total_events INTEGER DEFAULT 0
);

-- Granular tool events (append-only)
CREATE TABLE tool_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    session_id TEXT NOT NULL REFERENCES sessions(id),
    project_id TEXT NOT NULL REFERENCES projects(id),
    tool_name TEXT NOT NULL,        -- Edit, Write, Bash, Read, Glob, Grep, Agent, Skill
    file_path TEXT,
    language TEXT,                  -- detected from extension
    framework TEXT,                 -- detected from Bash commands
    lines_added INTEGER DEFAULT 0,
    lines_removed INTEGER DEFAULT 0,
    metadata TEXT                   -- JSON blob for tool-specific data
);

-- Pre-computed daily summaries (survive event retention purge)
CREATE TABLE daily_summaries (
    date TEXT PRIMARY KEY,          -- YYYY-MM-DD
    project_id TEXT REFERENCES projects(id),
    total_events INTEGER,
    events_by_tool TEXT,            -- JSON: {"Edit": 45, "Bash": 23, ...}
    total_lines_added INTEGER,
    total_lines_removed INTEGER,
    session_count INTEGER,
    unique_files INTEGER,
    top_files TEXT,                 -- JSON: [{"path": "...", "edits": 12}, ...]
    top_frameworks TEXT,            -- JSON: ["npm/node", "cargo/rust", ...]
    top_skills TEXT,                -- JSON: ["investigate", "commit", ...]
    computed_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(date, project_id)
);

-- Plan snapshots from lazy-fetch / Ralph Loop
CREATE TABLE plan_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT REFERENCES projects(id),
    source TEXT NOT NULL,           -- 'lazy-fetch' or 'ralph-loop'
    snapshot_time TEXT NOT NULL,
    data TEXT NOT NULL              -- JSON of parsed plan state
);

-- User settings (key-value)
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Indexes for common query patterns
CREATE INDEX idx_events_session ON tool_events(session_id);
CREATE INDEX idx_events_project ON tool_events(project_id);
CREATE INDEX idx_events_timestamp ON tool_events(timestamp);
CREATE INDEX idx_events_file ON tool_events(file_path);
CREATE INDEX idx_events_tool ON tool_events(tool_name);
CREATE INDEX idx_sessions_project ON sessions(project_id);
CREATE INDEX idx_summaries_project ON daily_summaries(project_id);
```

---

## Version Roadmap Alignment

| Version | Components | Status |
|---------|-----------|--------|
| **v1.0** | Hook script, SQLite schema, CLI (init/start/stop/uninstall), Dashboard (all 6 pages) | Architecture defined above |
| **v1.1** | Context injection (SessionStart summary, file hotspot warnings) | Hook.sh additions, no new components |
| **v2.0** | MCP server, `/pulse` skill, lazy-fetch/Ralph Loop integration, plan tracking dashboard | New component (MCP server), dashboard page additions |
| **v2.1** | Export formats (JSON, CSV), advanced analytics, session comparison | Dashboard features, CLI additions |

---

## Open Questions

1. **Hook argument passing:** Does Claude Code pass the hook type as an argument to the script, or must hook.sh detect it from the JSON stdin structure? This affects how a single script handles multiple event types.

2. **Session ID availability:** Is `session_id` present in all hook JSON payloads, or only in SessionStart? If not universally available, the hook must maintain a session ID mapping file.

3. **daily_summaries composite key:** Should daily_summaries be keyed by `(date, project_id)` for per-project summaries, or just `date` for global summaries? The schema above uses a composite key. The dashboard needs both views.

4. **Dashboard bundling strategy:** Ship as a pre-built Next.js standalone output (fast startup, larger package) or build on first `claude-pulse start` (slower first run, smaller package)?

5. **Plan correlation accuracy (FR-PLAN-3):** Correlating tool events to plan tasks by time window is approximate. Should we provide a manual "tag this session to task X" mechanism as a fallback?
