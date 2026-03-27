#!/usr/bin/env bash
set -euo pipefail

# Claude Pulse Hook Script
# Receives events from Claude Code, writes to SQLite.
# Must complete in <100ms. Never fail loudly.

trap 'exit 0' ERR

# --- Dependencies check ---
command -v jq >/dev/null 2>&1 || { echo '{"error":"jq not found"}' >&2; exit 0; }
command -v sqlite3 >/dev/null 2>&1 || { echo '{"error":"sqlite3 not found"}' >&2; exit 0; }

# --- Constants ---
DB_DIR="$HOME/.claude-pulse"
DB_PATH="$DB_DIR/tracker.db"
SESSION_DIR="/tmp/claude-pulse-$$"

# --- Read stdin (JSON payload from Claude Code) ---
INPUT="$(cat)" || true
[ -z "$INPUT" ] && exit 0

# --- Parse common fields ---
HOOK_TYPE="$(echo "$INPUT" | jq -r '.hook_type // empty' 2>/dev/null)" || true
SESSION_ID="$(echo "$INPUT" | jq -r '.session_id // empty' 2>/dev/null)" || true
CWD="$(echo "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)" || true
TOOL_NAME="$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)" || true

[ -z "$HOOK_TYPE" ] && exit 0

# --- Session dir from Claude session ID ---
if [ -n "$SESSION_ID" ]; then
    SESSION_DIR="/tmp/claude-pulse-${SESSION_ID}"
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

# --- Language detection from file extension ---
detect_language() {
    local fp="$1"
    [ -z "$fp" ] && echo "Unknown" && return
    local base ext
    base="$(basename "$fp" | tr '[:upper:]' '[:lower:]')"
    case "$base" in
        dockerfile|dockerfile.*) echo "Docker"; return ;;
        makefile|gnumakefile) echo "Makefile"; return ;;
        rakefile|gemfile) echo "Ruby"; return ;;
    esac
    ext="${fp##*.}"
    [ "$ext" = "$fp" ] && echo "Unknown" && return
    ext="$(echo "$ext" | tr '[:upper:]' '[:lower:]')"
    case "$ext" in
        js|jsx|mjs|cjs) echo "JavaScript" ;;
        ts|tsx) echo "TypeScript" ;;
        py) echo "Python" ;;
        rs) echo "Rust" ;;
        go) echo "Go" ;;
        rb) echo "Ruby" ;;
        java) echo "Java" ;;
        c|h) echo "C" ;;
        cpp|hpp|cc|cxx) echo "C++" ;;
        cs) echo "C#" ;;
        swift) echo "Swift" ;;
        kt) echo "Kotlin" ;;
        sh|bash|zsh|fish) echo "Shell" ;;
        html|htm) echo "HTML" ;;
        css) echo "CSS" ;;
        scss|sass) echo "SCSS" ;;
        json) echo "JSON" ;;
        yaml|yml) echo "YAML" ;;
        toml) echo "TOML" ;;
        xml) echo "XML" ;;
        md|mdx) echo "Markdown" ;;
        sql) echo "SQL" ;;
        prisma) echo "Prisma" ;;
        graphql|gql) echo "GraphQL" ;;
        vue) echo "Vue" ;;
        svelte) echo "Svelte" ;;
        tf|hcl) echo "Terraform" ;;
        proto) echo "Protobuf" ;;
        r) echo "R" ;;
        lua) echo "Lua" ;;
        php) echo "PHP" ;;
        pl) echo "Perl" ;;
        ex|exs) echo "Elixir" ;;
        dart) echo "Dart" ;;
        zig) echo "Zig" ;;
        *) echo "Unknown" ;;
    esac
}

