import Database from "better-sqlite3";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dbPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "data.db");
export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS ingredients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS fridge_items (
  ingredient_id INTEGER PRIMARY KEY REFERENCES ingredients(id) ON DELETE CASCADE,
  added_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS recipe_collections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS recipes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  collection_id INTEGER REFERENCES recipe_collections(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  url TEXT,
  minutes INTEGER,
  diet_tags TEXT NOT NULL DEFAULT '[]',
  ingredients TEXT NOT NULL DEFAULT '[]',
  steps TEXT NOT NULL DEFAULT '[]',
  style TEXT
);

CREATE TABLE IF NOT EXISTS inspiration_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  collection_id INTEGER REFERENCES recipe_collections(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS cooked_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_title TEXT NOT NULL,
  rating INTEGER NOT NULL,
  cooked_at TEXT NOT NULL DEFAULT (datetime('now')),
  notes TEXT
);

INSERT OR IGNORE INTO recipe_collections (name) VALUES ('Mes recettes');
`);
