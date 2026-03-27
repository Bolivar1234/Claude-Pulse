# Claude Pulse -- Risk Matrix & Prioritized Roadmap

*Generated: 2026-03-27*

---

## Risk Matrix

| # | Risk | Category | Likelihood (1-5) | Impact (1-5) | Score | Mitigation |
|---|------|----------|:-:|:-:|:-:|------------|
| 1 | Claude Code updates break hook JSON format or remove/rename hook events | Platform | 4 | 5 | 20 | Pin to documented hook events only (PostToolUse, SessionStart, Stop, TaskCreated). Version-detect hook schema at startup. Maintain a compatibility shim layer. Monitor Anthropic changelog. |
| 2 | Anthropic builds native activity tracking into Claude Code, eliminating the need for Pulse | Product | 3 | 5 | 15 | Ship fast, build user habit and data moat before native alternative exists. Focus on context injection (the feedback loop) -- harder for a vendor to replicate without opinionation. Offer data export so users never feel locked in. |
| 3 | Hook script adds perceptible latency to Claude Code tool calls | Technical | 3 | 5 | 15 | Fire-and-forget SQLite writes (async background process). Benchmark every hook to stay under 50ms p95. Exit immediately on any error rather than retrying. Include latency self-test in `claude-pulse doctor`. |
| 4 | SQLite concurrent write contention from multiple terminals causes "database is locked" errors or data loss | Technical | 3 | 4 | 12 | Enable WAL mode (proven in prototype). Use short-lived write transactions. Implement exponential backoff retry (3 attempts, 10/50/200ms). Log dropped events to a recovery file for replay. |
| 5 | Hook installation overwrites or corrupts user's existing settings.json hooks | Technical | 3 | 4 | 12 | Read-merge-write strategy (never overwrite). Create timestamped backup before every modification (FR-INST-4). Dry-run mode (`--dry-run`) that shows diff before applying. Idempotent init (safe to run repeatedly). |
| 6 | jq or sqlite3 not installed on user's machine, blocking installation | Platform | 3 | 4 | 12 | Dependency check at init time (FR-INST-3) with platform-specific install suggestions. Long-term: replace jq with a Node.js JSON parser in the hook script to eliminate the dependency entirely. Consider bundling a statically-linked sqlite3 binary. |
| 14 | Hook script crashes emit invalid JSON to stdout, breaking Claude Code session | Technical | 2 | 5 | 10 | Wrap entire hook in try-catch equivalent (trap in shell). On any error, exit 0 with no stdout (NFR-9). Never let a tracking failure affect the developer's session. Test failure modes explicitly. |
| 7 | Database grows unbounded, consuming significant disk space over months | Technical | 3 | 3 | 9 | Default 90-day event retention with automatic cleanup (DR-5). Display database size on settings page (FR-DASH-10). Warn at 100MB. Target under 200MB/year at heavy usage. |
| 10 | macOS vs Linux differences in shell behavior (zsh vs bash, GNU vs BSD tools) break hook scripts | Platform | 3 | 3 | 9 | Use POSIX-compatible shell syntax only (FR-INST-7). Run shellcheck with `sh` dialect in CI. Test on macOS ARM, macOS Intel, and Ubuntu 22.04. Avoid GNU-specific flags (e.g., `date` formatting differs). |
| 11 | Metrics without actionable insights -- dashboard shows numbers but users don't know what to do with them | Product | 3 | 3 | 9 | Prioritize context injection and file hotspot warnings (FR-CTX-3) over passive charts. Add "insight cards" in Phase 3 that surface specific recommendations (e.g., "You edited auth.tsx 47 times across 3 sessions -- consider refactoring"). |
| 8 | Users install Pulse but never check the dashboard -- low engagement | Product | 4 | 2 | 8 | The feedback loop (context injection on SessionStart) delivers value without requiring dashboard visits. The `/pulse` skill provides summaries in-terminal. Dashboard is a bonus, not the core value. |
| 9 | Privacy backlash from developers concerned about what data is captured | Product | 2 | 4 | 8 | Structural privacy guarantee: no conversation content, no prompts, no assistant responses (FR-CAP-8, NFR-6). Open source for auditability. Document exactly what is stored in README and on settings page. Provide easy full-data-delete command. |
| 13 | Context injection produces stale, irrelevant, or overly verbose summaries that annoy users | Product | 2 | 3 | 6 | Enforce 2000-character limit (FR-CTX-6). Focus on same-project context by default. Make injection configurable (off/minimal/full). Iterate on summary templates based on user feedback. |
| 12 | Next.js version compatibility issues or heavy bundle size for a local dashboard | Platform | 2 | 3 | 6 | Pin Next.js version. Use static export where possible. Keep dependencies minimal. Consider fallback to a lighter framework (e.g., Vite + React) if Next.js proves too heavy for a local tool. |

