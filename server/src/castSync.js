// Keeps the Cast & Crew directory in sync with the script breakdown: tagging
// someone as cast on a scene should make them show up there. The tagged
// value is a character/role name (e.g. "JANE"), not necessarily a real
// actor's name, so it's stored in `role`; `name` is left blank for the
// actor's real name to be filled in once the part is cast.

function ensureCastContact(db, projectId, rawRole) {
  const role = String(rawRole).trim();
  if (!role) return;
  const existing = db
    .prepare("SELECT id FROM contacts WHERE project_id = ? AND department = 'cast' AND LOWER(role) = LOWER(?)")
    .get(projectId, role);
  if (!existing) {
    db.prepare("INSERT INTO contacts (project_id, name, role, department) VALUES (?, '', ?, 'cast')").run(
      projectId,
      role
    );
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

// One-time correction for contacts created by an earlier version of this
// sync, which put the character name in `name` and left `role` blank.
// Only touches rows matching that exact shape, so it never disturbs a
// contact someone has since filled in themselves.
function migrateCastNameToRole(db) {
  db.prepare(
    `UPDATE contacts SET role = name, name = ''
     WHERE department = 'cast' AND (role IS NULL OR role = '') AND name != ''`
  ).run();
}

module.exports = { ensureCastContact, backfillCastContacts, migrateCastNameToRole };
