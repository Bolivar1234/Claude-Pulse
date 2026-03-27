# Product Requirements Document: Claude Pulse

*Generated: 2026-03-27*

---

## 0. Research Verdict & Premises

**Verdict: BUILD** -- no competing tool exists for Claude Code activity tracking.

**Demand reality: STRONG** -- every Claude Code user has zero visibility into their AI-assisted coding. The addressable market is the entire Claude Code user base, growing weekly.

**Key eureka insight:** Tracked data flows BACK into sessions as context via the `additionalContext` hook output, creating a feedback loop where historical patterns improve future sessions. No other tool does this.

**Premise scorecard:**

| # | Premise | Status |
|---|---------|--------|
| 1 | Claude Code hooks emit structured JSON usable for tracking | Confirmed (prototype) |
| 2 | Developers want visibility into AI coding patterns | Confirmed (zero alternatives exist) |
| 3 | SQLite WAL handles concurrent writes from 4+ terminals | Confirmed (prototype + SQLite track record) |
| 4 | Context injection improves session quality | Needs validation (mechanism works, value unproven at scale) |
| 5 | Global hook installation is safe (merge, not replace) | Confirmed (prototype) |
| 6 | Users will check a local dashboard regularly | Needs validation (dashboard fatigue is real) |
| 7 | Plan tracking from lazy-fetch/Ralph Loop adds value | Confirmed interest, unproven demand |
| 8 | npm distribution reaches target users | Confirmed (standard channel for JS CLI tools) |

**Biggest risk:** Anthropic builds native activity tracking into Claude Code, eliminating the need for Pulse entirely. Mitigation: ship fast, focus on the context injection feedback loop (harder to replicate without opinionation), and offer data export so users never feel locked in.

---

## 1. Executive Summary

**Problem:** Claude Code developers are flying blind. They spend hours daily working with an AI assistant that edits files, runs commands, spawns agents, and invokes skills -- but they cannot answer basic questions about that collaboration. How many files did Claude edit today? Which projects consumed the most AI time? What is the ratio of Read calls to Edit calls? Nobody knows.

**Solution:** Claude Pulse is a local-first activity tracker that captures every tool call, agent spawn, and skill invocation from Claude Code -- then feeds that intelligence back into future sessions as context. A bash hook script writes structured events to SQLite. A one-page Next.js dashboard visualizes the data. On session start, the hook injects a summary of recent activity so Claude "remembers" what the developer was working on.

**Target user:** Power users running multiple Claude Code sessions per day across several projects. Comfortable with CLI tools and local-first software. Do not want to sign up for a service or send data anywhere.

**Key differentiator:** The feedback loop. WakaTime shows you a dashboard. Claude Pulse makes your next session smarter by injecting historical context automatically.

**Narrowest wedge (v1):** A bash hook script, a SQLite database, and a one-page dashboard. Three components. 30-second install. First data appears within one Claude Code session.

---

## 2. Vision & Scope

### Product Vision

**For developers using Claude Code** who have no visibility into how they actually use AI in their daily workflow, **Claude Pulse is a local-first activity tracker** that captures every tool call, agent spawn, and skill invocation -- then feeds that intelligence back into future sessions as context. **Unlike WakaTime or other coding time trackers**, Claude Pulse understands AI-native workflows and creates a closed feedback loop where historical patterns improve future sessions.

### The Feedback Loop

```
Track Activity --> Store in SQLite --> Inject as Context --> Better Sessions --> More Activity
     ^                                                                              |
     |______________________________________________________________________________|
```

When a developer starts a new session, the SessionStart hook injects a summary:
- Last session details (duration, files edited, tools used)
- Cross-project daily summary (sessions, events, top projects)
- Plan status from lazy-fetch/Ralph Loop if present

This turns Claude Code from a stateless tool into a stateful collaborator.

### Anti-Goals

1. **NOT a cloud service.** All data stays on the developer's machine. Local-first means local-only.
2. **NOT a team management or surveillance tool.** No productivity scores, no cross-developer aggregation.
3. **NOT a replacement for lazy-fetch or Ralph Loop.** Reads their state files, does not duplicate their functionality.
4. **NOT a code quality analyzer.** Tracks what happened, not whether it was good.
5. **NOT tracking conversation content.** Captures tool calls, file paths, command names only. No prompts, no code diffs, no secrets.
6. **NOT a billing or cost tracker.** Does not track tokens or API spending.
7. **NOT a complex enterprise platform.** No plugins, no marketplace, no extension API in v1.

