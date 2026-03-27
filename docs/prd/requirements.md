# Claude Pulse -- Requirements Specification

*Generated: 2026-03-27*

---

## 1. Functional Requirements -- Data Capture (FR-CAP)

| ID | Requirement | Description | Testable Criteria |
|----|-------------|-------------|-------------------|
| FR-CAP-1 | Track every tool call with full metadata | Record each PostToolUse event including tool_name, tool_input (file_path, old_string/new_string, content, command, subagent_type, description, skill, args), timestamp, session ID, and project ID. | Given a Claude Code session that invokes Edit, Write, Bash, Agent, Skill, Read, Glob, and Grep tools, verify that all 8 tool types appear in the `tool_events` table with correct tool_name and non-null tool_input JSON within 1 second of invocation. |
| FR-CAP-2 | Detect project from git repo name | On SessionStart and CwdChanged hooks, resolve the current working directory to a git repository root and extract the repo name as the project identifier. | Given a session started in `/home/user/projects/my-app` (a git repo), verify the `projects` table contains an entry with name "my-app" and the correct absolute path. Given a non-git directory, verify the directory name is used as fallback. |
| FR-CAP-3 | Detect file language from extension | Map file extensions to programming languages for every file-related tool event (Edit, Write, Read, Glob, Grep). | Given tool events touching files with extensions .ts, .py, .rs, .go, .java, .rb, .css, .html, .json, .md, verify each event record contains the correct language string (e.g., "typescript", "python", "rust"). Verify unknown extensions store "unknown". |
| FR-CAP-4 | Detect framework from bash commands | Parse Bash tool_input.command to identify framework/toolchain usage (npm, yarn, pnpm, pip, cargo, docker, git, python, go, gradle, maven, mix, bundle, composer, dotnet). | Given a Bash event with command `npm run build`, verify the event is tagged with framework "npm/node". Given `cargo test --release`, verify framework "cargo/rust". Verify at least 10 distinct framework patterns are recognized. |
| FR-CAP-5 | Track session lifecycle | Record session start (SessionStart hook), session end (Stop hook), compute duration, and detect crashes (StopFailure hook). | Given a normal session from start to stop, verify sessions table contains start_time, end_time, and duration_seconds > 0. Given a StopFailure event, verify the session record has status "crashed" and a non-null error field. |
| FR-CAP-6 | Track code changes per file | For Edit events, compute lines added and lines removed by diffing old_string against new_string. For Write events, count total lines as lines added. | Given an Edit event that replaces 3 lines with 5 lines, verify lines_added = 5 and lines_removed = 3. Given a Write event creating a 100-line file, verify lines_added = 100 and lines_removed = 0. |
| FR-CAP-7 | Aggregate daily summaries | At the end of each day (or on first event of the next day), compute and store daily summary: total events, events by tool type, total lines added/removed, active sessions, unique files touched, unique projects. | Given 50 tool events across 2 sessions in one day, verify the `daily_summaries` table contains one row for that date with correct totals matching the sum of individual event records. |
| FR-CAP-8 | No conversation content stored | Ensure that no user prompts, assistant responses, or conversation text is captured or stored. Only tool metadata and code diffs are recorded. | Inspect all hook scripts and verify no stdin fields beyond tool_name and tool_input are persisted. Run a session with sensitive conversation content and verify no conversation text appears anywhere in the database. |

---

## 2. Functional Requirements -- Dashboard (FR-DASH)

