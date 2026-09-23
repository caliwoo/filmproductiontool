const express = require('express');
const db = require('../db');
const { suggestSceneElements } = require('../aiTagger');
const { suggestShots } = require('../aiShotLister');
const { renderBreakdownPdf } = require('../breakdownPdf');
const { ensureCastContact } = require('../castSync');

const router = express.Router();

function withElements(scene) {
  if (!scene) return scene;
  const elements = db.prepare('SELECT * FROM scene_elements WHERE scene_id = ? ORDER BY category, id').all(scene.id);
  let script_elements = null;
  if (scene.script_elements) {
    try {
      script_elements = JSON.parse(scene.script_elements);
    } catch {
      script_elements = null;
    }
  }
  return { ...scene, script_elements, elements };
}

router.get('/', (req, res) => {
  const { projectId } = req.query;
  const rows = projectId
    ? db.prepare('SELECT * FROM scenes WHERE project_id = ? ORDER BY order_index, id').all(projectId)
    : db.prepare('SELECT * FROM scenes ORDER BY order_index, id').all();
  res.json(rows.map(withElements));
});

router.get('/:id', (req, res) => {
  const scene = db.prepare('SELECT * FROM scenes WHERE id = ?').get(req.params.id);
  if (!scene) return res.status(404).json({ error: 'Scene not found' });
  res.json(withElements(scene));
});

