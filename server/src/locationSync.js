// Auto-populates the Locations directory from scene headings, the same way
// castSync.js keeps Cast & Crew in sync with tagged breakdown elements. A
// scripted heading like "APARTMENT - BEDROOM" describes the *set*, not a
// real-world place -- so it's kept in its own `scene_heading` field, never
// written into `name`, which is left for the user to fill in with the
// location's actual real name/address.

// A heading is usually "BUILDING - ROOM" (sub-locations within the same
// building) or "BUILDING - ROOM - DAY/NIGHT" when the day/night token wasn't
// recognized by the script parser (as with a non-English script) and got left
// in the heading text. Taking only the text before the first " - " groups
// same-building sub-locations under one location, and also happens to drop
// that trailing day/night noise, without needing the parser to recognize it.
function deriveLocationName(heading) {
  const trimmed = String(heading || '').trim();
  if (!trimmed) return '';
  const dashIdx = trimmed.indexOf(' - ');
  return (dashIdx === -1 ? trimmed : trimmed.slice(0, dashIdx)).trim();
}

// A label to display for a location that has no real name yet -- falls back
// to the scripted heading text so a scene's location dropdown, the call
// sheet, etc. never show a blank until the user names it for real.
function locationLabel(location) {
  if (!location) return null;
  return location.name || location.scene_heading || null;
}

// Finds a project's existing auto-created location for this heading (matched
// by `scene_heading`, not `name` -- the user is free to rename `name` to the
// real location without breaking future imports that reuse the same set) or
// creates one, with `name` left blank for the user to fill in themselves.
function ensureLocation(db, projectId, rawHeading) {
  const label = deriveLocationName(rawHeading);
  if (!label) return null;
  const existing = db
    .prepare("SELECT id FROM locations WHERE project_id = ? AND LOWER(scene_heading) = LOWER(?)")
    .get(projectId, label);
  if (existing) return existing.id;
  const result = db
    .prepare("INSERT INTO locations (project_id, name, address, notes, scene_heading) VALUES (?, '', '', '', ?)")
    .run(projectId, label);
  return result.lastInsertRowid;
}

// Reconciles any scene that has a heading but no location -- covers scenes
// imported before this sync existed. Safe to run every time the server
// starts: it only ever fills in a missing scene.location_id (creating a
// location to point it at if needed), never touches a scene or location
// that's already set.
function backfillSceneLocations(db) {
  const rows = db
    .prepare("SELECT id, project_id, heading FROM scenes WHERE location_id IS NULL AND heading != ''")
    .all();
  rows.forEach((row) => {
    const locationId = ensureLocation(db, row.project_id, row.heading);
    if (locationId) {
      db.prepare('UPDATE scenes SET location_id = ? WHERE id = ?').run(locationId, row.id);
    }
  });
}

// One-time correction for locations created by an earlier version of this
// sync, which put the derived heading label straight into `name` instead of
// the separate `scene_heading` field -- conflating "what the script called
// this set" with "this location's real name/address", the very distinction
// this module now exists to keep apart. Only touches a location whose `name`
// still exactly matches what one of its own linked scenes' headings derives
// to, so a location the user has already renamed to something real is left
// untouched. Safe to run every time the server starts: once `scene_heading`
// is set, a location no longer matches the `WHERE` clause below.
function migrateHeadingNamesToSceneHeading(db) {
  const rows = db
    .prepare("SELECT id, name FROM locations WHERE scene_heading = '' OR scene_heading IS NULL")
    .all();
  rows.forEach((loc) => {
    const scene = db.prepare('SELECT heading FROM scenes WHERE location_id = ? LIMIT 1').get(loc.id);
    if (!scene) return;
    const label = deriveLocationName(scene.heading);
    if (label && label.toLowerCase() === String(loc.name || '').trim().toLowerCase()) {
      db.prepare("UPDATE locations SET scene_heading = ?, name = '' WHERE id = ?").run(label, loc.id);
    }
  });
}

module.exports = {
  deriveLocationName,
  locationLabel,
  ensureLocation,
  backfillSceneLocations,
  migrateHeadingNamesToSceneHeading,
};
