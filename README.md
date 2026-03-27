# Claude Pulse

A personal dashboard that tracks everything you do with [Claude Code](https://docs.anthropic.com/en/docs/claude-code). It runs silently in the background, recording your sessions, and gives you a visual overview of your coding activity — what you built, what decisions you made, and how your projects are progressing.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![SQLite](https://img.shields.io/badge/SQLite-WAL-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## What does it do?

Every time you use Claude Code, Claude Pulse quietly captures what happens:

- **What you worked on** — which files were edited, created, or read
- **How much you wrote** — lines added and removed, per file and per day
- **What tools were used** — edits, bash commands, searches, agent spawns
- **Your decisions** — at the end of meaningful sessions, it captures what you accomplished, key decisions, and what's left to do
- **Your streaks** — consecutive days of coding activity

All of this is stored locally on your machine in a small SQLite database. Nothing is sent anywhere.

## How to set it up

### What you need first

1. **Claude Code** — the CLI tool from Anthropic ([install guide](https://docs.anthropic.com/en/docs/claude-code))
2. **Node.js 18 or newer** — download from [nodejs.org](https://nodejs.org) if you don't have it
3. **jq** and **sqlite3** — small command-line tools

If you're on macOS with [Homebrew](https://brew.sh):
```bash
brew install jq sqlite3
```

On Ubuntu/Debian Linux:
```bash
sudo apt install jq sqlite3
```

### Step 1: Download Claude Pulse

```bash
git clone https://github.com/Clemens865/Claude-Pulse.git
cd Claude-Pulse
npm install
```

### Step 2: Set it up

```bash
npx claude-pulse init
```

This does three things automatically:
1. Creates a folder at `~/.claude-pulse/` to store your data
2. Installs a small tracking script
3. Connects it to Claude Code so it starts recording

You'll see a confirmation like this:
```
  Claude Pulse — Setup

  [ok] Dependencies found (jq, sqlite3)
  [ok] Directory: ~/.claude-pulse
  [ok] Hook installed
  [ok] Database created with WAL mode
  [ok] Hooks merged into ~/.claude/settings.json

  Done! Claude Pulse is active for all projects.
```

### Step 3: Use Claude Code normally

That's it. Just use Claude Code as you normally would — in any project, in any directory. Claude Pulse runs in the background and records everything automatically. You don't need to do anything different.

### Step 4: View your dashboard

Whenever you want to see your activity:

```bash
npx claude-pulse start
```

Open your browser to **http://localhost:3141** and you'll see your dashboard.

## The Dashboard

### Overview
The main page shows your key numbers at a glance:
- Total sessions, net lines of code written, hours spent, active projects
- A daily activity table for the last 14 days
- Most-used tools, skills, and frameworks

### Brain
The "Brain" page is where the interesting stuff lives. At the end of each meaningful session, Claude Pulse captures structured insights:
- **Progress** — what was accomplished
- **Decisions** — key choices and why they were made
- **Blocked** — what's stuck or left to do

These are displayed as a timeline you can filter by type or project. Think of it as a log of your thinking, not just your typing.

Trivial sessions (just reading files, checking status) are automatically skipped — no noise.

### Projects
See all your projects ranked by activity. Click any project to see:
- Session history and duration
- Most-edited files
- Daily line counts and tool usage

### Timeline
A 90-day GitHub-style heatmap showing your coding activity. Darker squares = more active days.

### Session Detail
Click any session to see the full event timeline — every file edit, bash command, search, and agent spawn, in order.

### Settings
Database info, record counts, and a button to generate demo data if you want to see how it looks before real data accumulates.

## Quick reference

| Command | What it does |
|---------|-------------|
| `npx claude-pulse init` | First-time setup (safe to re-run) |
| `npx claude-pulse start` | Open the dashboard |
| `npx claude-pulse status` | Quick summary in the terminal |
| `npx claude-pulse doctor` | Check that everything is working |
| `npx claude-pulse uninstall` | Remove tracking (your data is kept) |

## How it works (the short version)

```
You use Claude Code
       |
       v
Claude Code fires hook events (session start, tool use, session end)
       |
       v
A small bash script captures each event → stores in SQLite
       |
       v
The dashboard reads SQLite → shows your analytics
```

Everything stays on your machine. The database lives at `~/.claude-pulse/tracker.db`.

## How it works (the detailed version)

1. **`claude-pulse init`** adds three hooks to Claude Code's settings file (`~/.claude/settings.json`):
   - **SessionStart** — records when you begin a session
   - **PostToolUse** — records each tool call (runs async, doesn't slow Claude down)
   - **Stop** — finalizes the session, computes daily summaries, and optionally captures structured insights

2. The hook script (`hook/claude-pulse-hook.sh`) receives JSON from Claude Code on stdin, parses it with `jq`, and writes to SQLite with `sqlite3`. It detects languages from file extensions, frameworks from bash commands, and tracks line changes from edits.

3. **Smart session summaries**: When a session ends, the hook checks how much work was done. If it was a meaningful session (edits, commands, agent spawns), it asks Claude for a structured summary. If it was trivial (just reading files), it auto-closes silently.

4. The dashboard is a Next.js app that reads directly from the same SQLite database. No API keys, no cloud services, no accounts.

## Troubleshooting

### "No data showing up"

Run the health check:
```bash
npx claude-pulse doctor
```

This will tell you exactly what's wrong — missing dependencies, hooks not registered, database issues.

### "jq or sqlite3 not found"

Install them:
```bash
# macOS
brew install jq sqlite3

# Ubuntu/Debian
sudo apt install jq sqlite3
```

Then re-run `npx claude-pulse init`.

### "Dashboard won't start"

Make sure port 3141 isn't already in use:
```bash
lsof -i :3141
```

If something is already running on that port, stop it first.

### "I want to start fresh"

To reset all data:
```bash
rm ~/.claude-pulse/tracker.db
npx claude-pulse init
```

To completely remove Claude Pulse:
```bash
npx claude-pulse uninstall   # removes hooks from Claude Code
rm -rf ~/.claude-pulse        # removes all data
```

## Database

All data is stored locally in SQLite at `~/.claude-pulse/tracker.db`:

| Table | What it stores |
|-------|---------------|
| `sessions` | One row per Claude Code session (start time, duration, status, summary) |
| `tool_events` | Every tool call — edits, reads, bash commands, searches, agent spawns |
| `insights` | Structured entries: progress, decisions, patterns, fixes, blockers |
| `daily_summaries` | Pre-computed daily totals (survives if old events are cleaned up) |
| `file_activity` | Per-file daily edit/read/write counts |

## For developers

### Tech stack

- Next.js 16 (App Router) + React 19 + Tailwind CSS 4
- better-sqlite3 (WAL mode)
- TypeScript 5.9
- Bash hook script (jq + sqlite3)

### Development

```bash
npm run dev       # Dev server on port 3141
npm run build     # Production build
npm run lint      # ESLint
```

### Plugin structure

Claude Pulse can also work as a Claude Code plugin. The repo includes:
- `.claude-plugin/plugin.json` — plugin metadata
- `hooks/hooks.json` — auto-registered hooks using `${CLAUDE_PLUGIN_ROOT}`
- `skills/` — slash commands (`/pulse-status`, `/pulse-doctor`)

### Demo data

Visit the Settings page in the dashboard or POST to `/api/seed` to generate 30 days of realistic sample data.

## License

MIT