# --- Framework detection from bash command ---
detect_frameworks() {
    local cmd="$1"
    local frameworks=""
    [ -z "$cmd" ] && return
    # Order matters: docker-compose before docker
    echo "$cmd" | grep -qw 'npm' && frameworks="${frameworks}npm/node,"
    echo "$cmd" | grep -qw 'npx' && frameworks="${frameworks}npx/node,"
    echo "$cmd" | grep -qw 'yarn' && frameworks="${frameworks}yarn/node,"
    echo "$cmd" | grep -qw 'pnpm' && frameworks="${frameworks}pnpm/node,"
    echo "$cmd" | grep -qw 'bun' && frameworks="${frameworks}bun,"
    echo "$cmd" | grep -qw 'node' && frameworks="${frameworks}node,"
    echo "$cmd" | grep -qw 'git' && frameworks="${frameworks}git,"
    echo "$cmd" | grep -qw 'docker-compose' && frameworks="${frameworks}docker-compose,"
    echo "$cmd" | grep -qw 'docker' && frameworks="${frameworks}docker,"
    echo "$cmd" | grep -qw 'python3\?\|python' && frameworks="${frameworks}python,"
    echo "$cmd" | grep -qw 'pip3\?\|pip' && frameworks="${frameworks}pip/python,"
    echo "$cmd" | grep -qw 'pytest' && frameworks="${frameworks}pytest/python,"
    echo "$cmd" | grep -qw 'uv' && frameworks="${frameworks}uv/python,"
    echo "$cmd" | grep -qw 'cargo' && frameworks="${frameworks}cargo/rust,"
    echo "$cmd" | grep -qw 'rustc' && frameworks="${frameworks}rustc/rust,"
    echo "$cmd" | grep -qw 'go' && frameworks="${frameworks}go,"
    echo "$cmd" | grep -qw 'ruby' && frameworks="${frameworks}ruby,"
    echo "$cmd" | grep -qw 'rails' && frameworks="${frameworks}rails/ruby,"
    echo "$cmd" | grep -qw 'bundle' && frameworks="${frameworks}bundler/ruby,"
    echo "$cmd" | grep -qw 'kubectl' && frameworks="${frameworks}kubectl/k8s,"
    echo "$cmd" | grep -qw 'helm' && frameworks="${frameworks}helm/k8s,"
    echo "$cmd" | grep -qw 'terraform' && frameworks="${frameworks}terraform,"
    echo "$cmd" | grep -qw 'aws' && frameworks="${frameworks}aws,"
    echo "$cmd" | grep -qw 'gcloud' && frameworks="${frameworks}gcloud,"
    echo "$cmd" | grep -qw 'az' && frameworks="${frameworks}azure,"
    echo "$cmd" | grep -qw 'curl' && frameworks="${frameworks}curl/http,"
    echo "$cmd" | grep -qw 'wget' && frameworks="${frameworks}wget/http,"
    echo "$cmd" | grep -qw 'psql' && frameworks="${frameworks}psql/postgres,"
    echo "$cmd" | grep -qw 'mysql' && frameworks="${frameworks}mysql,"
    echo "$cmd" | grep -qw 'sqlite3' && frameworks="${frameworks}sqlite,"
    echo "$cmd" | grep -qw 'make' && frameworks="${frameworks}make,"
    echo "$cmd" | grep -qw 'cmake' && frameworks="${frameworks}cmake,"
    echo "$cmd" | grep -qw 'fly' && frameworks="${frameworks}fly.io,"
    echo "$cmd" | grep -qw 'vercel' && frameworks="${frameworks}vercel,"
    echo "$cmd" | grep -qw 'netlify' && frameworks="${frameworks}netlify,"
    echo "$cmd" | grep -qw 'lazy' && frameworks="${frameworks}lazy-fetch,"
    # Strip trailing comma
    echo "${frameworks%,}"
}

# --- Ensure DB exists with schema ---
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
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed', 'crashed'))
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
    metadata TEXT DEFAULT '{}'
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
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_events_session ON tool_events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON tool_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_tool ON tool_events(tool_name);
CREATE INDEX IF NOT EXISTS idx_events_file ON tool_events(file_path);
CREATE INDEX IF NOT EXISTS idx_events_session_tool ON tool_events(session_id, tool_name);
CREATE INDEX IF NOT EXISTS idx_summaries_date ON daily_summaries(date);
CREATE INDEX IF NOT EXISTS idx_summaries_project ON daily_summaries(project);
CREATE INDEX IF NOT EXISTS idx_file_activity_path ON file_activity(file_path);
CREATE INDEX IF NOT EXISTS idx_file_activity_project ON file_activity(project);
CREATE INDEX IF NOT EXISTS idx_file_activity_date ON file_activity(date);

INSERT OR IGNORE INTO schema_version (version) VALUES (1);
SCHEMA
    fi
    # Ensure WAL mode on existing DB
    sqlite3 "$DB_PATH" "PRAGMA journal_mode=WAL;" >/dev/null 2>&1 || true
}

# --- SQL helper: escape single quotes ---
sql_escape() {
    echo "$1" | sed "s/'/''/g"
}

# --- Timestamp ---
NOW="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
TODAY="$(date -u '+%Y-%m-%d')"

