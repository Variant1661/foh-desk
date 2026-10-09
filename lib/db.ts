import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

type Value = string | number | null;
type BoundStatement = {
  run(): { meta: { changes: number } };
  first<T>(): T | null;
  all<T>(): { results: T[] };
};

let connection: DatabaseSync | undefined;
let lastCleanup = 0;

function database() {
  if (!connection) {
    const path = process.env.FOH_DB_PATH || "./data/foh.sqlite";
    mkdirSync(dirname(path), { recursive: true });
    connection = new DatabaseSync(path, { timeout: 5000 });
    connection.exec(`
      PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY, body TEXT NOT NULL, created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL, receipt_token TEXT UNIQUE,
        acknowledged_at TEXT, kept_at TEXT, destroyed_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_messages_receipt_token ON messages(receipt_token);
      CREATE TABLE IF NOT EXISTS timesheet_entries (
        id TEXT PRIMARY KEY, name TEXT NOT NULL CHECK(name IN ('FOH1','FOH2','FOH3')),
        date TEXT NOT NULL, time_in TEXT NOT NULL, time_out TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_timesheet_name_date ON timesheet_entries(name,date);
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        name TEXT NOT NULL CHECK(name IN ('FOH1','FOH2','FOH3','ADMIN')),
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
      CREATE TABLE IF NOT EXISTS auth_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL CHECK(name IN ('FOH1','FOH2','FOH3','ADMIN')),
        attempted_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_auth_attempts_name_time ON auth_attempts(name,attempted_at);
    `);
  }
  if (Date.now() - lastCleanup > 60_000) {
    connection.prepare("UPDATE messages SET body = '' WHERE expires_at <= ? AND body <> ''").run(new Date().toISOString());
    connection.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(Date.now());
    connection.prepare("DELETE FROM auth_attempts WHERE attempted_at <= ?").run(Date.now() - 15 * 60_000);
    lastCleanup = Date.now();
  }
  return connection;
}

export const db = {
  prepare(sql: string) {
    return {
      bind(...values: Value[]): BoundStatement {
        const statement = database().prepare(sql);
        return {
          run() { return { meta: { changes: Number(statement.run(...values).changes) } }; },
          first<T>() { return (statement.get(...values) as T | undefined) ?? null; },
          all<T>() { return { results: statement.all(...values) as T[] }; },
        };
      },
    };
  },
  batch(statements: BoundStatement[]) {
    const sql = database();
    sql.exec("BEGIN IMMEDIATE");
    try {
      const result = statements.map((statement) => statement.run());
      sql.exec("COMMIT");
      return result;
    } catch (error) {
      sql.exec("ROLLBACK");
      throw error;
    }
  },
};
