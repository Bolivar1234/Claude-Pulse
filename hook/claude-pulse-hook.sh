#!/usr/bin/env bash
set -euo pipefail

# Claude Pulse Hook — Lean Edition
# Metrics-only collector. No context injection, no blocking summaries.
# All session context is handled by the host project's existing hooks.
# Must complete in <100ms. Never fail loudly.

trap 'exit 0' ERR

# --- Dependencies check ---
command -v jq >/dev/null 2>&1 || exit 0
command -v sqlite3 >/dev/null 2>&1 || exit 0

# --- Constants ---
DB_DIR="$HOME/.claude-pulse"
DB_PATH="$DB_DIR/tracker.db"

# --- User identity (for audit trail) ---
PULSE_USER="$(whoami 2>/dev/null)" || PULSE_USER="unknown"
PULSE_HOSTNAME="$(hostname -s 2>/dev/null)" || PULSE_HOSTNAME="unknown"

# --- Read stdin ---
INPUT="$(cat)" || true
[ -z "$INPUT" ] && exit 0

# --- Parse common fields ---
HOOK_TYPE="$(echo "$INPUT" | jq -r '.hook_event_name // .hook_type // empty' 2>/dev/null)" || true
SESSION_ID="$(echo "$INPUT" | jq -r '.session_id // empty' 2>/dev/null)" || true
CWD="$(echo "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)" || true
TOOL_NAME="$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)" || true

[ -z "$HOOK_TYPE" ] && exit 0

if [ -z "$SESSION_ID" ]; then
    SESSION_ID="session-$(date -u '+%Y%m%d-%H%M%S')-$$"
fi

# --- Project detection ---
detect_project() {
    local dir="${1:-.}"
    local repo_root
    repo_root="$(cd "$dir" 2>/dev/null && git rev-parse --show-toplevel 2>/dev/null)" || true
    if [ -n "$repo_root" ]; then
        basename "$repo_root"
    else
        basename "$dir"
    fi
}

PROJECT="$(detect_project "${CWD:-.}")" || PROJECT="unknown"

# --- Language detection ---
detect_language() {
    local fp="$1"
    [ -z "$fp" ] && echo "Unknown" && return
    local ext="${fp##*.}"
    [ "$ext" = "$fp" ] && echo "Unknown" && return
    ext="$(echo "$ext" | tr '[:upper:]' '[:lower:]')"
    case "$ext" in
        js|jsx|mjs|cjs) echo "JavaScript" ;; ts|tsx) echo "TypeScript" ;;
        py) echo "Python" ;; rs) echo "Rust" ;; go) echo "Go" ;;
        rb) echo "Ruby" ;; java) echo "Java" ;; c|h) echo "C" ;;
        cpp|hpp|cc|cxx) echo "C++" ;; cs) echo "C#" ;; swift) echo "Swift" ;;
        sh|bash|zsh) echo "Shell" ;; html|htm) echo "HTML" ;; css) echo "CSS" ;;
        json) echo "JSON" ;; yaml|yml) echo "YAML" ;; toml) echo "TOML" ;;
        md|mdx) echo "Markdown" ;; sql) echo "SQL" ;; vue) echo "Vue" ;;
        svelte) echo "Svelte" ;; tf|hcl) echo "Terraform" ;; php) echo "PHP" ;;
        dart) echo "Dart" ;; zig) echo "Zig" ;; *) echo "Unknown" ;;
    esac
}

# --- Framework detection ---
detect_frameworks() {
    local cmd="$1" fw=""
    [ -z "$cmd" ] && return
    echo "$cmd" | grep -qw 'npm'    && fw="${fw}npm/node,"
    echo "$cmd" | grep -qw 'npx'    && fw="${fw}npx/node,"
    echo "$cmd" | grep -qw 'cargo'  && fw="${fw}cargo/rust,"
    echo "$cmd" | grep -qw 'git'    && fw="${fw}git,"
    echo "$cmd" | grep -qw 'docker' && fw="${fw}docker,"
    echo "$cmd" | grep -qw 'python3\?\|python' && fw="${fw}python,"
    echo "$cmd" | grep -qw 'go'     && fw="${fw}go,"
    echo "$cmd" | grep -qw 'make'   && fw="${fw}make,"
    echo "$cmd" | grep -qw 'curl'   && fw="${fw}curl/http,"
    echo "$cmd" | grep -qw 'kubectl' && fw="${fw}kubectl/k8s,"
    echo "${fw%,}"
}