| ID | Requirement | Description | Testable Criteria |
|----|-------------|-------------|-------------------|
| FR-DASH-1 | Overview page with global KPIs | Display total sessions, total tool calls, total lines changed, total projects, and active days. Include a daily activity chart (bar or area) for the last 30 days. | Load the overview page with 30 days of data. Verify all 5 KPI values are rendered and match database aggregates. Verify the chart has 30 data points. Page loads in under 2 seconds. |
| FR-DASH-2 | Overview tool distribution | Show a breakdown of tool usage by type (Edit, Write, Bash, Read, Glob, Grep, Agent, Skill) as a pie or bar chart on the overview page. | Given events with all 8 tool types, verify each type appears in the chart with correct counts matching `SELECT tool_name, COUNT(*) FROM tool_events GROUP BY tool_name`. |
| FR-DASH-3 | Overview skills and frameworks | Display the top 10 detected frameworks and top 10 used skills on the overview page. | Given events with 12 distinct frameworks, verify only the top 10 by count are displayed, sorted descending. |
| FR-DASH-4 | Projects listing page | Show all tracked projects with columns: project name, total sessions, total events, total lines changed, last active date. Support sorting by each column. | Given 5 projects, verify all 5 appear. Click each column header and verify rows reorder correctly (ascending then descending toggle). |
| FR-DASH-5 | Project detail page | For a selected project, display: project-specific KPIs (sessions, events, lines changed, active days), daily activity chart, most-edited files (top 10), and session list with timestamps and duration. | Navigate to a project with 20 sessions and 500 events. Verify KPIs match project-filtered aggregates. Verify most-edited files list shows up to 10 entries sorted by edit count descending. |
| FR-DASH-6 | Timeline calendar heatmap | Display a GitHub-style contribution heatmap showing daily activity intensity for the past 365 days. Color intensity maps to event count quartiles. | Given 365 days of data with varying activity (0 to 100 events/day), verify 365 cells render. Verify days with 0 events show the lightest color. Verify the most active day shows the darkest color. Click a day cell and verify it navigates to or reveals that day's breakdown. |
| FR-DASH-7 | Timeline daily breakdown | When a day is selected on the timeline, show that day's sessions, event count, top files, and top tools. | Select a day with 3 sessions and 45 events. Verify all 3 sessions are listed with correct start times. Verify event count shows 45. |
| FR-DASH-8 | Session detail page | For a selected session, display: chronological event timeline, files touched (unique list with edit counts), tools used (with counts), duration, and code change summary. | Navigate to a session with 30 events across 8 files using 4 tool types. Verify timeline shows 30 entries in chronological order. Verify files list shows 8 entries. Verify tool summary shows 4 tool types with correct counts. |
| FR-DASH-9 | Settings page -- export | Provide a button to export all data as a SQLite database file download and/or as JSON. | Click export SQLite button and verify a valid .db file downloads. Open it with sqlite3 and verify it contains all expected tables and row counts matching the source. |
| FR-DASH-10 | Settings page -- retention | Allow configuring retention period (default 90 days for events, indefinite for summaries). Display current database size. Provide a "purge now" button. | Set retention to 30 days. Click purge. Verify events older than 30 days are deleted. Verify daily summaries are not deleted. Verify database size value updates after purge. |
| FR-DASH-11 | Settings page -- hook status | Display the current installation status of all Claude Pulse hooks (registered, active, missing). Show last event timestamp as a health indicator. | With hooks properly installed, verify all hooks show "active" status. Remove one hook from settings.json, reload settings page, verify that hook shows "missing". |
| FR-DASH-12 | Dashboard responsive layout | Dashboard must be usable at viewport widths from 1024px to 2560px. | Load each page at 1024px, 1440px, and 2560px widths. Verify no horizontal scrollbar appears, no content is clipped, and charts resize proportionally. |

---

## 3. Functional Requirements -- Context Injection (FR-CTX)