# =============================================================================
# EVENT HANDLERS
# =============================================================================

handle_session_start() {
    ensure_db

    # Create session row
    local esc_project
    esc_project="$(sql_escape "$PROJECT")"
    sqlite3 "$DB_PATH" "INSERT OR IGNORE INTO sessions (id, project, started_at, status) VALUES ('$(sql_escape "$SESSION_ID")', '$esc_project', '$NOW', 'active');" 2>/dev/null || true

    # Create session tmp dir
    mkdir -p "$SESSION_DIR" 2>/dev/null || true

    # Output context injection (query recent activity)
    local ctx=""
    local last_session
    last_session="$(sqlite3 "$DB_PATH" "SELECT s.duration_seconds, (SELECT COUNT(*) FROM tool_events WHERE session_id=s.id) as events FROM sessions s WHERE s.project='$esc_project' AND s.status='completed' ORDER BY s.ended_at DESC LIMIT 1;" 2>/dev/null)" || true

    if [ -n "$last_session" ]; then
        local dur events
        dur="$(echo "$last_session" | cut -d'|' -f1)"
        events="$(echo "$last_session" | cut -d'|' -f2)"
        if [ -n "$dur" ] && [ "$dur" != "" ]; then
            local mins=$(( dur / 60 ))
            ctx="Last session in $PROJECT: ${mins}min, ${events} tool calls."
        fi
    fi

    local today_stats
    today_stats="$(sqlite3 "$DB_PATH" "SELECT COUNT(DISTINCT s.id), COUNT(e.id) FROM sessions s LEFT JOIN tool_events e ON e.session_id=s.id WHERE date(s.started_at)='$TODAY';" 2>/dev/null)" || true

    if [ -n "$today_stats" ]; then
        local sess_count evt_count
        sess_count="$(echo "$today_stats" | cut -d'|' -f1)"
        evt_count="$(echo "$today_stats" | cut -d'|' -f2)"
        if [ "$sess_count" -gt 0 ] 2>/dev/null; then
            ctx="${ctx:+$ctx }Today: ${sess_count} sessions, ${evt_count} events."
        fi
    fi

    if [ -n "$ctx" ]; then
        printf '{"hookSpecificOutput":{"additionalContext":"%s"}}' "$(echo "$ctx" | sed 's/"/\\"/g')"
    fi
}

