// Auto-populates the Locations directory from scene headings, the same way
// castSync.js keeps Cast & Crew in sync with tagged breakdown elements: a
// location named in the script shouldn't have to be typed in twice, once by
// the parser and again by hand on the Locations page.

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

// Finds a project's existing location for this heading (case-insensitive) or
// creates one, address/notes left blank for the user to fill in. Returns null
// if the heading has no usable location text.
function ensureLocation(db, projectId, rawHeading) {
  const name = deriveLocationName(rawHeading);
  if (!name) return null;
  const existing = db
    .prepare('SELECT id FROM locations WHERE project_id = ? AND LOWER(name) = LOWER(?)')
    .get(projectId, name);
  if (existing) return existing.id;
  const result = db
    .prepare("INSERT INTO locations (project_id, name, address, notes) VALUES (?, ?, '', '')")
    .run(projectId, name);
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

module.exports = { deriveLocationName, ensureLocation, backfillSceneLocations };
