# Claude Pulse -- Validation Plan

*Generated: 2026-03-27*

---

## Critical Assumptions

| # | Assumption | Confidence | Evidence | What Breaks If Wrong |
|---|-----------|:----------:|----------|---------------------|
| 1 | Claude Code hooks are stable/reliable -- the JSON schema for SessionStart, PostToolUse, Stop, TaskCreated won't change without warning | Medium | Prototype works today. But hooks are undocumented/unofficial. Anthropic has no published stability contract. Risk #1 in risk matrix scored 20 (highest). | The entire data pipeline dies. Every hook script breaks. Users get silent failures or broken Claude Code sessions. Pulse becomes unmaintainable if the schema changes faster than we can adapt. |
| 2 | Developers want visibility into AI coding patterns | High | No competing tool exists for Claude Code activity tracking. WakaTime covers editor time but nothing AI-native. Every Claude Code user operates blind. Demand signal is structural (growing user base, zero alternatives). | The product has no market. Dashboard goes unused. Context injection is a solution looking for a problem. We built a tool nobody asked for. |
| 3 | SQLite handles concurrent writes from 4+ terminals | High | WAL mode is a proven SQLite configuration used by Firefox, iOS, and countless production systems. Prototype confirmed concurrent writes without corruption. | Multi-terminal users (the power users we're targeting) experience "database is locked" errors, lost events, or corruption. Data integrity -- a success criterion -- fails. Users lose trust in the data. |
| 4 | Context injection improves session quality | Medium | The mechanism works (additionalContext field returns data to Claude). But no user has tested whether the injected summaries are actually useful vs. noise. The "eureka insight" from the vision doc is still theoretical at scale. | The feedback loop -- the core differentiator -- becomes an annoyance. Users disable injection. Pulse is reduced to "just another dashboard" with no competitive moat against a future Anthropic native solution. |
| 5 | Global hook installation doesn't break user workflows | Medium | Hook merge behavior confirmed in prototype (global + project hooks coexist). But untested across diverse user configurations: existing global hooks, multiple hook-based tools, settings.json edge cases. | Installation breaks users' existing Claude Code setups. Word spreads fast in developer communities. "claude-pulse broke my hooks" becomes a GitHub issue magnet. Trust is destroyed on day one -- violates "first impression IS the product" from user journeys. |
| 6 | Users will check a local dashboard regularly | Low | No evidence. Dashboard fatigue is well-documented across dev tools. GitHub Copilot's dashboard is rarely visited. WakaTime retention depends on team/social features Pulse explicitly rejects (anti-goal #2). | The overview page -- Phase 1's primary deliverable -- provides no recurring value. The 5 KPIs go unseen. The entire dashboard investment (Days 3-5 of MVP) is wasted effort. Success criterion #5 (daily active usage after one week) fails. |
| 7 | Plan tracking from lazy-fetch/Ralph Loop adds value | Medium | These tools have active users, but the overlap with Claude Pulse's target audience is unproven. Plan-to-activity correlation is a novel concept with no prior art to validate demand. | Phase 3 (Week 3) becomes wasted effort. FR-PLAN-1 through FR-PLAN-5 deliver features nobody uses. The "intelligence" phase adds complexity without engagement. Maintenance burden increases for an unused integration. |
| 8 | npm distribution reaches target users | High | npm is the standard distribution channel for JavaScript/TypeScript CLI tools. Claude Code users are developers with Node.js installed. `npx` execution requires zero pre-installation. | Installation friction. Users who don't have Node.js (rare for Claude Code users but possible) can't install. Curl-pipe-bash alternative mitigates this, but npm is the primary channel. |

---

## Validation Methods

### Assumption 1: Hook Stability (Medium Confidence)

**Method: Structured compatibility testing + monitoring**

1. **Schema snapshot test.** Before writing any product code, capture the exact JSON schema for all 8 hook events (SessionStart, PostToolUse, Stop, TaskCreated, PreToolUse, PreCompact, CwdChanged, StopFailure). Write automated tests that parse real hook payloads and assert field presence/types.
2. **Version detection probe.** Build a `claude --version` check into the init script. Log the Claude Code version alongside every event. When schemas break, the version boundary is immediately visible.
3. **Anthropic changelog monitoring.** Set up a weekly manual check (or RSS/webhook if available) of Anthropic's release notes and Claude Code changelogs for hook-related changes.
4. **Defensive parsing.** All hook scripts must use optional field access -- never crash on a missing field. Unknown fields are ignored. Unknown event types are logged but not processed.

**Success signal:** Hook scripts survive 2+ Claude Code updates without manual intervention.
**Failure signal:** Any Claude Code update that silently breaks data capture for more than 24 hours.

---

### Assumption 4: Context Injection Improves Sessions (Medium Confidence)

**Method: A/B self-testing + structured journaling**

1. **Dogfood protocol.** Before public release, the developer(s) building Pulse use it for 2 full weeks with context injection enabled. Alternate days: injection ON vs. injection OFF.
2. **Session quality journal.** After each session, rate on a 1-5 scale: "Did Claude have useful context about my previous work?" Record the rating alongside the session ID in a simple log.
3. **Content analysis.** Review injected context for 20 sessions. Categorize each as: (a) directly useful, (b) partially relevant, (c) irrelevant noise, (d) actively misleading.
4. **Character limit tuning.** Test injection at 500, 1000, and 2000 characters. Measure which length produces the best signal-to-noise ratio.

**Success signal:** 60%+ of sessions rated 4-5 on context usefulness (matches success criterion #4).
**Failure signal:** <40% useful, or users consistently disable injection within the first week.

---

### Assumption 5: Global Hook Installation Safety (Medium Confidence)

**Method: Configuration matrix testing**

1. **Enumerate configurations.** Collect real-world `settings.json` files from at least 5 different Claude Code users (ask in communities, or create synthetic variants). Include:
   - Empty/missing settings.json
   - Settings with existing global hooks (other tools)
   - Settings with project-level hooks that should not be affected
   - Settings with hooks on the same events Pulse needs (PostToolUse, SessionStart)
   - Malformed or partially valid settings.json
2. **Merge-and-diff test.** For each configuration, run `claude-pulse init --dry-run` and compare the output diff. Verify:
   - Existing hooks are preserved
   - Pulse hooks are added (not replacing)
   - Backup file is created
   - Running init twice is idempotent
3. **Destructive recovery test.** Deliberately corrupt the merge, then verify the backup restoration path works.

**Success signal:** Zero data loss across all configuration variants. Init is idempotent. Backup always restores cleanly.
**Failure signal:** Any configuration where existing hooks are lost or Claude Code behavior changes after Pulse installation.

---

### Assumption 6: Dashboard Engagement (Low Confidence)

**Method: Usage tracking + alternative value delivery**

1. **Instrument the dashboard.** Log local-only page view events (timestamp, page, duration) to a separate SQLite table. After 2 weeks of dogfooding, analyze: how often is the dashboard opened? Which pages? How long per visit?
2. **Terminal-first fallback.** Build `claude-pulse summary` CLI command early (not just the web dashboard). If dashboard engagement is low, the terminal summary becomes the primary interface.
3. **Context injection as passive value.** If assumption 4 validates (injection is useful), then assumption 6 matters less -- the tool delivers value without any dashboard visit. Measure how many users have injection enabled vs. how many visit the dashboard.
4. **Notification experiment.** Test a daily terminal notification ("Claude Pulse: 847 lines across 3 projects today") printed at first session start. See if this drives dashboard visits.

**Success signal:** Dashboard opened at least 3x/week by active users, OR context injection alone drives daily retention.
**Failure signal:** <1 dashboard visit per week after the first week, AND context injection disabled or unused.

---

### Assumption 7: Plan Tracking Value (Medium Confidence)

**Method: Demand signal before building**

1. **Survey lazy-fetch users.** Before building Phase 3, ask 10+ lazy-fetch/Ralph Loop users: "Would you want to see your plan tasks correlated with actual coding activity? What would you do with that information?"
2. **Manual prototype.** Create a mockup (screenshot or static page) of the plan-activity correlation view. Show it to 5 users and ask for reactions.
3. **Usage gate.** Instrument Phase 3 features with local usage counters. If plan tracking pages receive <5 views in the first month of availability, deprecate and simplify.

**Success signal:** 50%+ of surveyed lazy-fetch users express clear interest, AND post-launch usage exceeds 5 views/month.
**Failure signal:** Users shrug at the mockup, or post-launch usage is negligible.

---

## Kill Criteria

| Signal | Threshold | Action |
|--------|-----------|--------|
| Hook instability | 2+ breaking changes to hook schema within 3 months of launch | Pause development. Evaluate whether a compatibility shim is sustainable or if the platform risk is terminal. Consider pivoting to MCP-only data capture (no hooks dependency). |
| Installation breaks user setups | 3+ reports of Pulse corrupting settings.json or breaking existing hooks | Immediate hotfix. If unfixable within 48 hours, pull the npm package and publish a warning. Redesign the merge strategy before re-releasing. |
| Zero retention after 2 weeks | <10% of installers have any dashboard visit or context injection active after 14 days | The product does not solve a real problem. Stop building Phase 2+. Write a post-mortem. Consider whether the data layer alone (no UI) has value as a library for other tools. |
| Performance regression | Hook latency exceeds 200ms p95 (2x the 100ms budget) on any platform | Block all feature work until resolved. Performance is a hard constraint -- users must never notice Pulse is running. |
| Anthropic ships native tracking | Claude Code adds built-in activity dashboard or session history | Evaluate overlap. If 80%+ of Pulse functionality is replicated, sunset the project gracefully. If the feedback loop (context injection) remains differentiated, pivot to that as the sole feature. |
| Privacy incident | Any report of Pulse capturing conversation content, prompts, or code | Emergency patch within 24 hours. Full audit of all captured data. If the structural privacy guarantee is violated, the trust contract is broken -- consider sunsetting. |
| SQLite corruption | Any confirmed data loss or corruption under normal concurrent usage | Critical bug. Implement the recovery-file replay mechanism from Risk #4 mitigation. If corruption persists after WAL mode fixes, evaluate switching to a different storage backend. |

---

## Pre-Build Validation

These tests must pass BEFORE writing production code. Estimated time: 1-2 days.

### 1. Hook Reliability Across OS (Blocks Phase 1, Day 1)

- [ ] Capture real hook JSON payloads for all 4 MVP events (PostToolUse, SessionStart, Stop, TaskCreated) on macOS ARM
- [ ] Capture the same on macOS Intel (if available) and Ubuntu 22.04
- [ ] Diff payloads across OS. Document any differences in field names, types, or structure
- [ ] Verify that `additionalContext` in stdout JSON is honored by Claude Code (test with a trivial message injection)
- [ ] Confirm hook merge behavior: install a test hook globally, install a different hook at project level, verify both fire

### 2. Concurrent Write Stress Test (Blocks Phase 1, Day 1)

- [ ] Create a test SQLite database with WAL mode enabled
- [ ] Spawn 6 concurrent processes each writing 1000 events (simulating heavy multi-terminal usage)
- [ ] Verify zero "database is locked" errors
- [ ] Verify all 6000 events are present and uncorrupted after completion
- [ ] Measure p95 write latency under contention (must be <50ms)

### 3. Settings.json Merge Safety (Blocks Phase 1, Day 2)

- [ ] Test merge against 5+ real-world settings.json configurations (see Assumption 5 method)
- [ ] Verify idempotency: running init twice produces identical output
- [ ] Verify backup creation and restoration
- [ ] Test with settings.json that has hooks on the SAME events Pulse uses (PostToolUse, SessionStart)
- [ ] Test with missing/empty settings.json
- [ ] Test with malformed JSON in settings.json (graceful error, no corruption)

### 4. Hook Performance Baseline (Blocks Phase 1, Day 2)

- [ ] Benchmark a minimal hook script (parse JSON + write to SQLite) 1000 times
- [ ] Record p50, p95, p99 latency
- [ ] Confirm p95 < 50ms (stricter than the 100ms NFR to leave headroom)
- [ ] Test with jq vs. Node.js JSON parsing -- determine which is faster for the hook hot path
- [ ] Verify that a crashing hook script outputs nothing to stdout and exits 0

### 5. Dependency Availability Check (Blocks Phase 1, Day 2)

- [ ] Survey: what percentage of macOS systems have jq installed by default? (Answer: 0% -- requires Homebrew)
- [ ] Determine if Node.js-based JSON parsing eliminates the jq dependency entirely
- [ ] Verify sqlite3 CLI availability on macOS (pre-installed) and Ubuntu (requires apt install)
- [ ] Decision: commit to jq dependency or replace with Node.js parser before writing the hook script

---

## Post-MVP Validation

Metrics to measure after MVP ships. All data is local-only (no telemetry). Collection requires opt-in or manual reporting.

### Week 1 Metrics (Immediate Feedback)

| Metric | How Measured | Target | Red Flag |
|--------|-------------|--------|----------|
| Install success rate | GitHub issues + manual feedback | >90% of attempts succeed | >3 install failure reports in first week |
| Time to first data | Dogfood timing | <2 minutes (install + one session + dashboard) | >5 minutes or requires troubleshooting |
| Hook latency in production | `claude-pulse doctor` self-test | p95 <100ms | Any user reporting perceptible slowdown |
| Events captured per session | Dashboard data | >0 for 100% of sessions | Any session with zero events (silent hook failure) |
| Dashboard load time | Chrome DevTools (manual) | <2s with 7 days of data | >4s or visible jank |

### Week 2-4 Metrics (Retention & Value)

| Metric | How Measured | Target | Red Flag |
|--------|-------------|--------|----------|
| Dashboard return visits | Instrumented local page views | 3+/week for active users | <1/week after novelty period |
| Context injection opt-in rate | Config file analysis (manual survey) | >50% of Phase 2 users enable it | <20% enable, or >30% explicitly disable after trying |
| "Aha moment" reports | GitHub discussions / user feedback | Qualitative: users describe specific insights they gained | Feedback limited to "cool" with no specific value cited |
| Uninstall rate | GitHub issues mentioning uninstall | <10% within 30 days | >25% uninstall within 2 weeks |
| Bug reports (hook-related) | GitHub issues | <5 in first month | >10, especially settings.json corruption |

### Month 2-3 Metrics (Product-Market Fit)

| Metric | How Measured | Target | Red Flag |
|--------|-------------|--------|----------|
| Organic referrals | GitHub stars growth rate, mentions in Claude Code discussions | Accelerating week-over-week | Flat or declining after initial launch spike |
| Feature requests (context injection) | GitHub issues | Users asking for MORE context, better summaries, new injection points | Users asking to disable injection entirely |
| Multi-project users | Dashboard data (manual survey) | >50% of active users track 2+ projects | Most users single-project (cross-project value prop unvalidated) |
| Data volume / storage health | `claude-pulse doctor` | <50MB for typical user after 30 days | >200MB or performance degradation |
| Community contributions | GitHub PRs | Any external contribution within 90 days | Zero external engagement |

### Qualitative Validation (Ongoing)

1. **Monthly user interview** (even 1-2 users). Ask:
   - What do you look at on the dashboard? What do you ignore?
   - Has context injection changed how you start sessions?
   - What's missing that would make Pulse essential rather than nice-to-have?

2. **"Would you be upset if Pulse stopped working?"** survey after 30 days. Target: >40% say "very disappointed" (Sean Ellis PMF test).

3. **Competitive monitoring.** Track whether Anthropic adds native activity features to Claude Code. The timeline for this is the existential clock for the project.

---

## Validation Timeline Summary

```
Pre-Build (Days -2 to 0)
  Hook reliability tests -----> GO / NO-GO gate
  Concurrent write tests -----> GO / NO-GO gate
  Settings merge tests -------> GO / NO-GO gate
  Performance baseline -------> GO / NO-GO gate

MVP Build (Days 1-7)
  [Build Phase 1]

Post-MVP Week 1
  Install success rate -------> Continue / Hotfix
  Hook latency in prod -------> Continue / Block features

Post-MVP Week 2-4
  Dashboard engagement -------> Dashboard pivot or double-down
  Context injection value ----> Feedback loop GO / NO-GO for Phase 2

Month 2-3
  Retention + PMF signal -----> Continue / Sunset decision
  Anthropic native tracking --> Pivot / Sunset decision
```

---

## Decision Log

Decisions made during validation should be recorded here as they happen.

| Date | Decision | Rationale | Reversible? |
|------|----------|-----------|:-----------:|
| -- | -- | -- | -- |
