import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import migrations from "./migrations/index.js";

const dbPath = process.env.DATABASE_PATH || "./data/mealprep.db";
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

export function dbRun(sql: string, params: unknown[] = []): Database.RunResult {
  return db.prepare(sql).run(...params);
}

export function dbAll<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): T[] {
  return db.prepare(sql).all(...params) as T[];
}

export function dbGet<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined;
}

export function nextId(prefix: string, table: string): string {
  const row = db
    .prepare(
      `SELECT MAX(CAST(SUBSTR(id, ?) AS INTEGER)) AS max_num FROM "${table}" WHERE id LIKE ?`,
    )
    .get(prefix.length + 2, `${prefix}_%`) as { max_num: number | null };
  return `${prefix}_${(row.max_num ?? 0) + 1}`;
}

export function runMigrations(): void {
  // Create migrations tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Get already-applied migrations
  const applied = db
    .prepare("SELECT id FROM _migrations")
    .all() as { id: number }[];
  const appliedIds = new Set(applied.map((r) => r.id));

  // Migrations are imported at the top of the file

  // Run pending migrations
  for (const migration of migrations) {
    if (appliedIds.has(migration.id)) {
      continue;
    }

    const txn = db.transaction(() => {
      db.exec(migration.sql);
      db
        .prepare("INSERT INTO _migrations (id, name) VALUES (?, ?)")
        .run(migration.id, migration.name);
    });

    txn();
    console.log(`Applied migration ${migration.id}: ${migration.name}`);
  }
}

export { db };
