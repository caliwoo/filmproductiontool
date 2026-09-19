const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { backfillCastContacts, migrateCastNameToRole } = require('./castSync');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.DATABASE_PATH || path.join(dataDir, 'filmprod.sqlite');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT DEFAULT '',
  notes TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT DEFAULT '',
  department TEXT NOT NULL DEFAULT 'crew',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS scenes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scene_number TEXT NOT NULL,
  heading TEXT DEFAULT '',
  int_ext TEXT DEFAULT 'INT',
  day_night TEXT DEFAULT 'DAY',
  location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  synopsis TEXT DEFAULT '',
  page_count REAL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'not_shot',
  order_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS scene_elements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scene_id INTEGER NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scene_id INTEGER NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  shot_number TEXT NOT NULL,
  size TEXT DEFAULT '',
  angle TEXT DEFAULT '',
  movement TEXT DEFAULT '',
  description TEXT DEFAULT '',
  equipment TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'not_shot',
  order_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS shoot_days (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL DEFAULT 1,
  shoot_date TEXT DEFAULT '',
  general_call_time TEXT DEFAULT '',
  location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  weather TEXT DEFAULT '',
  notes TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS shoot_day_scenes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shoot_day_id INTEGER NOT NULL REFERENCES shoot_days(id) ON DELETE CASCADE,
  scene_id INTEGER NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  scheduled_time TEXT DEFAULT '',
  estimated_minutes INTEGER DEFAULT 60
);

CREATE TABLE IF NOT EXISTS shoot_day_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shoot_day_id INTEGER NOT NULL REFERENCES shoot_days(id) ON DELETE CASCADE,
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  call_time TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  UNIQUE(shoot_day_id, contact_id)
);
`);

const contactColumns = db.prepare('PRAGMA table_info(contacts)').all().map((c) => c.name);
if (!contactColumns.includes('is_lead')) {
  db.exec('ALTER TABLE contacts ADD COLUMN is_lead INTEGER NOT NULL DEFAULT 0');
}

migrateCastNameToRole(db);
backfillCastContacts(db);

module.exports = db;