| ID | Requirement | Description | Testable Criteria |
|----|-------------|-------------|-------------------|
| FR-CTX-1 | SessionStart summary injection | On SessionStart hook, query the database for the last session in the same project and inject a summary (duration, files edited, tools used, lines changed) via stdout JSON `additionalContext`. | Start a new session in a project with prior session data. Capture the hook's stdout. Verify it is valid JSON with an `additionalContext` string containing the previous session's duration, file count, and lines changed. |
| FR-CTX-2 | Plan status injection on session start | On SessionStart, if `.lazy/plan.json` or `.claude/ralph-loop.local.md` exists, include plan/iteration status in the injected context. | Create a `.lazy/plan.json` with 3 of 5 tasks completed. Start a session. Verify additionalContext includes "3/5 tasks completed" or equivalent summary. |
| FR-CTX-3 | File hotspot warnings | On PostToolUse for Edit/Write tools, if the target file has been edited more than N times (configurable, default 20) in the current session, include a warning in additionalContext. | Edit the same file 21 times in one session. Verify that the 21st Edit event's hook output includes additionalContext with a hotspot warning mentioning the file path and edit count. Verify edits 1-20 do not include this warning. |
| FR-CTX-4 | /pulse skill for summaries | Provide a `/pulse` skill that, when invoked, returns a cross-project summary: recent activity, active projects, productivity trends, current session stats. | Invoke `/pulse` in a session with data from 3 projects over 7 days. Verify the response includes all 3 project names, a 7-day trend indicator, and current session event count. |
| FR-CTX-5 | MCP server for on-demand queries | Expose an MCP server with tools for querying: recent events, project stats, session history, file activity, and daily summaries. | Start the MCP server. Call the `get_project_stats` tool for an existing project. Verify the response includes session count, event count, and lines changed matching database values. |
| FR-CTX-6 | Context injection size limit | Ensure injected additionalContext never exceeds 2000 characters to avoid bloating Claude's context window. | Generate a scenario where the summary would naturally exceed 2000 chars (e.g., 50 files edited). Verify the output is truncated or summarized to stay under 2000 characters. |

---

## 4. Functional Requirements -- Plan Tracking (FR-PLAN)

| ID | Requirement | Description | Testable Criteria |
|----|-------------|-------------|-------------------|
| FR-PLAN-1 | Read lazy-fetch plan.json | Parse `.lazy/plan.json` to extract sprint name, task list, task statuses (pending, in-progress, done), and phase groupings. | Given a plan.json with 2 phases and 8 tasks (3 done, 2 in-progress, 3 pending), verify the parsed output contains all 8 tasks with correct statuses and phase assignments. |
| FR-PLAN-2 | Read Ralph Loop state | Parse `.claude/ralph-loop.local.md` to extract current iteration number, loop status, and any recorded outcomes. | Given a ralph-loop.local.md at iteration 5, verify the parsed output includes iteration_count = 5 and the loop status string. |
| FR-PLAN-3 | Correlate plan tasks with coding activity | When a task transitions to "done" in plan.json, associate tool events that occurred between the task's start and completion timestamps with that task. | Mark task "implement auth" as done. Verify the task record in the database has associated_events containing the Edit/Write/Bash events that occurred during its active window. |
| FR-PLAN-4 | Dashboard plan progress display | Show plan progress on the project detail page: task list with statuses, completion percentage bar, phase breakdown, and estimated vs. actual time per task. | Navigate to a project with an active plan of 10 tasks (6 done). Verify the progress bar shows 60%. Verify all 10 tasks are listed with correct status icons. |
| FR-PLAN-5 | Plan change detection | Detect when plan.json is modified (via file watcher or on SessionStart) and update the stored plan snapshot. | Modify plan.json to add a new task. Start a new session or wait for the watcher interval. Verify the new task appears in the database and on the dashboard within 10 seconds. |

---

## 5. Functional Requirements -- Installation (FR-INST)

