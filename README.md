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

## Dashboard

The dashboard runs on `http://localhost:3141` and includes:

| Page | Description |
|------|-------------|
| **Overview** | KPI cards (sessions, net lines, hours, streak), daily activity table, top skills/frameworks, tool distribution |
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

### Install

```bash
git clone https://github.com/Clemens865/Claude-Pulse.git
cd Claude-Pulse
npm install
```

### Initialize

```bash
npx claude-pulse init
```

This will:
1. Create `~/.claude-pulse/` with the database and config
2. Copy the hook script
3. Register hooks in `~/.claude/settings.json`

### Start the dashboard

```bash
npx claude-pulse start
```

Opens the dashboard at [http://localhost:3141](http://localhost:3141). On first run it uses `next dev`; after `npm run build` it serves the production build.

### Check status from terminal

```bash
npx claude-pulse status
```

Prints a quick summary: session count, events, projects, today's lines, and database size.

### Uninstall hooks

```bash
npx claude-pulse uninstall
```

Removes hooks from Claude Code settings. Data at `~/.claude-pulse/` is preserved.

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
  bin/claude-pulse.mjs        # CLI (init, start, status, uninstall)
  hook/claude-pulse-hook.sh   # Bash hook for Claude Code events
  src/
    app/
      layout.tsx              # Root layout with sidebar navigation
      page.tsx                # Overview dashboard
      projects/               # Projects list + detail pages
      timeline/               # Activity heatmap
      sessions/               # Session detail view
      settings/               # DB info, seed, clear
      api/                    # REST endpoints for each page
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