**Sorted by risk score descending.**

---

## MoSCoW Prioritization

### Must Have (MVP-critical)

| ID | Requirement | Rationale |
|----|-------------|-----------|
| FR-CAP-1 | Track every tool call with full metadata | Core data capture -- without this, nothing works |
| FR-CAP-2 | Detect project from git repo name | Required for per-project views |
| FR-CAP-5 | Track session lifecycle | Sessions are the fundamental unit of work |
| FR-CAP-8 | No conversation content stored | Privacy is non-negotiable from day one |
| FR-DASH-1 | Overview page with global KPIs | The "one glance" value proposition |
| FR-DASH-2 | Overview tool distribution | Core insight: what tools are you using? |
| FR-DASH-4 | Projects listing page | Multi-project awareness is a key differentiator |
| FR-INST-1 | One-command install | 30-second install is a success criterion |
| FR-INST-2 | Merge hooks into existing settings.json | Safety -- cannot break existing user setup |
| FR-INST-3 | Dependency check | Prevents confusing failures on first run |
| FR-INST-4 | Backup settings.json before modifying | Safety net for hook installation |
| FR-INST-6 | Database schema initialization | Foundation for all data storage |
| NFR-1 | Hook execution latency < 100ms | Performance is a hard constraint |
| NFR-5 | Zero network dependency | Local-first is the product identity |
| NFR-6 | Privacy -- no conversation content | Structural privacy guarantee |
| NFR-8 | Concurrent access safety (WAL mode) | Multiple terminals is a common scenario |
| NFR-9 | Graceful degradation on hook failure | Pulse must never break Claude Code |
| DR-5 | Default retention policy | Prevents unbounded growth from day one |

### Should Have (Phase 2)

| ID | Requirement | Rationale |
|----|-------------|-----------|
| FR-CAP-3 | Detect file language from extension | Enriches data but not required for core tracking |
| FR-CAP-6 | Track code changes per file | Lines added/removed -- valuable but not blocking |
| FR-CAP-7 | Aggregate daily summaries | Performance optimization for dashboard queries |
| FR-CTX-1 | SessionStart summary injection | The feedback loop -- the real differentiator |
| FR-CTX-6 | Context injection size limit | Guard rail for context injection |
| FR-DASH-5 | Project detail page | Drill-down into individual projects |
| FR-DASH-6 | Timeline calendar heatmap | High-impact visualization for engagement |
| FR-DASH-7 | Timeline daily breakdown | Companion to the heatmap |
| FR-DASH-8 | Session detail page | Drill-down into individual sessions |
| FR-DASH-12 | Dashboard responsive layout | Usability across screen sizes |
| FR-INST-5 | Uninstall command | Clean removal builds trust |
| FR-INST-7 | Cross-platform hook scripts | Linux support expands addressable market |
| NFR-2 | Dashboard page load time < 2s | Performance expectation |
| NFR-3 | Database write throughput | Stress scenario safety |
| NFR-4 | macOS and Linux support | Platform coverage |
| NFR-10 | Dashboard startup time | Developer experience |
| DR-1 | Tool event record size target | Storage efficiency |
| DR-2 | Daily throughput capacity | Scalability assurance |

### Could Have (Phase 3)

| ID | Requirement | Rationale |
|----|-------------|-----------|
| FR-CAP-4 | Detect framework from bash commands | Nice enrichment, not critical |
| FR-CTX-2 | Plan status injection on session start | Integration with lazy-fetch/Ralph Loop |
| FR-CTX-3 | File hotspot warnings | Intelligent warning -- high value but needs tuning |
| FR-CTX-4 | /pulse skill for summaries | In-terminal access without dashboard |
| FR-CTX-5 | MCP server for on-demand queries | Power-user feature for programmatic access |
| FR-DASH-3 | Overview skills and frameworks | Enriched overview page |
| FR-PLAN-1 | Read lazy-fetch plan.json | Plan tracking integration |
| FR-PLAN-2 | Read Ralph Loop state | Plan tracking integration |
| FR-PLAN-3 | Correlate plan tasks with coding activity | Deep insight feature |
| FR-PLAN-4 | Dashboard plan progress display | Visual plan tracking |
| FR-PLAN-5 | Plan change detection | Reactive plan updates |
| FR-DASH-9 | Settings page -- export | Data portability |
| FR-DASH-11 | Settings page -- hook status | Diagnostic visibility |
| NFR-7 | Database size management | Long-term health |
| DR-3 | Daily summary record size | Storage optimization |
| DR-4 | Session record size | Storage optimization |
| DR-7 | Annual storage estimate | Capacity planning |