handle_tool_event() {
    ensure_db

    # Ensure session exists (in case session-start was missed)
    local esc_project
    esc_project="$(sql_escape "$PROJECT")"
    sqlite3 "$DB_PATH" "INSERT OR IGNORE INTO sessions (id, project, started_at, status) VALUES ('$(sql_escape "$SESSION_ID")', '$esc_project', '$NOW', 'active');" 2>/dev/null || true

    # Parse tool-specific fields
    local file_path="" language="" lines_added=0 lines_removed=0
    local command="" framework="" command_failed=0
    local search_pattern="" agent_type="" agent_desc=""
    local skill_name="" skill_args="" metadata="{}"

    local tool_input
    tool_input="$(echo "$INPUT" | jq -c '.tool_input // {}' 2>/dev/null)" || tool_input="{}"

    case "$TOOL_NAME" in
        Edit)
            file_path="$(echo "$tool_input" | jq -r '.file_path // empty' 2>/dev/null)" || true
            language="$(detect_language "$file_path")"
            local old_str new_str old_lines new_lines
            old_str="$(echo "$tool_input" | jq -r '.old_string // empty' 2>/dev/null)" || true
            new_str="$(echo "$tool_input" | jq -r '.new_string // empty' 2>/dev/null)" || true
            if [ -n "$old_str" ]; then
                old_lines="$(echo "$old_str" | wc -l | tr -d ' ')"
            else
                old_lines=0
            fi
            if [ -n "$new_str" ]; then
                new_lines="$(echo "$new_str" | wc -l | tr -d ' ')"
            else
                new_lines=0
            fi
            lines_removed=$old_lines
            lines_added=$new_lines

            # Upsert file_activity
            sqlite3 "$DB_PATH" "INSERT INTO file_activity (file_path, project, date, edit_count, lines_added, lines_removed, language)
                VALUES ('$(sql_escape "$file_path")', '$esc_project', '$TODAY', 1, $lines_added, $lines_removed, '$(sql_escape "$language")')
                ON CONFLICT(file_path, project, date) DO UPDATE SET
                    edit_count = edit_count + 1,
                    lines_added = lines_added + $lines_added,
                    lines_removed = lines_removed + $lines_removed;" 2>/dev/null || true
            ;;

        Write)
            file_path="$(echo "$tool_input" | jq -r '.file_path // empty' 2>/dev/null)" || true
            language="$(detect_language "$file_path")"
            local content
            content="$(echo "$tool_input" | jq -r '.content // empty' 2>/dev/null)" || true
            if [ -n "$content" ]; then
                lines_added="$(echo "$content" | wc -l | tr -d ' ')"
            fi

            # Upsert file_activity
            sqlite3 "$DB_PATH" "INSERT INTO file_activity (file_path, project, date, write_count, lines_added, language)
                VALUES ('$(sql_escape "$file_path")', '$esc_project', '$TODAY', 1, $lines_added, '$(sql_escape "$language")')
                ON CONFLICT(file_path, project, date) DO UPDATE SET
                    write_count = write_count + 1,
                    lines_added = lines_added + $lines_added;" 2>/dev/null || true
            ;;

        Bash)
            command="$(echo "$tool_input" | jq -r '.command // empty' 2>/dev/null)" || true
            framework="$(detect_frameworks "$command")"
            # Check if command failed from tool_output
            local exit_code
            exit_code="$(echo "$INPUT" | jq -r '.tool_output.exit_code // 0' 2>/dev/null)" || exit_code=0
            if [ "$exit_code" != "0" ] && [ "$exit_code" != "null" ] && [ -n "$exit_code" ]; then
                command_failed=1
            fi
            ;;

        Read)
            file_path="$(echo "$tool_input" | jq -r '.file_path // empty' 2>/dev/null)" || true
            language="$(detect_language "$file_path")"

            # Upsert file_activity
            if [ -n "$file_path" ]; then
                sqlite3 "$DB_PATH" "INSERT INTO file_activity (file_path, project, date, read_count, language)
                    VALUES ('$(sql_escape "$file_path")', '$esc_project', '$TODAY', 1, '$(sql_escape "$language")')
                    ON CONFLICT(file_path, project, date) DO UPDATE SET
                        read_count = read_count + 1;" 2>/dev/null || true
            fi
            ;;

        Glob|Grep)
            search_pattern="$(echo "$tool_input" | jq -r '.pattern // empty' 2>/dev/null)" || true
            ;;

        Agent)
            agent_type="$(echo "$tool_input" | jq -r '.type // .agent_type // empty' 2>/dev/null)" || true
            agent_desc="$(echo "$tool_input" | jq -r '.description // .prompt // empty' 2>/dev/null)" || true
            ;;

        Skill)
            skill_name="$(echo "$tool_input" | jq -r '.skill // .name // empty' 2>/dev/null)" || true
            skill_args="$(echo "$tool_input" | jq -r '.args // empty' 2>/dev/null)" || true
            ;;
    esac

    # Insert tool event
    sqlite3 "$DB_PATH" "INSERT INTO tool_events (
        session_id, tool_name, timestamp, file_path, language,
        lines_added, lines_removed, command, detected_framework,
        command_failed, search_pattern, agent_type, agent_description,
        skill_name, skill_args, metadata
    ) VALUES (
        '$(sql_escape "$SESSION_ID")',
        '$(sql_escape "$TOOL_NAME")',
        '$NOW',
        '$(sql_escape "$file_path")',
        '$(sql_escape "$language")',
        $lines_added,
        $lines_removed,
        '$(sql_escape "$command")',
        '$(sql_escape "$framework")',
        $command_failed,
        '$(sql_escape "$search_pattern")',
        '$(sql_escape "$agent_type")',
        '$(sql_escape "$agent_desc")',
        '$(sql_escape "$skill_name")',
        '$(sql_escape "$skill_args")',
        '$(sql_escape "$metadata")'
    );" 2>/dev/null || true

    # File hotspot detection for Edit/Write
    if [ "$TOOL_NAME" = "Edit" ] || [ "$TOOL_NAME" = "Write" ]; then
        if [ -n "$file_path" ]; then
            local edit_count
            edit_count="$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM tool_events WHERE session_id='$(sql_escape "$SESSION_ID")' AND file_path='$(sql_escape "$file_path")' AND tool_name IN ('Edit','Write');" 2>/dev/null)" || edit_count=0
            if [ "$edit_count" -ge 20 ] 2>/dev/null; then
                printf '{"hookSpecificOutput":{"additionalContext":"Hotspot: %s has been edited %s times this session. Consider refactoring or splitting."}}' "$(basename "$file_path")" "$edit_count"
            fi
        fi
    fi
}