| ID | Requirement | Description | Testable Criteria |
|----|-------------|-------------|-------------------|
| FR-INST-1 | One-command install | `npx claude-pulse init` installs all hooks, creates the database directory (~/.claude-pulse/), initializes the SQLite database schema, and confirms success. | Run `npx claude-pulse init` on a clean system with no prior installation. Verify: ~/.claude-pulse/ directory exists, tracker.db exists with all expected tables, and settings.json contains all Claude Pulse hooks. |
| FR-INST-2 | Merge hooks into existing settings.json | Installation must read the existing ~/.claude/settings.json, merge Claude Pulse hooks into the hooks arrays without removing or duplicating existing hooks, and write back. | Given a settings.json with 2 existing PostToolUse hooks, run init. Verify the resulting settings.json contains the original 2 hooks plus the Claude Pulse hooks. Verify no duplicates exist. Run init again and verify no additional duplicates are created (idempotent). |
| FR-INST-3 | Dependency check | Before installation, verify that `jq` and `sqlite3` are available on the system PATH. If missing, display a clear error message naming the missing dependency and suggesting installation commands. | Run init on a system without jq installed. Verify the process exits with code 1 and the error message includes "jq" and a platform-appropriate install suggestion (e.g., `brew install jq` on macOS). |
| FR-INST-4 | Backup settings.json before modifying | Before any modification to settings.json, create a timestamped backup (e.g., settings.json.backup.20260327T143000). | Run init and verify a backup file exists in ~/.claude/ with a timestamp in the filename. Verify the backup content matches the original settings.json byte-for-byte. |
| FR-INST-5 | Uninstall command | `npx claude-pulse uninstall` removes all Claude Pulse hooks from settings.json (preserving other hooks), optionally deletes ~/.claude-pulse/ (with confirmation prompt), and confirms success. | Given settings.json with Claude Pulse hooks and 2 other hooks, run uninstall. Verify Claude Pulse hooks are removed. Verify the 2 other hooks remain intact. Verify ~/.claude-pulse/ is retained if user declines deletion. |
| FR-INST-6 | Database schema initialization | Create all required tables on first run: tool_events, sessions, projects, daily_summaries, plan_snapshots, settings. Use WAL journal mode. Include schema version tracking for future migrations. | After init, run `sqlite3 tracker.db ".tables"` and verify all 6 tables exist. Run `PRAGMA journal_mode` and verify it returns "wal". Verify a `schema_version` table or pragma exists with version 1. |
| FR-INST-7 | Cross-platform hook scripts | Hook scripts must work on both macOS (zsh default) and Linux (bash default). Use POSIX-compatible shell syntax or provide platform-specific variants. | Run the PostToolUse hook script on macOS (zsh) and Linux (bash). Verify both produce identical JSON output for the same input. Verify no bash-specific or zsh-specific syntax is used (shellcheck passes with `sh` dialect). |

---

## 6. Non-Functional Requirements (NFR)

| ID | Requirement | Description | Testable Criteria |
|----|-------------|-------------|-------------------|
| NFR-1 | Hook execution latency | All hook scripts must complete execution in under 100ms to avoid perceptibly slowing Claude Code. | Benchmark each hook script 100 times with realistic input. Verify the 95th percentile execution time is under 100ms. Verify no single execution exceeds 200ms. |
| NFR-2 | Dashboard page load time | Every dashboard page must reach First Contentful Paint within 2 seconds on localhost. | Using Lighthouse or equivalent, measure FCP for overview, projects, project detail, timeline, session detail, and settings pages. Verify all are under 2 seconds with a cold cache. |
| NFR-3 | Database write throughput | SQLite database must handle sustained writes of 500+ events per day (approximately 1 event every 2-3 seconds during active use) without write failures or lock contention. | Insert 1000 events in rapid succession (1ms interval) while simultaneously reading from the dashboard. Verify zero write failures. Verify database file is not corrupted (integrity_check passes). |
| NFR-4 | macOS and Linux support | All components (hooks, database, dashboard, CLI) must function correctly on macOS 12+ and Ubuntu 22.04+. | Run the full test suite on macOS (ARM and Intel) and Ubuntu 22.04. Verify all tests pass on all platforms with zero platform-specific failures. |
| NFR-5 | Zero network dependency | The entire system must function with no internet connection. No external API calls, CDN resources, or remote databases. | Disconnect from the network. Run init, start a Claude Code session, generate 50 events, open the dashboard, and verify all functionality works. Monitor network requests and verify zero outbound connections. |
| NFR-6 | Privacy -- no conversation content | No user prompts, assistant responses, or conversation content may be stored. Only structured tool metadata and code diffs are persisted. | Audit all hook scripts and database write paths. Verify no field captures free-text conversation content. Run a session with PII in conversation and verify no PII appears in any database table or log file. |
| NFR-7 | Database size management | Database size must remain manageable: under 200MB per year at heavy usage (500 events/day). Retention policies must be enforceable. | Simulate 1 year of heavy usage (500 events/day, ~1.5KB each). Verify total database size is under 200MB. Run retention purge at 90 days and verify size reduces proportionally. |
| NFR-8 | Concurrent access safety | The database must support concurrent reads (dashboard) and writes (hooks) without corruption or lock errors. WAL mode must be enabled. | Open 3 simultaneous dashboard connections performing reads while a hook writes 10 events per second for 60 seconds. Verify zero "database is locked" errors and zero data corruption. |
| NFR-9 | Graceful degradation on hook failure | If a hook script fails (e.g., database unavailable), it must exit silently with code 0 and not output invalid JSON. Claude Code must not be affected. | Kill the database process (or make tracker.db read-only). Trigger a PostToolUse hook. Verify the hook exits with code 0, produces no stdout (or valid empty JSON), and Claude Code continues normally. |
| NFR-10 | Startup time for dashboard | The Next.js dashboard dev server must start and be accessible within 5 seconds. Production build must start within 2 seconds. | Time `npm run dev` from invocation to first successful HTTP response on port 3141. Verify under 5 seconds. Time `npm start` (production) and verify under 2 seconds. |

