# User Journeys: Claude Pulse

*Generated: 2026-03-27*

---

## Scenario 1: First Install

**Trigger:** Developer discovers Claude Pulse (npm, GitHub, word of mouth). Wants visibility into their Claude Code usage.

**Current State (Before):**
Developer uses Claude Code daily across 3 projects. Has no idea how many lines of code Claude helped write, which tools are used most, or how much time they spend per project. When someone asks "how productive is Claude Code for you?" they can only say "it feels faster."

**Desired State (With Claude Pulse):**
1. Developer runs `npx claude-pulse init`
2. System checks for `jq` and `sqlite3` (warns if missing)
3. Creates `~/.claude-pulse/` with `tracker.db`, `config.json`, and `hook.sh`
4. Backs up `~/.claude/settings.json`
5. Merges tracking hooks into global settings (SessionStart, PostToolUse, Stop)
6. Prints: "Claude Pulse installed. Hooks active for all projects. Run `npx claude-pulse` to open dashboard."
7. Developer opens a Claude Code terminal, works normally
8. Runs `npx claude-pulse` -- dashboard opens at localhost:3141
9. Sees their first session with real data: 23 tool calls, 147 lines written, 3 files edited

**Magic Moment:** Seeing real numbers for the first time. "I wrote 147 lines in 12 minutes?"

**Edge Cases:**
- No jq/sqlite3: clear install instructions with platform-specific commands
- Existing hooks in settings.json: merge, don't replace
- Multiple Claude Code sessions open: all track independently

---

## Scenario 2: Daily Dashboard Check

**Trigger:** End of coding day. Developer wants to see what they accomplished.

**Current State:** Developer remembers vaguely what they worked on. Checks git log for commits. No sense of total effort or patterns.

**Desired State:**
1. Opens `localhost:3141` (dashboard already running or `npx claude-pulse`)
2. Overview page shows:
   - Today: 5 sessions, 2.5 hours, 847 lines written, 12 files touched
   - This week: 18 sessions, 9 hours, 3,200 lines, across 3 projects
   - Top tools: Edit (234), Bash (89), Read (67), Agent (12)
   - Frameworks: npm (15), git (8), python (4)
   - Skills: /yolo (2), /read (5), /plan (1)
3. Daily activity chart shows peaks at 10am and 3pm
4. Clicks into "RealV" project: sees 4 sessions today, most edited file: `dashboard/page.tsx` (14 edits)

**Magic Moment:** The daily chart revealing their actual productivity pattern -- "I do my best work in the morning."

---

## Scenario 3: Cross-Project Context Switch

**Trigger:** Developer finishes work on Project A, opens Claude Code in Project B. Hasn't touched Project B in 3 days.

**Current State:** Developer opens terminal, types "where was I?" Claude has no context. Developer manually checks git log, open PRs, todo files. Loses 5-10 minutes getting oriented.

**Desired State:**
1. Developer opens Claude Code in Project B
2. SessionStart hook fires, queries tracker.db for Project B
3. Hook injects context via additionalContext:
   ```
   ## Claude Pulse -- Project Context
   Last session: 3 days ago (Tuesday, 45 min)
   Files edited: src/auth.ts (6 times), api/routes.ts (3 times)
   Last commands: npm test (passed), git commit "Add JWT validation"
   Plan status: Sprint 2, task 3 of 5 (if lazy-fetch detected)
   ```
4. Claude immediately knows the project state
5. Developer says "continue where I left off" and Claude knows exactly what that means

**Magic Moment:** Claude saying "Last time you were working on JWT validation in auth.ts. The tests were passing. Want to continue with task 4?"

---

## Scenario 4: Plan Progress Tracking

**Trigger:** Developer is mid-sprint on a project using lazy-fetch for planning. Wants to see how actual coding activity maps to the plan.

**Current State:** Developer runs `lazy status` to see task list. Manually estimates progress. No correlation between plan tasks and actual time/code spent.

**Desired State:**
1. Dashboard Project Detail page shows plan progress alongside activity:
   - Sprint: "Phase 2 -- Rich Views" (3/6 tasks done)
   - Time on this sprint: 4.2 hours across 8 sessions
   - Avg time per task: 50 min (based on completed tasks)
   - Estimated remaining: 2.5 hours (3 tasks x 50 min)
2. Each task shows correlated activity:
   - "Build calendar heatmap": 2 sessions, 1.5 hours, 3 files, 234 lines
   - "Add date filtering": not started (0 sessions)
3. Ralph Loop integration shows iteration patterns:
   - "E2E tests" required 4 iterations before passing

**Magic Moment:** Seeing estimated time remaining based on actual velocity -- not gut feeling.

---

## Scenario 5: Session Continuity After Days Away

**Trigger:** Developer returns to a project after a week away (vacation, other priorities).

**Current State:** Complete context loss. Developer stares at the repo, tries to remember what they were doing. Reads recent git log, checks branches, reopens files. 15-20 minutes wasted.

**Desired State:**
1. Opens Claude Code in the project
2. SessionStart hook injects rich context:
   ```
   ## Claude Pulse -- Session Continuity
   Last active: 7 days ago
   Last 3 sessions summary:
   - Mar 20: 1.2 hours, worked on api/metrics/route.ts (8 edits), ran tests (2 failures)
   - Mar 19: 45 min, created dashboard/page.tsx, 3 components
   - Mar 18: 2 hours, database schema, seed data, 4 new files

   Most edited files (last 2 weeks):
   - src/lib/db.ts (23 edits)
   - dashboard/page.tsx (18 edits)
   - api/metrics/route.ts (12 edits)

   Plan: Phase 1 MVP -- 5/7 tasks done
   Uncommitted changes: none (clean working tree)
   ```
3. Developer asks Claude "what should I work on next?"
4. Claude answers with full context, referencing the 2 failing tests and remaining plan tasks

**Magic Moment:** Zero ramp-up time. Claude has perfect memory of what happened, even across a week gap.

---

## Critical Path

**Scenario 1 (First Install) must work perfectly on day one.** If installation fails, breaks existing hooks, or produces no data -- the user uninstalls immediately and never returns. The first impression IS the product.

Second priority: Scenario 2 (Daily Dashboard). If the data is there but the dashboard is confusing or empty-looking, engagement drops.

---

## "Day in the Life" Narrative

**Before Claude Pulse:**
Alex works with Claude Code across three projects. At the end of the week, their manager asks "how much did Claude Code help this sprint?" Alex shrugs -- "a lot, I think?" They vaguely remember writing some API routes and fixing tests, but can't quantify it. They check git blame manually across repos, trying to piece together which commits were AI-assisted. It takes 30 minutes and the answer is still fuzzy.

**After Claude Pulse:**
Alex opens `localhost:3141`. The overview shows: 24 sessions this week, 12.3 hours of AI-assisted coding, 4,820 lines across 3 projects. Their most productive day was Wednesday (2,100 lines, mainly in the auth refactor). They spawned 8 agents (4 Explore, 2 general-purpose, 2 Plan). Most used skill: `/read` (11 times). Framework breakdown: npm (23), git (15), python (6). They screenshot the dashboard and send it to their manager in 30 seconds.