### Success Criteria

| # | Criterion | Metric |
|---|-----------|--------|
| 1 | 30-second install | Single command, first data within one session |
| 2 | Zero performance impact | Hook execution <50ms, async writes |
| 3 | Dashboard loads fast | <2 seconds with 30 days of data (50,000+ events) |
| 4 | Context injection works | Developer reports useful context 60%+ of sessions |
| 5 | Daily active usage | Dashboard or injection used 1x/day after first week |
| 6 | Cross-project awareness | Unified timeline across 3+ projects in one glance |
| 7 | Data integrity | Zero events lost, zero corruption with 4 concurrent terminals over 30 days |

### Scope Boundary

**v1 ships exactly three things:**

1. **A bash hook script** (`~/.claude-pulse/hook.sh`) capturing PostToolUse, SessionStart, Stop, and TaskCreated events
2. **A SQLite database** (`~/.claude-pulse/tracker.db`) with WAL mode, storing events in structured tables
3. **A one-page dashboard** (`localhost:3141`) showing today's activity, tool breakdown, project breakdown, session history, and 7-day trends

**v1.1 adds the feedback loop:** SessionStart context injection via `additionalContext`.

Everything else -- MCP server, `/pulse` skill, lazy-fetch integration, export formats -- is v2+.

---

## 3. User Journeys

Five core scenarios define how developers interact with Claude Pulse. Full details in [user-journeys.md](./user-journeys.md).

| # | Scenario | Trigger | Magic Moment |
|---|----------|---------|--------------|
| 1 | First Install | Developer discovers Pulse, runs `npx claude-pulse init` | Seeing real numbers for the first time: "I wrote 147 lines in 12 minutes?" |
| 2 | Daily Dashboard Check | End of coding day, wants to see accomplishments | Daily chart revealing actual productivity pattern |
| 3 | Cross-Project Context Switch | Finishes Project A, opens Project B after 3 days away | Claude saying "Last time you were working on JWT validation in auth.ts" |
| 4 | Plan Progress Tracking | Mid-sprint, wants to map activity to plan tasks | Estimated time remaining based on actual velocity, not gut feeling |
| 5 | Session Continuity After Days Away | Returns to a project after a week | Zero ramp-up time: Claude has perfect memory across a week gap |

**Critical path:** Scenario 1 (First Install) must work perfectly on day one. If installation fails, breaks existing hooks, or produces no data, the user uninstalls immediately and never returns.

---

## 4. Requirements Overview

55 total requirements across 7 categories. Full specification in [requirements.md](./requirements.md).

| Category | ID Range | Count | Description |
|----------|----------|:-----:|-------------|
| Data Capture | FR-CAP-1 to FR-CAP-8 | 8 | Tool call tracking, project detection, language/framework detection, session lifecycle, privacy |
| Dashboard | FR-DASH-1 to FR-DASH-12 | 12 | Overview page, project views, timeline heatmap, session detail, settings, responsive layout |
| Context Injection | FR-CTX-1 to FR-CTX-6 | 6 | SessionStart summary, plan injection, file hotspots, /pulse skill, MCP server, size limits |
| Plan Tracking | FR-PLAN-1 to FR-PLAN-5 | 5 | lazy-fetch/Ralph Loop integration, task-activity correlation, plan display |
| Installation | FR-INST-1 to FR-INST-7 | 7 | One-command install, hook merging, dependency check, backup, uninstall, schema init, cross-platform |
| Non-Functional | NFR-1 to NFR-10 | 10 | Latency, load time, throughput, platform support, privacy, size management, concurrency, degradation |
| Data | DR-1 to DR-7 | 7 | Record sizes, throughput capacity, retention policies, storage estimates |
| **Total** | | **55** | |

### MVP Requirements (18 of 55)

The MVP includes: FR-CAP-1, 2, 5, 8; FR-DASH-1, 2, 4; FR-INST-1, 2, 3, 4, 6; NFR-1, 5, 6, 8, 9; DR-5. These cover core tracking, basic dashboard, safe installation, and hard performance/privacy constraints.

---

## 5. Architecture Overview

Full architecture in [architecture-sketch.md](./architecture-sketch.md).

