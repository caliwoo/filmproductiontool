// One-time startup backfill: re-applies the "orphaned character cue" fix in
// scriptParser.js's classifyBodyLines to scenes that were already imported
// before that fix existed, so a scene's stored script_elements don't need a
// full re-import to pick it up.
function fixOrphanedCharacterCues(db) {
  const rows = db.prepare("SELECT id, script_elements FROM scenes WHERE script_elements IS NOT NULL").all();
  const update = db.prepare('UPDATE scenes SET script_elements = ? WHERE id = ?');

  rows.forEach((row) => {
    let elements;
    try {
      elements = JSON.parse(row.script_elements);
    } catch {
      return;
    }
    if (!Array.isArray(elements)) return;

    let changed = false;
    elements.forEach((el, i) => {
      if (el.type !== 'character') return;
      const next = elements[i + 1];
      if (!next || (next.type !== 'dialogue' && next.type !== 'parenthetical')) {
        el.type = 'action';
        changed = true;
      }
    });

    if (changed) update.run(JSON.stringify(elements), row.id);
  });
}

module.exports = { fixOrphanedCharacterCues };
