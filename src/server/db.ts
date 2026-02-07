import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

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

export function initSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS recipes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT CHECK(type IN ('main','side','base')),
      servings INTEGER,
      yield_amount REAL,
      yield_unit TEXT,
      frozen_shelf_life_days INTEGER,
      fridge_shelf_life_days INTEGER
    );

    CREATE TABLE IF NOT EXISTS ingredients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT CHECK(type IN ('Meat','Poultry','Fish','Vegetables','Fruits','Dairy','Deli/Cheese','Pantry/Canned','Condiments','Other'))
    );

    CREATE TABLE IF NOT EXISTS steps (
      id TEXT PRIMARY KEY,
      recipe_id TEXT NOT NULL,
      description TEXT NOT NULL,
      phase TEXT CHECK(phase IN ('meal-prep','day-of-eating')),
      order_num INTEGER,
      duration_minutes INTEGER,
      FOREIGN KEY (recipe_id) REFERENCES recipes(id)
    );

    CREATE TABLE IF NOT EXISTS step_dependencies (
      step_id TEXT NOT NULL,
      depends_on_step_id TEXT NOT NULL,
      PRIMARY KEY (step_id, depends_on_step_id),
      FOREIGN KEY (step_id) REFERENCES steps(id),
      FOREIGN KEY (depends_on_step_id) REFERENCES steps(id)
    );

    CREATE TABLE IF NOT EXISTS step_ingredients (
      step_id TEXT NOT NULL,
      ingredient_id TEXT NOT NULL,
      quantity TEXT,
      unit TEXT,
      PRIMARY KEY (step_id, ingredient_id),
      FOREIGN KEY (step_id) REFERENCES steps(id),
      FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
    );

    CREATE TABLE IF NOT EXISTS resources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT CHECK(type IN ('oven','pan','pot','stove'))
    );

    CREATE TABLE IF NOT EXISTS step_resource_usage (
      step_id TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      temperature_celsius INTEGER,
      notes TEXT,
      PRIMARY KEY (step_id, resource_id),
      FOREIGN KEY (step_id) REFERENCES steps(id),
      FOREIGN KEY (resource_id) REFERENCES resources(id)
    );

    CREATE TABLE IF NOT EXISTS meal_prep_sessions (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS batches (
      id TEXT PRIMARY KEY,
      recipe_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      servings_produced INTEGER NOT NULL,
      prep_date TEXT NOT NULL,
      FOREIGN KEY (recipe_id) REFERENCES recipes(id),
      FOREIGN KEY (session_id) REFERENCES meal_prep_sessions(id)
    );

    CREATE TABLE IF NOT EXISTS consumptions (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      servings_consumed INTEGER NOT NULL,
      consumption_date TEXT NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    );

    CREATE TABLE IF NOT EXISTS weeks (
      id TEXT PRIMARY KEY,
      start_date TEXT NOT NULL,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS meal_plan_slots (
      id TEXT PRIMARY KEY,
      week_id TEXT NOT NULL,
      day_of_week TEXT CHECK(day_of_week IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')),
      meal_type TEXT CHECK(meal_type IN ('lunch','dinner')),
      FOREIGN KEY (week_id) REFERENCES weeks(id)
    );

    CREATE TABLE IF NOT EXISTS meal_plan_slot_recipes (
      slot_id TEXT NOT NULL,
      recipe_id TEXT NOT NULL,
      PRIMARY KEY (slot_id, recipe_id),
      FOREIGN KEY (slot_id) REFERENCES meal_plan_slots(id),
      FOREIGN KEY (recipe_id) REFERENCES recipes(id)
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      history TEXT NOT NULL
    );
  `);
}

export { db };
