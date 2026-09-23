const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { backfillCastContacts, migrateCastNameToRole } = require('./castSync');
const {
  backfillSceneLocations,
  migrateHeadingNamesToSceneHeading,
  deleteOrphanedPlaceholders,
} = require('./locationSync');
const { fixOrphanedCharacterCues } = require('./scriptElementsSync');

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

const locationColumns = db.prepare('PRAGMA table_info(locations)').all().map((c) => c.name);
if (!locationColumns.includes('scene_heading')) {
  // The location text as written in a scene's heading (e.g. "APARTMENT" from
  // "APARTMENT - BEDROOM"), auto-filled on script import. Kept separate from
  // `name` so a scripted set description is never mistaken for -- or
  // overwrites -- the location's actual real-world name/address, which the
  // user fills into `name` themselves.
  db.exec("ALTER TABLE locations ADD COLUMN scene_heading TEXT DEFAULT ''");
}

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

const sceneElementColumns = db.prepare('PRAGMA table_info(scene_elements)').all().map((c) => c.name);
if (!sceneElementColumns.includes('quote')) {
  // A short verbatim excerpt (copied exactly) from the scene's own text that
  // this element refers to, set by AI Select so the element can be
  // highlighted at its real position in the screenplay preview -- value
  // alone is often a paraphrased breakdown-sheet label (e.g. "Colorful
  // Butterfly") that never appears as that exact phrase in the text, so
  // matching against value alone missed most non-cast elements. NULL for
  // manually-tagged elements, which fall back to matching on value itself.
  db.exec('ALTER TABLE scene_elements ADD COLUMN quote TEXT');
}

const sceneColumns = db.prepare('PRAGMA table_info(scenes)').all().map((c) => c.name);
if (!sceneColumns.includes('script_elements')) {
  // JSON array of {type, text} screenplay elements (action/character/parenthetical/
  // dialogue/transition) classified from a PDF import's text positions, used to
  // render the scene body as formatted script instead of a flattened paragraph.
  // NULL for scenes that weren't imported from a PDF, or whose text was hand-edited.
  db.exec('ALTER TABLE scenes ADD COLUMN script_elements TEXT');
}

const projectColumns = db.prepare('PRAGMA table_info(projects)').all().map((c) => c.name);
if (!projectColumns.includes('updated_at')) {
  // Real last-edited time for the project, kept current by the touch
  // triggers below whenever the project or anything inside it changes --
  // not just renames. Seeded from created_at so existing projects show a
  // sensible time immediately after this migration runs, instead of every
  // one suddenly reading "just now".
  db.exec('ALTER TABLE projects ADD COLUMN updated_at TEXT');
  db.exec('UPDATE projects SET updated_at = created_at WHERE updated_at IS NULL');
}