handle_session_stop() {
    ensure_db

    local status="completed"
    if [ "$HOOK_TYPE" = "StopFailure" ]; then
        status="crashed"
    fi

    # Calculate duration
    local start_time duration=0
    start_time="$(sqlite3 "$DB_PATH" "SELECT started_at FROM sessions WHERE id='$(sql_escape "$SESSION_ID")';" 2>/dev/null)" || true

    if [ -n "$start_time" ]; then
        local start_epoch end_epoch
        if date -j -f "%Y-%m-%dT%H:%M:%SZ" "$start_time" "+%s" >/dev/null 2>&1; then
            # macOS
            start_epoch="$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$start_time" "+%s" 2>/dev/null)" || start_epoch=0
        else
            # GNU/Linux
            start_epoch="$(date -d "$start_time" "+%s" 2>/dev/null)" || start_epoch=0
        fi
        end_epoch="$(date -u "+%s")"
        if [ "$start_epoch" -gt 0 ] 2>/dev/null; then
            duration=$(( end_epoch - start_epoch ))
        fi
    fi

    # Update session row
    sqlite3 "$DB_PATH" "UPDATE sessions SET
        ended_at='$NOW',
        duration_seconds=$duration,
        status='$status'
        WHERE id='$(sql_escape "$SESSION_ID")';" 2>/dev/null || true

    # Compute and upsert daily_summary for this session's date
    local session_date
    session_date="$(sqlite3 "$DB_PATH" "SELECT date(started_at) FROM sessions WHERE id='$(sql_escape "$SESSION_ID")';" 2>/dev/null)" || session_date="$TODAY"
    local esc_project
    esc_project="$(sql_escape "$PROJECT")"
    local esc_sid
    esc_sid="$(sql_escape "$SESSION_ID")"

    sqlite3 "$DB_PATH" "
    INSERT INTO daily_summaries (date, project, session_count, total_duration_seconds,
        lines_added, lines_removed, net_lines, files_created, files_edited, files_read,
        tool_calls, bash_commands, bash_failures, searches, agents_spawned,
        skills_used, frameworks_detected, languages, tool_counts)
    SELECT
        '$session_date',
        '$esc_project',
        (SELECT COUNT(*) FROM sessions WHERE project='$esc_project' AND date(started_at)='$session_date' AND status IN ('completed','crashed')),
        (SELECT COALESCE(SUM(duration_seconds),0) FROM sessions WHERE project='$esc_project' AND date(started_at)='$session_date'),
        COALESCE(SUM(lines_added),0),
        COALESCE(SUM(lines_removed),0),
        COALESCE(SUM(lines_added),0) - COALESCE(SUM(lines_removed),0),
        (SELECT COUNT(DISTINCT file_path) FROM tool_events WHERE session_id='$esc_sid' AND tool_name='Write'),
        (SELECT COUNT(DISTINCT file_path) FROM tool_events WHERE session_id='$esc_sid' AND tool_name='Edit'),
        (SELECT COUNT(DISTINCT file_path) FROM tool_events WHERE session_id='$esc_sid' AND tool_name='Read'),
        COUNT(*),
        (SELECT COUNT(*) FROM tool_events WHERE session_id='$esc_sid' AND tool_name='Bash'),
        (SELECT COUNT(*) FROM tool_events WHERE session_id='$esc_sid' AND tool_name='Bash' AND command_failed=1),
        (SELECT COUNT(*) FROM tool_events WHERE session_id='$esc_sid' AND tool_name IN ('Glob','Grep')),
        (SELECT COUNT(*) FROM tool_events WHERE session_id='$esc_sid' AND tool_name='Agent'),
        '{}',
        '{}',
        '{}',
        '{}'
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
        agents_spawned = daily_summaries.agents_spawned + excluded.agents_spawned;
    " 2>/dev/null || true

    # Clean up tmp dir
    rm -rf "$SESSION_DIR" 2>/dev/null || true
}

# =============================================================================
# EVENT ROUTING
# =============================================================================

case "$HOOK_TYPE" in
    SessionStart)
        handle_session_start
        ;;
    PostToolUse)
        handle_tool_event
        ;;
    Stop|StopFailure)
        handle_session_stop
        ;;
    TaskCreated|CwdChanged|PreCompact)
        # Acknowledge but no special handling yet
        ensure_db
        ;;
    *)
        # Unknown hook type, silently ignore
        ;;
esac

exit 0