### Won't Have (v1 -- revisit later)

| ID | Requirement | Rationale |
|----|-------------|-----------|
| FR-DASH-10 | Settings page -- retention config + purge | Defer to Phase 4; defaults are sufficient initially |
| DR-6 | Configurable retention | Defer to Phase 4; 90-day default covers most users |

---

## MVP Definition -- The Narrowest Wedge

### What ships

1. **Hook script** (`~/.claude-pulse/hook.sh`) capturing PostToolUse, SessionStart, Stop, and TaskCreated events
2. **SQLite database** (`~/.claude-pulse/tracker.db`) with WAL mode, tables for `tool_events`, `sessions`, `projects`
3. **CLI commands**: `claude-pulse init` (install hooks + create DB), `claude-pulse start` (launch dashboard)
4. **Overview page**: 5 KPIs (sessions, tool calls, lines changed, projects, active days) + 30-day activity chart + tool distribution chart
5. **Projects page**: table of all tracked projects with sortable columns

### MVP requirements (the subset)

| ID | Requirement |
|----|-------------|
| FR-CAP-1 | Track every tool call with full metadata |
| FR-CAP-2 | Detect project from git repo name |
| FR-CAP-5 | Track session lifecycle |
| FR-CAP-8 | No conversation content stored |
| FR-DASH-1 | Overview page with global KPIs |
| FR-DASH-2 | Overview tool distribution |
| FR-DASH-4 | Projects listing page |
| FR-INST-1 | One-command install |
| FR-INST-2 | Merge hooks into existing settings.json |
| FR-INST-3 | Dependency check |
| FR-INST-4 | Backup settings.json |
| FR-INST-6 | Database schema initialization |
| NFR-1 | Hook latency < 100ms |
| NFR-5 | Zero network dependency |
| NFR-6 | No conversation content |
| NFR-8 | Concurrent access safety |
| NFR-9 | Graceful degradation on hook failure |
| DR-5 | Default 90-day retention |

### Expected build time

**5-7 working days** for a single developer.

- Day 1-2: Hook scripts + SQLite schema + CLI init command
- Day 3-4: Next.js dashboard (overview + projects pages)
- Day 5: CLI start command, integration testing, edge case hardening
- Day 6-7: Buffer for platform testing (macOS/Linux), documentation, polish

### What it validates

1. **Is the data useful?** Do developers look at the overview page and learn something they didn't know about their Claude Code usage?
2. **Is installation frictionless?** Can a developer go from zero to seeing data in under 2 minutes (one init command + one Claude Code session + open dashboard)?
3. **Is performance invisible?** Does anyone notice Pulse is running? If yes, the hook is too slow.
4. **Is the privacy model sufficient?** Do developers feel comfortable with what is stored? Any pushback here must be addressed before adding context injection.
5. **Is there retention?** Do developers come back after the first day? The dashboard must answer "what did I do today?" compellingly enough to build a daily habit.

---

## Phased Roadmap

### Phase 1: MVP (Week 1)

**Goal:** Install in 30 seconds, see data from your next session.

| Day | Deliverable | Requirements |
|-----|------------|--------------|
| 1 | Hook scripts for PostToolUse, SessionStart, Stop, TaskCreated | FR-CAP-1, FR-CAP-2, FR-CAP-5, FR-CAP-8 |
| 1 | SQLite schema with WAL mode (tool_events, sessions, projects tables) | FR-INST-6, NFR-8, DR-5 |
| 2 | `claude-pulse init` CLI command (dependency check, backup, merge hooks, create DB) | FR-INST-1, FR-INST-2, FR-INST-3, FR-INST-4 |
| 2 | Graceful hook failure handling | NFR-9 |
| 3 | Next.js dashboard scaffold on localhost:3141 | NFR-5 |
| 3 | Overview page: 5 KPIs + 30-day activity chart | FR-DASH-1 |
| 4 | Overview page: tool distribution chart | FR-DASH-2 |
| 4 | Projects listing page with sortable columns | FR-DASH-4 |
| 5 | `claude-pulse start` CLI command | -- |
| 5 | Hook latency benchmarking (<100ms p95) | NFR-1 |
| 5 | Integration testing: full pipeline from hook to dashboard | -- |

**Exit criteria:** A developer runs `npx claude-pulse init`, opens a Claude Code session, runs a few tool calls, then runs `claude-pulse start` and sees their activity on the overview page. Total time under 2 minutes.

---

### Phase 2: Rich Views + Feedback Loop (Week 2)

**Goal:** Drill down into projects and sessions. Close the feedback loop with context injection.

