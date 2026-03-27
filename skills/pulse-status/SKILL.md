---
name: pulse-status
description: Show Claude Pulse tracking status — session counts, events, lines written, database health
argument-hint:
allowed-tools: [Bash, Read]
---

# Claude Pulse Status

Show a quick summary of Claude Pulse tracking data.

## Instructions

Run this command to display the current tracking status:

```bash
sqlite3 ~/.claude-pulse/tracker.db "
SELECT
  (SELECT COUNT(*) FROM sessions) as total_sessions,
  (SELECT COUNT(*) FROM sessions WHERE date(started_at) = date('now')) as today_sessions,
  (SELECT COUNT(*) FROM tool_events) as total_events,
  (SELECT COUNT(DISTINCT project) FROM sessions) as projects,
  (SELECT COUNT(*) FROM insights) as total_insights;
"
```

Then format the output as a clean status report showing:
- Total sessions and today's count
- Total tool events tracked
- Number of projects
- Number of insights captured
- Database size (check file size of `~/.claude-pulse/tracker.db`)
- Dashboard URL: http://localhost:3141