# --- SQL helper ---
sql_escape() { echo "$1" | sed "s/'/''/g"; }

NOW="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
TODAY="$(date -u '+%Y-%m-%d')"

# --- Ensure DB ---
ensure_db() {
    mkdir -p "$DB_DIR" 2>/dev/null || true
    if [ ! -f "$DB_PATH" ]; then
        sqlite3 "$DB_PATH" <<'SCHEMA'
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    project TEXT NOT NULL,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    ended_at TEXT,
    duration_seconds INTEGER,
    summary TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed', 'crashed')),
    user TEXT,
    hostname TEXT
);

CREATE TABLE IF NOT EXISTS tool_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    tool_name TEXT NOT NULL,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    file_path TEXT,
    language TEXT,
    lines_added INTEGER DEFAULT 0,
    lines_removed INTEGER DEFAULT 0,
    command TEXT,
    detected_framework TEXT,
    command_failed INTEGER DEFAULT 0,
    search_pattern TEXT,
    agent_type TEXT,
    agent_description TEXT,
    skill_name TEXT,
    skill_args TEXT,
    metadata TEXT DEFAULT '{}',
    diff_content TEXT
);

CREATE TABLE IF NOT EXISTS daily_summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    project TEXT NOT NULL,
    session_count INTEGER DEFAULT 0,
    total_duration_seconds INTEGER DEFAULT 0,
    lines_added INTEGER DEFAULT 0,
    lines_removed INTEGER DEFAULT 0,
    net_lines INTEGER DEFAULT 0,
    files_created INTEGER DEFAULT 0,
    files_edited INTEGER DEFAULT 0,
    files_read INTEGER DEFAULT 0,
    tool_calls INTEGER DEFAULT 0,
    bash_commands INTEGER DEFAULT 0,
    bash_failures INTEGER DEFAULT 0,
    searches INTEGER DEFAULT 0,
    agents_spawned INTEGER DEFAULT 0,
    skills_used TEXT DEFAULT '{}',
    frameworks_detected TEXT DEFAULT '{}',
    languages TEXT DEFAULT '{}',
    tool_counts TEXT DEFAULT '{}',
    UNIQUE(date, project)
);

CREATE TABLE IF NOT EXISTS insights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT REFERENCES sessions(id),
    project TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('progress','decision','pattern','fix','context','blocked')),
    content TEXT NOT NULL,
    reasoning TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS file_activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL,
    project TEXT NOT NULL,
    date TEXT NOT NULL,
    edit_count INTEGER DEFAULT 0,
    write_count INTEGER DEFAULT 0,
    read_count INTEGER DEFAULT 0,
    lines_added INTEGER DEFAULT 0,
    lines_removed INTEGER DEFAULT 0,
    language TEXT,
    UNIQUE(file_path, project, date)
);

CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_events_session ON tool_events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON tool_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_tool ON tool_events(tool_name);
CREATE INDEX IF NOT EXISTS idx_events_session_tool ON tool_events(session_id, tool_name);
CREATE INDEX IF NOT EXISTS idx_summaries_date ON daily_summaries(date);
CREATE INDEX IF NOT EXISTS idx_summaries_project ON daily_summaries(project);
CREATE INDEX IF NOT EXISTS idx_insights_project ON insights(project);
CREATE INDEX IF NOT EXISTS idx_insights_type ON insights(type);
CREATE INDEX IF NOT EXISTS idx_file_activity_path ON file_activity(file_path);
CREATE INDEX IF NOT EXISTS idx_file_activity_date ON file_activity(date);

INSERT OR IGNORE INTO schema_version (version) VALUES (3);
SCHEMA
    else
        # Migrate existing DB
        sqlite3 "$DB_PATH" "CREATE TABLE IF NOT EXISTS insights (
            id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT REFERENCES sessions(id),
            project TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('progress','decision','pattern','fix','context','blocked')),
            content TEXT NOT NULL, reasoning TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );" 2>/dev/null || true
        sqlite3 "$DB_PATH" "ALTER TABLE sessions ADD COLUMN user TEXT;" 2>/dev/null || true
        sqlite3 "$DB_PATH" "ALTER TABLE sessions ADD COLUMN hostname TEXT;" 2>/dev/null || true
        sqlite3 "$DB_PATH" "ALTER TABLE tool_events ADD COLUMN diff_content TEXT;" 2>/dev/null || true
    fi
    sqlite3 "$DB_PATH" "PRAGMA journal_mode=WAL;" >/dev/null 2>&1 || true
}

