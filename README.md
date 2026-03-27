# Claude Pulse

Local-first activity tracker for [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Automatically captures session events via hooks, stores them in SQLite, and visualizes your coding activity in a Next.js dashboard.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![SQLite](https://img.shields.io/badge/SQLite-WAL-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## What it tracks

- **Sessions** -- start/end times, duration, status (active/completed/crashed)
- **Tool usage** -- every Edit, Write, Read, Bash, Grep, Glob, Agent, and Skill call
- **Code metrics** -- lines added/removed per file, per session, per day
- **File activity** -- most-edited files, hotspot detection (20+ edits in a session)
- **Frameworks & languages** -- auto-detected from commands and file extensions
- **Productivity streaks** -- consecutive days of activity
- **Brain (insights)** -- structured progress, decisions, and blockers captured at session end
- **Smart gating** -- only asks for summaries on meaningful sessions, skips read-only ones

## Dashboard

The dashboard runs on `http://localhost:3141` and includes:

| Page | Description |
|------|-------------|
| **Overview** | KPI cards (sessions, net lines, hours, streak), daily activity table, top skills/frameworks, tool distribution |
| **Brain** | Decisions, progress, and blockers timeline — filterable by type and project |
| **Projects** | Sortable table of all projects with session counts, durations, and line metrics |
| **Project Detail** | Per-project KPIs, daily breakdown, most-edited files, recent sessions |
| **Timeline** | 90-day GitHub-style activity heatmap with daily breakdown |
| **Session Detail** | Tool event timeline, file hotspots, tool and line breakdowns |
| **Settings** | Database info, hook status, record counts, seed/clear actions |

## Quick Start

### Prerequisites

- Node.js 18+
- `jq` and `sqlite3` (the hook script uses these)
- Claude Code installed

### Option A: npm (recommended)

```bash
npm install -g claude-pulse
claude-pulse init
claude-pulse start
```

### Option B: Clone and run

```bash
git clone https://github.com/Clemens865/Claude-Pulse.git
cd Claude-Pulse
npm install
npx claude-pulse init
npx claude-pulse start
```

### What `init` does

1. Creates `~/.claude-pulse/` with the database and config
2. Copies the hook script
3. Registers hooks in `~/.claude/settings.json` (with backup)

### Commands

```bash
claude-pulse init        # Set up hooks and database
claude-pulse start       # Open dashboard at http://localhost:3141
claude-pulse status      # Quick terminal summary
claude-pulse doctor      # Health check — verify everything works
claude-pulse uninstall   # Remove hooks (data preserved)
```

### Health Check

```bash
claude-pulse doctor
```

Verifies: dependencies installed, database healthy, hooks registered, PostToolUse is async, recent events flowing.

## How it works

```
Claude Code session
       |
       v
  Hook events (SessionStart, PostToolUse, Stop)
       |
       v
  claude-pulse-hook.sh  -->  SQLite (~/. claude-pulse/tracker.db)
       |
       v
  Next.js dashboard (localhost:3141)
```

1. **`claude-pulse init`** registers a bash hook into Claude Code's `~/.claude/settings.json`
2. On every Claude Code session, the hook receives JSON events via stdin
3. The hook script parses each event and inserts rows into SQLite (sessions, tool_events, file_activity)
4. On session end, daily summaries are computed and upserted
5. The Next.js dashboard queries SQLite and renders the analytics

## Project Structure

```
claude-pulse/
  .claude-plugin/plugin.json  # Claude Code plugin metadata
  bin/claude-pulse.mjs        # CLI (init, start, status, doctor, uninstall)
  hook/claude-pulse-hook.sh   # Bash hook for Claude Code events
  hooks/hooks.json            # Plugin hook registration (auto-loaded)
  skills/                     # Plugin slash commands (/pulse-status, /pulse-doctor)
  src/
    app/
      layout.tsx              # Root layout with sidebar navigation
      page.tsx                # Overview dashboard
      brain/                  # Insights timeline (decisions, progress, blockers)
      projects/               # Projects list + detail pages
      timeline/               # Activity heatmap
      sessions/               # Session detail view
      settings/               # DB info, seed, clear
      api/                    # REST endpoints (overview, insights, projects, sessions, timeline)
    lib/
      db.ts                   # Singleton SQLite connection
      schema.ts               # Table definitions + migrations
      types.ts                # TypeScript interfaces
      frameworks.ts           # Framework detection patterns
      languages.ts            # File extension -> language map
```

## Database

SQLite with WAL mode, stored at `~/.claude-pulse/tracker.db`.

| Table | Purpose |
|-------|---------|
| `sessions` | One row per Claude Code session |
| `tool_events` | Append-only log of every tool call |
| `insights` | Typed entries: progress, decision, pattern, fix, context, blocked |
| `daily_summaries` | Pre-computed daily aggregates (survives event purge) |
| `file_activity` | Per-file daily edit/read/write counts |

## Development

```bash
npm run dev       # Start dev server on port 3141
npm run build     # Production build
npm run lint      # ESLint
```

## Demo Data

Visit the Settings page or POST to `/api/seed` to generate 30 days of realistic demo data.

## Tech Stack

- **Next.js 16** with App Router
- **React 19**
- **Tailwind CSS 4**
- **better-sqlite3** (WAL mode, 8MB cache)
- **TypeScript 5.9**

## License

MIT
