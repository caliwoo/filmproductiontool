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
  subject TEXT DEFAULT '',
  lens TEXT DEFAULT '',
  spatial_composition TEXT DEFAULT '',
  setup_notes TEXT DEFAULT '',
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

const shotColumns = db.prepare('PRAGMA table_info(shots)').all().map((c) => c.name);
['subject', 'lens', 'spatial_composition', 'setup_notes'].forEach((col) => {
  if (!shotColumns.includes(col)) {
    db.exec(`ALTER TABLE shots ADD COLUMN ${col} TEXT DEFAULT ''`);
  }
});

// Replaced by marker_line/marker_offset below (a single cut-point per shot
// reads better against running screenplay text than a highlighted line
// range did -- see the marker_line/marker_offset comment).
const shotCoverageColumns = db.prepare('PRAGMA table_info(shots)').all().map((c) => c.name);
['covers_start', 'covers_end'].forEach((col) => {
  if (shotCoverageColumns.includes(col)) {
    db.exec(`ALTER TABLE shots DROP COLUMN ${col}`);
  }
});

const shotMarkerColumns = db.prepare('PRAGMA table_info(shots)').all().map((c) => c.name);
['marker_line', 'marker_offset'].forEach((col) => {
  if (!shotMarkerColumns.includes(col)) {
    // Where this shot's coverage begins in the scene's screenplay text, set
    // when a shot comes from AI Suggest Shots against a scene with a
    // formatted script: marker_line is a 0-based index into the scene's
    // script_elements array, marker_offset a character offset into that
    // line's own text -- together a single cut point, rendered as an inline
    // marker in the running text (mid-line, not just at a line's start).
    // NULL for manually-added shots, or any shot whose scene has no
    // script_elements to index into.
    db.exec(`ALTER TABLE shots ADD COLUMN ${col} INTEGER`);
  }
});

const sceneColumns = db.prepare('PRAGMA table_info(scenes)').all().map((c) => c.name);
if (!sceneColumns.includes('script_elements')) {
  // JSON array of {type, text} screenplay elements (action/character/parenthetical/
  // dialogue/transition) classified from a PDF import's text positions, used to
  // render the scene body as formatted script instead of a flattened paragraph.
  // NULL for scenes that weren't imported from a PDF, or whose text was hand-edited.
  db.exec('ALTER TABLE scenes ADD COLUMN script_elements TEXT');
}

migrateCastNameToRole(db);
backfillCastContacts(db);

module.exports = db;