// Keeps projects.updated_at current as a real "last edited" time whenever
// the project itself or anything that belongs to it changes -- scenes,
// tagged elements, shots, cast/crew, locations, or the shoot schedule.
// Triggers (rather than touching every route handler) so no future
// mutation path can forget to bump it.
db.exec(`
CREATE TRIGGER IF NOT EXISTS trg_touch_project_scenes_ins AFTER INSERT ON scenes BEGIN
  UPDATE projects SET updated_at = datetime('now') WHERE id = NEW.project_id;
END;
CREATE TRIGGER IF NOT EXISTS trg_touch_project_scenes_upd AFTER UPDATE ON scenes BEGIN
  UPDATE projects SET updated_at = datetime('now') WHERE id = NEW.project_id;
END;
CREATE TRIGGER IF NOT EXISTS trg_touch_project_scenes_del AFTER DELETE ON scenes BEGIN
  UPDATE projects SET updated_at = datetime('now') WHERE id = OLD.project_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_touch_project_contacts_ins AFTER INSERT ON contacts BEGIN
  UPDATE projects SET updated_at = datetime('now') WHERE id = NEW.project_id;
END;
CREATE TRIGGER IF NOT EXISTS trg_touch_project_contacts_upd AFTER UPDATE ON contacts BEGIN
  UPDATE projects SET updated_at = datetime('now') WHERE id = NEW.project_id;
END;
CREATE TRIGGER IF NOT EXISTS trg_touch_project_contacts_del AFTER DELETE ON contacts BEGIN
  UPDATE projects SET updated_at = datetime('now') WHERE id = OLD.project_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_touch_project_locations_ins AFTER INSERT ON locations BEGIN
  UPDATE projects SET updated_at = datetime('now') WHERE id = NEW.project_id;
END;
CREATE TRIGGER IF NOT EXISTS trg_touch_project_locations_upd AFTER UPDATE ON locations BEGIN
  UPDATE projects SET updated_at = datetime('now') WHERE id = NEW.project_id;
END;
CREATE TRIGGER IF NOT EXISTS trg_touch_project_locations_del AFTER DELETE ON locations BEGIN
  UPDATE projects SET updated_at = datetime('now') WHERE id = OLD.project_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_touch_project_shoot_days_ins AFTER INSERT ON shoot_days BEGIN
  UPDATE projects SET updated_at = datetime('now') WHERE id = NEW.project_id;
END;
CREATE TRIGGER IF NOT EXISTS trg_touch_project_shoot_days_upd AFTER UPDATE ON shoot_days BEGIN
  UPDATE projects SET updated_at = datetime('now') WHERE id = NEW.project_id;
END;
CREATE TRIGGER IF NOT EXISTS trg_touch_project_shoot_days_del AFTER DELETE ON shoot_days BEGIN
  UPDATE projects SET updated_at = datetime('now') WHERE id = OLD.project_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_touch_project_scene_elements_ins AFTER INSERT ON scene_elements BEGIN
  UPDATE projects SET updated_at = datetime('now')
  WHERE id = (SELECT project_id FROM scenes WHERE id = NEW.scene_id);
END;
CREATE TRIGGER IF NOT EXISTS trg_touch_project_scene_elements_upd AFTER UPDATE ON scene_elements BEGIN
  UPDATE projects SET updated_at = datetime('now')
  WHERE id = (SELECT project_id FROM scenes WHERE id = NEW.scene_id);
END;
CREATE TRIGGER IF NOT EXISTS trg_touch_project_scene_elements_del AFTER DELETE ON scene_elements BEGIN
  UPDATE projects SET updated_at = datetime('now')
  WHERE id = (SELECT project_id FROM scenes WHERE id = OLD.scene_id);
END;

CREATE TRIGGER IF NOT EXISTS trg_touch_project_shots_ins AFTER INSERT ON shots BEGIN
  UPDATE projects SET updated_at = datetime('now')
  WHERE id = (SELECT project_id FROM scenes WHERE id = NEW.scene_id);
END;
CREATE TRIGGER IF NOT EXISTS trg_touch_project_shots_upd AFTER UPDATE ON shots BEGIN
  UPDATE projects SET updated_at = datetime('now')
  WHERE id = (SELECT project_id FROM scenes WHERE id = NEW.scene_id);
END;
CREATE TRIGGER IF NOT EXISTS trg_touch_project_shots_del AFTER DELETE ON shots BEGIN
  UPDATE projects SET updated_at = datetime('now')
  WHERE id = (SELECT project_id FROM scenes WHERE id = OLD.scene_id);
END;

CREATE TRIGGER IF NOT EXISTS trg_touch_project_shoot_day_scenes_ins AFTER INSERT ON shoot_day_scenes BEGIN
  UPDATE projects SET updated_at = datetime('now')
  WHERE id = (SELECT project_id FROM shoot_days WHERE id = NEW.shoot_day_id);
END;
CREATE TRIGGER IF NOT EXISTS trg_touch_project_shoot_day_scenes_upd AFTER UPDATE ON shoot_day_scenes BEGIN
  UPDATE projects SET updated_at = datetime('now')
  WHERE id = (SELECT project_id FROM shoot_days WHERE id = NEW.shoot_day_id);
END;
CREATE TRIGGER IF NOT EXISTS trg_touch_project_shoot_day_scenes_del AFTER DELETE ON shoot_day_scenes BEGIN
  UPDATE projects SET updated_at = datetime('now')
  WHERE id = (SELECT project_id FROM shoot_days WHERE id = OLD.shoot_day_id);
END;

CREATE TRIGGER IF NOT EXISTS trg_touch_project_shoot_day_calls_ins AFTER INSERT ON shoot_day_calls BEGIN
  UPDATE projects SET updated_at = datetime('now')
  WHERE id = (SELECT project_id FROM shoot_days WHERE id = NEW.shoot_day_id);
END;
CREATE TRIGGER IF NOT EXISTS trg_touch_project_shoot_day_calls_upd AFTER UPDATE ON shoot_day_calls BEGIN
  UPDATE projects SET updated_at = datetime('now')
  WHERE id = (SELECT project_id FROM shoot_days WHERE id = NEW.shoot_day_id);
END;
CREATE TRIGGER IF NOT EXISTS trg_touch_project_shoot_day_calls_del AFTER DELETE ON shoot_day_calls BEGIN
  UPDATE projects SET updated_at = datetime('now')
  WHERE id = (SELECT project_id FROM shoot_days WHERE id = OLD.shoot_day_id);
END;
`);

migrateCastNameToRole(db);
backfillCastContacts(db);
migrateHeadingNamesToSceneHeading(db);
backfillSceneLocations(db);
deleteOrphanedPlaceholders(db);
fixOrphanedCharacterCues(db);

module.exports = db;
