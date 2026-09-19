// Keeps the Cast & Crew directory in sync with the script breakdown: tagging
// someone as cast on a scene should make them show up there, without
// overwriting a contact who's already been filled in.

function ensureCastContact(db, projectId, rawName) {
  const name = String(rawName).trim();
  if (!name) return;
  const existing = db
    .prepare("SELECT id FROM contacts WHERE project_id = ? AND department = 'cast' AND LOWER(name) = LOWER(?)")
    .get(projectId, name);
  if (!existing) {
    db.prepare("INSERT INTO contacts (project_id, name, department) VALUES (?, ?, 'cast')").run(projectId, name);
  }
}

// Reconciles any cast-category scene elements that don't yet have a matching
// contact -- covers data tagged before this sync existed, or added any other
// way. Safe to run every time the server starts: it only ever adds a missing
// contact, never touches an existing one.
function backfillCastContacts(db) {
  const rows = db
    .prepare(
      `SELECT DISTINCT s.project_id AS project_id, se.value AS value
       FROM scene_elements se
       JOIN scenes s ON s.id = se.scene_id
       WHERE se.category = 'cast'`
    )
    .all();
  rows.forEach((row) => ensureCastContact(db, row.project_id, row.value));
}

module.exports = { ensureCastContact, backfillCastContacts };
