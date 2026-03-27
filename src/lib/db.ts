import Database from "better-sqlite3";
import os from "os";
import path from "path";
import fs from "fs";
import { initDatabase } from "./schema";

const DB_DIR = path.join(os.homedir(), ".claude-pulse");
const DB_PATH = path.join(DB_DIR, "tracker.db");

let dbInstance: Database.Database | null = null;

/**
 * Get a singleton database connection.
 * Creates the directory and initializes the schema on first access.
 * Enables WAL mode and foreign keys.
 */
export function getDb(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  // Ensure directory exists
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true, mode: 0o700 });
  }

  const db = new Database(DB_PATH);

  // Enable WAL mode for concurrent read/write
  db.pragma("journal_mode = WAL");

  // Enable foreign key constraints
  db.pragma("foreign_keys = ON");

  // Performance tuning
  db.pragma("synchronous = NORMAL");
  db.pragma("cache_size = -8000"); // 8MB cache
  db.pragma("busy_timeout = 5000"); // 5 second busy timeout

  // Initialize schema
  initDatabase(db);

  dbInstance = db;
  return db;
}

/**
 * Close the database connection. Used for cleanup.
 */
export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Get the database file path (useful for CLI/diagnostics).
 */
export function getDbPath(): string {
  return DB_PATH;
}

export { DB_DIR, DB_PATH };