### System Diagram

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
 │       ▼              ▼              ▼                               │
 │  ┌──────────────────────────────────────────┐                      │
 │  │            hook.sh  (POSIX shell + jq)   │                      │
 │  │  Parse JSON --> Extract metadata -->      │                      │
 │  │  Write to SQLite --> Inject context       │                      │
 │  └──────────┬──────────────┬────────────────┘                      │
 │             │              │                                        │
 │        INSERT          SELECT                                       │
 │             ▼              ▼                                        │
 │  ┌──────────────────────────────────────────┐                      │
 │  │     ~/.claude-pulse/tracker.db           │                      │
 │  │     SQLite 3 + WAL mode                  │                      │
 │  └──────────┬───────────────────────────────┘                      │
 │             │                                                       │
 │        SELECT (read-only)                                           │
 │             ▼                                                       │
 │  ┌──────────────────────────────────────────┐                      │
 │  │   Dashboard — Next.js on :3141           │                      │
 │  │   /overview  /projects  /timeline        │                      │
 │  │   /sessions/:id  /settings               │                      │
 │  └──────────────────────────────────────────┘                      │
 └─────────────────────────────────────────────────────────────────────┘
```

### Component Summary

| Component | Technology | Build/Integrate | Purpose |
|-----------|-----------|:-:|------------|
| Hook Script | POSIX shell + jq + sqlite3 | Build | Capture events, write to DB, inject context |
| SQLite Database | SQLite 3, WAL mode | Integrate | Local-only persistent storage |
| Dashboard | Next.js 14+, React, Tailwind, Recharts | Build | Visual activity display on localhost:3141 |
| CLI | Node.js, Commander.js | Build | Install, start, stop, uninstall, export, purge |
| Context Injector | Part of hook.sh | Build | Feed history back into sessions via additionalContext |
| MCP Server (v2+) | Node.js, MCP SDK | Build | In-session queries via MCP tools |
| Aggregator | SQL in hook.sh | Build | Daily summaries, retention purge |

### Key Technical Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| KTD-1 | POSIX shell for hooks (not Node.js) | 10-30ms execution vs 80-150ms Node.js cold start |
| KTD-2 | SQLite with WAL (not PostgreSQL) | Zero-config, no daemon, concurrent read/write |
| KTD-3 | Next.js Server Components | Direct SQLite queries, no separate API server |
| KTD-4 | Global hooks in ~/.claude/settings.json | Automatic cross-project tracking, safe merge |
| KTD-5 | Granular append-only events | Enables drill-down; daily summaries survive purges |
| KTD-6 | Context injection inline in hook | No background daemon to manage |
| KTD-7 | Single hook script with event routing | One file to install, update, debug |

### Infrastructure Cost

**Zero.** Fully local. No cloud services, no APIs, no subscriptions.

### Installed Footprint

| Component | Size |
|-----------|------|
| hook.sh | ~5 KB |
| CLI (bundled) | ~2 MB |
| Dashboard (production build) | ~30 MB |
| node_modules | ~80 MB |
| **Total** | **~85 MB** |

---

## 6. Roadmap

Four phases over 4 weeks. Full details in [risks-and-priorities.md](./risks-and-priorities.md).

### Phase 1: MVP (Week 1) -- "Install in 30 seconds, see data from your next session"

| Deliverable | Requirements |
|------------|--------------|
| Hook scripts for PostToolUse, SessionStart, Stop, TaskCreated | FR-CAP-1, 2, 5, 8 |
| SQLite schema with WAL mode | FR-INST-6, NFR-8, DR-5 |
| `claude-pulse init` CLI (dependency check, backup, merge, DB create) | FR-INST-1, 2, 3, 4 |
| Graceful hook failure handling | NFR-9 |
| Overview page: 5 KPIs + 30-day chart + tool distribution | FR-DASH-1, 2 |
| Projects listing page | FR-DASH-4 |
| `claude-pulse start` + hook latency benchmarking | NFR-1 |

**Exit criteria:** Developer runs `npx claude-pulse init`, opens a Claude Code session, runs tool calls, opens dashboard, sees activity. Total time under 2 minutes.

**Build time:** 5-7 working days for a single developer.

### Phase 2: Rich Views + Feedback Loop (Week 2)

| Deliverable | Requirements |
|------------|--------------|
| Project detail page | FR-DASH-5, FR-CAP-3 |
| Timeline calendar heatmap + daily breakdown | FR-DASH-6, 7 |
| Session detail page | FR-DASH-8, FR-CAP-6 |
| SessionStart context injection | FR-CTX-1, FR-CTX-6 |
| Daily summary aggregation | FR-CAP-7 |
| Uninstall command + cross-platform testing | FR-INST-5, 7, NFR-4 |
| Responsive layout | FR-DASH-12 |

**Exit criteria:** New session shows injected context about previous session. All pages <2s. Works on macOS and Ubuntu.

### Phase 3: Intelligence (Week 3)

| Deliverable | Requirements |
|------------|--------------|
| lazy-fetch + Ralph Loop readers | FR-PLAN-1, 2 |
| Plan status injection + dashboard display | FR-CTX-2, FR-PLAN-4, 5 |
| Task-to-activity correlation | FR-PLAN-3 |
| File hotspot warnings | FR-CTX-3 |
| `/pulse` skill + MCP server | FR-CTX-4, 5 |
| Framework detection + overview enrichment | FR-CAP-4, FR-DASH-3 |

**Exit criteria:** Plan progress visible in dashboard and session context. Hotspot warnings fire after 20+ edits. `/pulse` skill returns cross-project summary.

### Phase 4: Polish + Ship (Week 4)

| Deliverable | Requirements |
|------------|--------------|
| Settings page: export, hook status, retention config | FR-DASH-9, 10, 11, DR-6 |
| `claude-pulse doctor` diagnostic command | -- |
| Database size management + benchmarking | NFR-2, 3, 7, 10, DR-1-4, 7 |
| npm package + README + publish | -- |
| Final cross-platform validation | NFR-4 |

**Exit criteria:** `npm install -g claude-pulse` works. All 55 requirements addressed. All NFRs pass benchmarks. Published to npm.

### Requirement Coverage

| Phase | Count | Cumulative |
|-------|:-----:|:----------:|
| Phase 1 (MVP) | 18 | 18 |
| Phase 2 (Rich Views) | 13 | 31 |
| Phase 3 (Intelligence) | 11 | 42 |
| Phase 4 (Polish) | 13 | 55 |

---

## 7. Risks

Top risks from the risk matrix, sorted by score. Full matrix in [risks-and-priorities.md](./risks-and-priorities.md).

| # | Risk | Score | Mitigation |
|---|------|:-----:|------------|
| 1 | Claude Code updates break hook JSON format | 20 | Pin to documented events. Version-detect schema. Compatibility shim layer. Monitor changelog. |
| 2 | Anthropic builds native activity tracking | 15 | Ship fast. Build data moat. Focus on context injection (harder to replicate). Offer data export. |
| 3 | Hook script adds perceptible latency | 15 | Fire-and-forget writes. Benchmark <50ms p95. Exit immediately on error. `claude-pulse doctor` self-test. |
| 4 | SQLite concurrent write contention | 12 | WAL mode. Short transactions. Exponential backoff retry. Recovery file for dropped events. |
| 5 | Hook install corrupts settings.json | 12 | Read-merge-write. Timestamped backup. Dry-run mode. Idempotent init. |
| 6 | jq/sqlite3 not installed | 12 | Dependency check at init. Platform-specific install suggestions. Long-term: replace jq with Node.js parser. |
| 14 | Hook crash emits invalid JSON, breaks Claude Code | 10 | Shell trap on error. Exit 0 with no stdout. Test failure modes explicitly. |
| 7 | Database grows unbounded | 9 | 90-day default retention. Size display on settings page. Warn at 100MB. |
| 10 | macOS vs Linux shell differences | 9 | POSIX-compatible syntax. shellcheck in CI. Test on macOS ARM, Intel, Ubuntu. |
| 11 | Metrics without actionable insights | 9 | Prioritize context injection over passive charts. Insight cards in Phase 3. |

---

## 8. Validation Plan

Full plan in [validation-plan.md](./validation-plan.md).

### Pre-Build Gates (Days -2 to 0)

Must pass BEFORE writing production code:

| Test | Blocks | Pass Criteria |
|------|--------|---------------|
| Hook reliability across OS | Phase 1, Day 1 | Identical payloads on macOS ARM and Ubuntu; additionalContext honored |
| Concurrent write stress test | Phase 1, Day 1 | 6 processes x 1000 events, zero errors, p95 write <50ms |
| Settings.json merge safety | Phase 1, Day 2 | 5+ real-world configs, idempotent, backup works |
| Hook performance baseline | Phase 1, Day 2 | p95 <50ms (stricter than 100ms NFR for headroom) |
| Dependency availability check | Phase 1, Day 2 | Decision on jq vs Node.js parser |

### Kill Criteria

| Signal | Threshold | Action |
|--------|-----------|--------|
| Hook instability | 2+ breaking schema changes in 3 months | Pause development. Evaluate compatibility shim or pivot to MCP-only. |
| Installation breaks setups | 3+ settings.json corruption reports | Immediate hotfix. Pull npm package if unfixable in 48h. |
| Zero retention after 2 weeks | <10% of installers active | Stop building. Write post-mortem. |
| Performance regression | Hook latency >200ms p95 | Block all feature work until resolved. |
| Anthropic ships native tracking | 80%+ overlap with Pulse | Sunset gracefully, or pivot to context injection only. |
| Privacy incident | Any conversation content captured | Emergency patch in 24h. Full audit. Consider sunsetting. |

### Post-MVP Metrics

| Timeframe | Key Metrics | Target |
|-----------|-------------|--------|
| Week 1 | Install success rate, time to first data, hook latency | >90% success, <2min, p95 <100ms |
| Week 2-4 | Dashboard return visits, injection opt-in rate, uninstall rate | 3+/week, >50% opt-in, <10% uninstall |
| Month 2-3 | Organic referrals, feature requests, multi-project users | Accelerating growth, users wanting MORE context |

---

## 9. Open Questions

### Architecture

1. **Hook argument passing:** Does Claude Code pass the hook type as an argument, or must hook.sh detect it from JSON stdin? Affects single-script routing.
2. **Session ID availability:** Is `session_id` present in all hook payloads, or only SessionStart? May need a session ID mapping file.
3. **Daily summaries composite key:** Per-project `(date, project_id)` or global `(date)` only? Dashboard needs both views.
4. **Dashboard bundling:** Ship pre-built standalone (fast startup, larger package) or build on first `claude-pulse start` (slower first run, smaller package)?

### Validation

5. **Plan correlation accuracy (FR-PLAN-3):** Time-window-based task correlation is approximate. Need manual "tag session to task" fallback?
6. **jq dependency decision:** Replace with Node.js JSON parser to eliminate the dependency? Must benchmark before Phase 1.
7. **Dashboard engagement baseline:** What is "good" for a local dev tool? No benchmark exists.

### Product

8. **Context injection opt-out granularity:** Per-project? Per-event-type? Or just global on/off?
9. **Ignored projects:** How to handle monorepos with multiple sub-projects under one git root?

---

## Appendix

### Sub-Documents

| Document | Description |
|----------|-------------|
| [user-journeys.md](./user-journeys.md) | 5 detailed user scenarios with before/after states and edge cases |
| [requirements.md](./requirements.md) | 55 requirements across 7 categories, each with testable criteria |
| [architecture-sketch.md](./architecture-sketch.md) | System diagram, component inventory, data flows, schema, technical decisions |
| [risks-and-priorities.md](./risks-and-priorities.md) | 14-item risk matrix, MoSCoW prioritization, MVP definition, 4-phase roadmap |
| [validation-plan.md](./validation-plan.md) | 8 critical assumptions, pre-build gates, kill criteria, post-MVP metrics |

### Stakeholder Impact Map

| Stakeholder | Impact | Key Need |
|-------------|--------|----------|
| Individual developer (primary) | High | Simple install, zero config, fast dashboard, privacy |
| Claude Code product team (Anthropic) | Medium | Stable hooks API contract |
| lazy-fetch / Ralph Loop users | Medium | Non-interference, read-only access to state files |
| Privacy-sensitive developers | High | Transparent schema, no content capture, local-only, open source |
| Open source community | Low-Medium | Clear contribution guidelines, modular architecture |

### Database Schema

7 tables: `schema_version`, `projects`, `sessions`, `tool_events`, `daily_summaries`, `plan_snapshots`, `settings`. Full DDL in [architecture-sketch.md](./architecture-sketch.md).

### Storage Estimates

| Usage Level | Events/Day | 90-Day Event Storage | Annual Summaries | Total |
|-------------|:---------:|:-------------------:|:---------------:|:-----:|
| Light | 50 | ~9 MB | ~365 KB | ~10 MB |
| Medium | 200 | ~36 MB | ~365 KB | ~37 MB |
| Heavy | 500 | ~90 MB | ~365 KB | ~91 MB |
| Extreme | 1000 | ~180 MB | ~365 KB | ~181 MB |
