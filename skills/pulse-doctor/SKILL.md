---
name: pulse-doctor
description: Health check for Claude Pulse — verify dependencies, database, hooks, and recent tracking activity
argument-hint:
allowed-tools: [Bash, Read]
---

# Claude Pulse Doctor

Run a health check to verify Claude Pulse is working correctly.

## Instructions

Check each of these and report pass/fail:

1. **Dependencies**: Run `which jq` and `which sqlite3` — both must exist
2. **Data directory**: Check `~/.claude-pulse/` exists
3. **Hook script**: Check `~/.claude-pulse/hook.sh` exists and is executable (`test -x`)
4. **Database**: Check `~/.claude-pulse/tracker.db` exists, run `.tables` to verify schema includes: sessions, tool_events, daily_summaries, file_activity, insights
5. **Recent activity**: Query `SELECT timestamp FROM tool_events ORDER BY timestamp DESC LIMIT 1` — if older than 1 day, warn that hooks may not be firing
6. **Database size**: Report file size of tracker.db

Format as a checklist with [ok] or [!!] prefixes. If any issues found, suggest the fix command.