# =============================================================================
# SESSION START — just record, no context injection
# =============================================================================
handle_session_start() {
    ensure_db
    sqlite3 "$DB_PATH" "INSERT OR IGNORE INTO sessions (id, project, started_at, status, user, hostname)
        VALUES ('$(sql_escape "$SESSION_ID")', '$(sql_escape "$PROJECT")', '$NOW', 'active',
        '$(sql_escape "$PULSE_USER")', '$(sql_escape "$PULSE_HOSTNAME")');" 2>/dev/null || true
}

# =============================================================================
# TOOL EVENT — collect metrics only
# =============================================================================
handle_tool_event() {
    ensure_db

    local esc_project esc_sid
    esc_project="$(sql_escape "$PROJECT")"
    esc_sid="$(sql_escape "$SESSION_ID")"

    # Ensure session exists
    sqlite3 "$DB_PATH" "INSERT OR IGNORE INTO sessions (id, project, started_at, status, user, hostname)
        VALUES ('$esc_sid', '$esc_project', '$NOW', 'active',
        '$(sql_escape "$PULSE_USER")', '$(sql_escape "$PULSE_HOSTNAME")');" 2>/dev/null || true

    local file_path="" language="" lines_added=0 lines_removed=0
    local command="" framework="" command_failed=0
    local search_pattern="" agent_type="" agent_desc=""
    local skill_name="" skill_args="" diff_text=""

    local tool_input
    tool_input="$(echo "$INPUT" | jq -c '.tool_input // {}' 2>/dev/null)" || tool_input="{}"

    case "$TOOL_NAME" in
        Edit)
            file_path="$(echo "$tool_input" | jq -r '.file_path // empty' 2>/dev/null)" || true
            language="$(detect_language "$file_path")"
            local old_str new_str
            old_str="$(echo "$tool_input" | jq -r '.old_string // empty' 2>/dev/null)" || true
            new_str="$(echo "$tool_input" | jq -r '.new_string // empty' 2>/dev/null)" || true
            [ -n "$old_str" ] && lines_removed="$(echo "$old_str" | wc -l | tr -d ' ')" || lines_removed=0
            [ -n "$new_str" ] && lines_added="$(echo "$new_str" | wc -l | tr -d ' ')" || lines_added=0
            if [ -n "$old_str" ] || [ -n "$new_str" ]; then
                diff_text="$(printf '%s\n%s\n%s\n%s' '--- old' "$(echo "$old_str" | head -c 1024)" '+++ new' "$(echo "$new_str" | head -c 1024)")"
            fi
            sqlite3 "$DB_PATH" "INSERT INTO file_activity (file_path, project, date, edit_count, lines_added, lines_removed, language)
                VALUES ('$(sql_escape "$file_path")', '$esc_project', '$TODAY', 1, $lines_added, $lines_removed, '$(sql_escape "$language")')
                ON CONFLICT(file_path, project, date) DO UPDATE SET
                    edit_count = edit_count + 1, lines_added = lines_added + $lines_added, lines_removed = lines_removed + $lines_removed;" 2>/dev/null || true
            ;;
        Write)
            file_path="$(echo "$tool_input" | jq -r '.file_path // empty' 2>/dev/null)" || true
            language="$(detect_language "$file_path")"
            local content
            content="$(echo "$tool_input" | jq -r '.content // empty' 2>/dev/null)" || true
            [ -n "$content" ] && lines_added="$(echo "$content" | wc -l | tr -d ' ')" || lines_added=0
            sqlite3 "$DB_PATH" "INSERT INTO file_activity (file_path, project, date, write_count, lines_added, language)
                VALUES ('$(sql_escape "$file_path")', '$esc_project', '$TODAY', 1, $lines_added, '$(sql_escape "$language")')
                ON CONFLICT(file_path, project, date) DO UPDATE SET
                    write_count = write_count + 1, lines_added = lines_added + $lines_added;" 2>/dev/null || true
            ;;
        Bash)
            command="$(echo "$tool_input" | jq -r '.command // empty' 2>/dev/null)" || true
            framework="$(detect_frameworks "$command")"
            local exit_code
            exit_code="$(echo "$INPUT" | jq -r '.tool_response.exit_code // .tool_output.exit_code // 0' 2>/dev/null)" || exit_code=0
            [ "$exit_code" != "0" ] && [ "$exit_code" != "null" ] && [ -n "$exit_code" ] && command_failed=1
            ;;
        Read)
            file_path="$(echo "$tool_input" | jq -r '.file_path // empty' 2>/dev/null)" || true
            language="$(detect_language "$file_path")"
            [ -n "$file_path" ] && sqlite3 "$DB_PATH" "INSERT INTO file_activity (file_path, project, date, read_count, language)
                VALUES ('$(sql_escape "$file_path")', '$esc_project', '$TODAY', 1, '$(sql_escape "$language")')
                ON CONFLICT(file_path, project, date) DO UPDATE SET read_count = read_count + 1;" 2>/dev/null || true
            ;;
        Glob|Grep)
            search_pattern="$(echo "$tool_input" | jq -r '.pattern // empty' 2>/dev/null)" || true
            ;;
        Agent)
            agent_type="$(echo "$tool_input" | jq -r '.type // .agent_type // .subagent_type // empty' 2>/dev/null)" || true
            agent_desc="$(echo "$tool_input" | jq -r '.description // .prompt // empty' 2>/dev/null)" || true
            ;;
        Skill)
            skill_name="$(echo "$tool_input" | jq -r '.skill // .name // empty' 2>/dev/null)" || true
            skill_args="$(echo "$tool_input" | jq -r '.args // empty' 2>/dev/null)" || true
            ;;
    esac

    sqlite3 "$DB_PATH" "INSERT INTO tool_events (
        session_id, tool_name, timestamp, file_path, language,
        lines_added, lines_removed, command, detected_framework,
        command_failed, search_pattern, agent_type, agent_description,
        skill_name, skill_args, metadata, diff_content
    ) VALUES (
        '$esc_sid', '$(sql_escape "$TOOL_NAME")', '$NOW',
        '$(sql_escape "$file_path")', '$(sql_escape "$language")',
        $lines_added, $lines_removed,
        '$(sql_escape "$command")', '$(sql_escape "$framework")',
        $command_failed, '$(sql_escape "$search_pattern")',
        '$(sql_escape "$agent_type")', '$(sql_escape "$agent_desc")',
        '$(sql_escape "$skill_name")', '$(sql_escape "$skill_args")',
        '{}', '$(sql_escape "${diff_text:-}")'
    );" 2>/dev/null || true
}