| Day | Deliverable | Requirements |
|-----|------------|--------------|
| 6 | Project detail page (project KPIs, daily chart, most-edited files, session list) | FR-DASH-5 |
| 6 | File language detection | FR-CAP-3 |
| 7 | Timeline page with calendar heatmap (365 days) | FR-DASH-6 |
| 7 | Timeline daily breakdown on day click | FR-DASH-7 |
| 8 | Session detail page (event timeline, files touched, tools used, duration) | FR-DASH-8 |
| 8 | Lines added/removed tracking for Edit/Write events | FR-CAP-6 |
| 9 | SessionStart context injection (last session summary) | FR-CTX-1, FR-CTX-6 |
| 9 | Daily summary aggregation | FR-CAP-7 |
| 10 | Uninstall command | FR-INST-5 |
| 10 | Cross-platform testing and fixes | FR-INST-7, NFR-4 |
| 10 | Responsive layout pass | FR-DASH-12 |

**Exit criteria:** A developer starts a new Claude Code session and sees injected context about their previous session in the same project. All dashboard pages load in under 2 seconds with 30 days of data. Works on macOS and Ubuntu.

---

### Phase 3: Intelligence (Week 3)

**Goal:** Pulse becomes actively useful, not just passively informative.

| Day | Deliverable | Requirements |
|-----|------------|--------------|
| 11 | lazy-fetch plan.json reader + Ralph Loop state reader | FR-PLAN-1, FR-PLAN-2 |
| 11 | Plan status injection on SessionStart | FR-CTX-2 |
| 12 | Plan progress display on project detail page | FR-PLAN-4 |
| 12 | Plan change detection | FR-PLAN-5 |
| 13 | Task-to-activity correlation | FR-PLAN-3 |
| 13 | File hotspot warnings on PostToolUse | FR-CTX-3 |
| 14 | `/pulse` skill for in-terminal summaries | FR-CTX-4 |
| 14 | Framework detection from bash commands | FR-CAP-4 |
| 14 | Skills and frameworks on overview page | FR-DASH-3 |
| 15 | MCP server for on-demand queries | FR-CTX-5 |
| 15 | Productivity insight cards (session length trends, tool usage shifts, hotspot alerts) | -- |

**Exit criteria:** A developer with a lazy-fetch plan sees plan progress in the dashboard and in session context. File hotspot warnings fire after 20+ edits. The `/pulse` skill returns a useful cross-project summary. MCP server responds to tool queries.

---

### Phase 4: Polish + Ship (Week 4)

**Goal:** Production-ready for public release.

| Day | Deliverable | Requirements |
|-----|------------|--------------|
| 16 | Settings page: export (SQLite download + JSON) | FR-DASH-9 |
| 16 | Settings page: hook status display | FR-DASH-11 |
| 17 | Settings page: retention configuration + purge | FR-DASH-10, DR-6 |
| 17 | `claude-pulse doctor` diagnostic command (latency test, DB health, hook status) | -- |
| 18 | Database size management + storage estimates | NFR-7, DR-3, DR-4, DR-7 |
| 18 | Performance benchmarking (write throughput, dashboard load times) | NFR-2, NFR-3, NFR-10, DR-1, DR-2 |
| 19 | npm package preparation + publish workflow | -- |
| 19 | README, installation guide, troubleshooting docs | -- |
| 20 | Final cross-platform validation (macOS ARM, macOS Intel, Ubuntu 22.04) | NFR-4 |
| 20 | Release candidate testing + bug fixes | -- |

**Exit criteria:** `npm install -g claude-pulse` works. All 55 requirements have been addressed. All NFRs pass benchmarks. README covers install, usage, uninstall, privacy model, and troubleshooting. Package published to npm.

---

## Requirement Coverage Summary

| Phase | Requirements Addressed | Count |
|-------|----------------------|:-----:|
| Phase 1 (MVP) | FR-CAP-1, 2, 5, 8; FR-DASH-1, 2, 4; FR-INST-1, 2, 3, 4, 6; NFR-1, 5, 6, 8, 9; DR-5 | 18 |
| Phase 2 (Rich Views) | FR-CAP-3, 6, 7; FR-CTX-1, 6; FR-DASH-5, 6, 7, 8, 12; FR-INST-5, 7; NFR-4 | 13 |
| Phase 3 (Intelligence) | FR-CAP-4; FR-CTX-2, 3, 4, 5; FR-DASH-3; FR-PLAN-1, 2, 3, 4, 5 | 11 |
| Phase 4 (Polish) | FR-DASH-9, 10, 11; NFR-2, 3, 7, 10; DR-1, 2, 3, 4, 6, 7 | 13 |
| **Total** | | **55** |

All 55 requirements from the requirements specification are accounted for across the four phases.