---

## 7. Data Requirements (DR)

| ID | Requirement | Description | Testable Criteria |
|----|-------------|-------------|-------------------|
| DR-1 | Tool event record size | Each tool event record must average 1-2KB including all metadata fields. | Insert 1000 representative events (mix of all tool types with realistic inputs). Divide total database size increase by 1000. Verify average is between 0.5KB and 3KB. |
| DR-2 | Daily throughput capacity | System must handle up to 500 events per day under heavy usage without performance degradation. | Insert 500 events within a simulated 8-hour window. Verify all 500 are persisted. Verify dashboard query response times remain under 500ms for aggregate queries. |
| DR-3 | Daily summary record size | Each daily summary record must be approximately 1KB. | Generate 30 daily summaries. Verify average size is between 0.5KB and 2KB. |
| DR-4 | Session record size | Each session record must be approximately 500 bytes. | Insert 100 sessions with realistic metadata. Verify average size is between 200 bytes and 1KB. |
| DR-5 | Default retention policy | Events are retained for 90 days by default. Daily summaries are retained indefinitely. Sessions are retained for 180 days by default. | With default settings, insert events spanning 120 days. Run the retention cleanup. Verify events older than 90 days are deleted. Verify all daily summaries remain. Verify sessions older than 180 days are deleted. |
| DR-6 | Configurable retention | Users can configure retention periods via the settings page or CLI. Minimum allowed retention is 7 days for events. | Set event retention to 14 days via settings page. Run cleanup. Verify only events from the last 14 days remain. Attempt to set retention to 3 days and verify it is rejected with a validation error. |
| DR-7 | Annual storage estimate | At 500 events/day with 90-day retention, stored events should not exceed 150MB. With indefinite daily summaries, the summaries table should not exceed 1MB after 3 years. | Calculate: 500 events/day x 90 days x 2KB = ~90MB for events. 365 days x 3 years x 1KB = ~1MB for summaries. Verify these estimates via simulation and confirm total database stays under 200MB. |

---

## Traceability Matrix

| Category | ID Range | Count |
|----------|----------|:-----:|
| Data Capture | FR-CAP-1 to FR-CAP-8 | 8 |
| Dashboard | FR-DASH-1 to FR-DASH-12 | 12 |
| Context Injection | FR-CTX-1 to FR-CTX-6 | 6 |
| Plan Tracking | FR-PLAN-1 to FR-PLAN-5 | 5 |
| Installation | FR-INST-1 to FR-INST-7 | 7 |
| Non-Functional | NFR-1 to NFR-10 | 10 |
| Data | DR-1 to DR-7 | 7 |
| **Total** | | **55** |