# =============================================================================
# SESSION STOP — finalize metrics, no blocking summary prompt
# =============================================================================
handle_session_stop() {
    ensure_db

    local status="completed"
    [ "$HOOK_TYPE" = "StopFailure" ] && status="crashed"

    local esc_sid esc_project
    esc_sid="$(sql_escape "$SESSION_ID")"
    esc_project="$(sql_escape "$PROJECT")"

    # Calculate duration
    local start_time duration=0
    start_time="$(sqlite3 "$DB_PATH" "SELECT started_at FROM sessions WHERE id='$esc_sid';" 2>/dev/null)" || true

    if [ -n "$start_time" ]; then
        local start_epoch end_epoch
        if date -j -f "%Y-%m-%dT%H:%M:%SZ" "$start_time" "+%s" >/dev/null 2>&1; then
            start_epoch="$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$start_time" "+%s" 2>/dev/null)" || start_epoch=0
        else
            start_epoch="$(date -d "$start_time" "+%s" 2>/dev/null)" || start_epoch=0
        fi
        end_epoch="$(date -u "+%s")"
        [ "$start_epoch" -gt 0 ] 2>/dev/null && duration=$(( end_epoch - start_epoch ))
    fi

    # Update session
    sqlite3 "$DB_PATH" "UPDATE sessions SET ended_at='$NOW', duration_seconds=$duration, status='$status'
        WHERE id='$esc_sid';" 2>/dev/null || true

    # Compute daily summary
    local session_date
    session_date="$(sqlite3 "$DB_PATH" "SELECT date(started_at) FROM sessions WHERE id='$esc_sid';" 2>/dev/null)" || session_date="$TODAY"

    # Aggregate JSON fields
    local tool_counts_json
    tool_counts_json="$(sqlite3 "$DB_PATH" "
        SELECT '{' || GROUP_CONCAT('\"' || tool_name || '\":' || cnt) || '}'
        FROM (SELECT tool_name, COUNT(*) as cnt FROM tool_events
              WHERE session_id='$esc_sid' GROUP BY tool_name ORDER BY cnt DESC);
    " 2>/dev/null)" || tool_counts_json="{}"
    [ -z "$tool_counts_json" ] || [ "$tool_counts_json" = "{null}" ] && tool_counts_json="{}"

    local languages_json
    languages_json="$(sqlite3 "$DB_PATH" "
        SELECT '{' || GROUP_CONCAT('\"' || language || '\":' || cnt) || '}'
        FROM (SELECT language, COUNT(*) as cnt FROM tool_events
              WHERE session_id='$esc_sid' AND language IS NOT NULL AND language != '' AND language != 'Unknown'
              GROUP BY language ORDER BY cnt DESC);
    " 2>/dev/null)" || languages_json="{}"
    [ -z "$languages_json" ] || [ "$languages_json" = "{null}" ] && languages_json="{}"

    sqlite3 "$DB_PATH" "
    INSERT INTO daily_summaries (date, project, session_count, total_duration_seconds,
        lines_added, lines_removed, net_lines, files_created, files_edited, files_read,
        tool_calls, bash_commands, bash_failures, searches, agents_spawned,
        skills_used, frameworks_detected, languages, tool_counts)
    SELECT
        '$session_date', '$esc_project',
        (SELECT COUNT(*) FROM sessions WHERE project='$esc_project' AND date(started_at)='$session_date' AND status IN ('completed','crashed')),
        (SELECT COALESCE(SUM(duration_seconds),0) FROM sessions WHERE project='$esc_project' AND date(started_at)='$session_date'),
        COALESCE(SUM(lines_added),0), COALESCE(SUM(lines_removed),0),
        COALESCE(SUM(lines_added),0) - COALESCE(SUM(lines_removed),0),
        (SELECT COUNT(DISTINCT file_path) FROM tool_events WHERE session_id='$esc_sid' AND tool_name='Write'),
        (SELECT COUNT(DISTINCT file_path) FROM tool_events WHERE session_id='$esc_sid' AND tool_name='Edit'),
        (SELECT COUNT(DISTINCT file_path) FROM tool_events WHERE session_id='$esc_sid' AND tool_name='Read'),
        COUNT(*),
        (SELECT COUNT(*) FROM tool_events WHERE session_id='$esc_sid' AND tool_name='Bash'),
        (SELECT COUNT(*) FROM tool_events WHERE session_id='$esc_sid' AND tool_name='Bash' AND command_failed=1),
        (SELECT COUNT(*) FROM tool_events WHERE session_id='$esc_sid' AND tool_name IN ('Glob','Grep')),
        (SELECT COUNT(*) FROM tool_events WHERE session_id='$esc_sid' AND tool_name='Agent'),
        '{}', '{}',
        '$(sql_escape "$languages_json")',
        '$(sql_escape "$tool_counts_json")'
    FROM tool_events WHERE session_id='$esc_sid'
    ON CONFLICT(date, project) DO UPDATE SET
        session_count = excluded.session_count,
        total_duration_seconds = excluded.total_duration_seconds,
        lines_added = daily_summaries.lines_added + excluded.lines_added,
        lines_removed = daily_summaries.lines_removed + excluded.lines_removed,
        net_lines = daily_summaries.net_lines + excluded.net_lines,
        files_created = daily_summaries.files_created + excluded.files_created,
        files_edited = daily_summaries.files_edited + excluded.files_edited,
        files_read = daily_summaries.files_read + excluded.files_read,
        tool_calls = daily_summaries.tool_calls + excluded.tool_calls,
        bash_commands = daily_summaries.bash_commands + excluded.bash_commands,
        bash_failures = daily_summaries.bash_failures + excluded.bash_failures,
        searches = daily_summaries.searches + excluded.searches,
        agents_spawned = daily_summaries.agents_spawned + excluded.agents_spawned,
        languages = excluded.languages,
        tool_counts = excluded.tool_counts;
    " 2>/dev/null || true
}

# =============================================================================
# EVENT ROUTING
# =============================================================================
case "$HOOK_TYPE" in
    SessionStart)       handle_session_start ;;
    PostToolUse)        handle_tool_event ;;
    Stop|StopFailure)   handle_session_stop ;;
    *)                  ensure_db ;;  # Acknowledge, no-op
esac

exit 0