router.post('/', (req, res) => {
  const {
    project_id,
    scene_number,
    heading = '',
    int_ext = 'INT',
    day_night = 'DAY',
    location_id = null,
    synopsis = '',
    page_count = 1,
  } = req.body;
  if (!project_id) return res.status(400).json({ error: 'project_id is required' });
  if (!scene_number || !String(scene_number).trim()) return res.status(400).json({ error: 'scene_number is required' });

  const maxOrder = db
    .prepare('SELECT COALESCE(MAX(order_index), -1) AS m FROM scenes WHERE project_id = ?')
    .get(project_id).m;

  const result = db
    .prepare(
      `INSERT INTO scenes (project_id, scene_number, heading, int_ext, day_night, location_id, synopsis, page_count, order_index)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(project_id, scene_number, heading, int_ext, day_night, location_id, synopsis, page_count, maxOrder + 1);

  res.status(201).json(withElements(db.prepare('SELECT * FROM scenes WHERE id = ?').get(result.lastInsertRowid)));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM scenes WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Scene not found' });
  const {
    scene_number,
    heading,
    int_ext,
    day_night,
    location_id,
    synopsis,
    page_count,
    status,
    order_index,
  } = req.body;
  // A direct synopsis edit invalidates whatever per-line formatting a PDF
  // import classified for this scene -- there's no way to know which line a
  // hand-typed edit belongs to, so it falls back to plain text until the
  // scene is re-imported.
  const script_elements = synopsis === undefined ? existing.script_elements : null;
  db.prepare(
    `UPDATE scenes SET scene_number = ?, heading = ?, int_ext = ?, day_night = ?, location_id = ?,
       synopsis = ?, script_elements = ?, page_count = ?, status = ?, order_index = ? WHERE id = ?`
  ).run(
    scene_number ?? existing.scene_number,
    heading ?? existing.heading,
    int_ext ?? existing.int_ext,
    day_night ?? existing.day_night,
    location_id === undefined ? existing.location_id : location_id,
    synopsis ?? existing.synopsis,
    script_elements,
    page_count ?? existing.page_count,
    status ?? existing.status,
    order_index === undefined ? existing.order_index : order_index,
    req.params.id
  );
  res.json(withElements(db.prepare('SELECT * FROM scenes WHERE id = ?').get(req.params.id)));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM scenes WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

router.post('/reorder', (req, res) => {
  const { order } = req.body; // array of scene ids in new order
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array of scene ids' });
  const update = db.prepare('UPDATE scenes SET order_index = ? WHERE id = ?');
  const tx = db.transaction((ids) => {
    ids.forEach((id, index) => update.run(index, id));
  });
  tx(order);
  res.status(204).end();
});

// --- Scene elements (cast, props, wardrobe, etc.) ---

router.get('/:sceneId/elements', (req, res) => {
  res.json(db.prepare('SELECT * FROM scene_elements WHERE scene_id = ? ORDER BY category, id').all(req.params.sceneId));
});

router.post('/:sceneId/elements', (req, res) => {
  const { category, value, quote = null } = req.body;
  if (!category || !value || !value.trim()) {
    return res.status(400).json({ error: 'category and value are required' });
  }
  const result = db
    .prepare('INSERT INTO scene_elements (scene_id, category, value, quote) VALUES (?, ?, ?, ?)')
    .run(req.params.sceneId, category, value.trim(), quote);

  if (category === 'cast') {
    const scene = db.prepare('SELECT project_id FROM scenes WHERE id = ?').get(req.params.sceneId);
    if (scene) ensureCastContact(db, scene.project_id, value);
  }

  res.status(201).json(db.prepare('SELECT * FROM scene_elements WHERE id = ?').get(result.lastInsertRowid));
});

router.delete('/elements/:elementId', (req, res) => {
  db.prepare('DELETE FROM scene_elements WHERE id = ?').run(req.params.elementId);
  res.status(204).end();
});

router.post('/:sceneId/elements/bulk', (req, res) => {
  const { elements } = req.body;
  if (!Array.isArray(elements) || elements.length === 0) {
    return res.status(400).json({ error: 'elements must be a non-empty array' });
  }
  const scene = db.prepare('SELECT project_id FROM scenes WHERE id = ?').get(req.params.sceneId);
  if (!scene) return res.status(404).json({ error: 'Scene not found' });

  const insert = db.prepare('INSERT INTO scene_elements (scene_id, category, value, quote) VALUES (?, ?, ?, ?)');
  const insertedIds = [];
  const tx = db.transaction((rows) => {
    rows.forEach((e) => {
      if (!e || !e.category || !e.value || !String(e.value).trim()) return;
      const result = insert.run(req.params.sceneId, e.category, String(e.value).trim(), e.quote || null);
      insertedIds.push(result.lastInsertRowid);
      if (e.category === 'cast') ensureCastContact(db, scene.project_id, e.value);
    });
  });
  tx(elements);
  const created = insertedIds.map((id) => db.prepare('SELECT * FROM scene_elements WHERE id = ?').get(id));
  res.status(201).json(created);
});

// --- AI Select: suggest breakdown elements from the scene text via Claude ---

router.post('/:sceneId/ai-tag', async (req, res) => {
  const scene = withElements(db.prepare('SELECT * FROM scenes WHERE id = ?').get(req.params.sceneId));
  if (!scene) return res.status(404).json({ error: 'Scene not found' });

  const existing = db
    .prepare('SELECT category, value FROM scene_elements WHERE scene_id = ?')
    .all(scene.id);

  try {
    const candidates = await suggestSceneElements(scene, existing);
    res.json({ candidates });
  } catch (err) {
    res.status(err.notConfigured ? 501 : err.refused ? 422 : 502).json({ error: err.message });
  }
});

// --- AI Suggest: propose a shot list for the scene via Claude ---

router.post('/:sceneId/ai-shots', async (req, res) => {
  const scene = withElements(db.prepare('SELECT * FROM scenes WHERE id = ?').get(req.params.sceneId));
  if (!scene) return res.status(404).json({ error: 'Scene not found' });

  const existing = db
    .prepare('SELECT shot_number, size, angle, description FROM shots WHERE scene_id = ? ORDER BY order_index, id')
    .all(scene.id);

  try {
    const candidates = await suggestShots(scene, existing);
    res.json({ candidates, nextShotNumber: existing.length + 1 });
  } catch (err) {
    res.status(err.notConfigured ? 501 : err.refused ? 422 : 502).json({ error: err.message });
  }
});

// --- Printable/downloadable breakdown sheet PDF ---

router.get('/:sceneId/breakdown-pdf', (req, res) => {
  const scene = db.prepare('SELECT * FROM scenes WHERE id = ?').get(req.params.sceneId);
  if (!scene) return res.status(404).json({ error: 'Scene not found' });

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(scene.project_id);
  const location = scene.location_id ? db.prepare('SELECT * FROM locations WHERE id = ?').get(scene.location_id) : null;
  const elements = db.prepare('SELECT * FROM scene_elements WHERE scene_id = ? ORDER BY category, id').all(scene.id);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Scene-${scene.scene_number}-Breakdown.pdf"`);

  const doc = renderBreakdownPdf({ project, scene, location, elements });
  doc.pipe(res);
  doc.end();
});

module.exports = router;
