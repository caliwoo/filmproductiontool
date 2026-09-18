const express = require('express');
const db = require('../db');

const router = express.Router();

function withElements(scene) {
  if (!scene) return scene;
  const elements = db.prepare('SELECT * FROM scene_elements WHERE scene_id = ? ORDER BY category, id').all(scene.id);
  return { ...scene, elements };
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
  db.prepare(
    `UPDATE scenes SET scene_number = ?, heading = ?, int_ext = ?, day_night = ?, location_id = ?,
       synopsis = ?, page_count = ?, status = ?, order_index = ? WHERE id = ?`
  ).run(
    scene_number ?? existing.scene_number,
    heading ?? existing.heading,
    int_ext ?? existing.int_ext,
    day_night ?? existing.day_night,
    location_id === undefined ? existing.location_id : location_id,
    synopsis ?? existing.synopsis,
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
  const { category, value } = req.body;
  if (!category || !value || !value.trim()) {
    return res.status(400).json({ error: 'category and value are required' });
  }
  const result = db
    .prepare('INSERT INTO scene_elements (scene_id, category, value) VALUES (?, ?, ?)')
    .run(req.params.sceneId, category, value.trim());
  res.status(201).json(db.prepare('SELECT * FROM scene_elements WHERE id = ?').get(result.lastInsertRowid));
});

router.delete('/elements/:elementId', (req, res) => {
  db.prepare('DELETE FROM scene_elements WHERE id = ?').run(req.params.elementId);
  res.status(204).end();
});

module.exports = router;
