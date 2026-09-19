const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const { sceneId } = req.query;
  const rows = sceneId
    ? db.prepare('SELECT * FROM shots WHERE scene_id = ? ORDER BY order_index, id').all(sceneId)
    : db.prepare('SELECT * FROM shots ORDER BY order_index, id').all();
  res.json(rows);
});

router.post('/', (req, res) => {
  const {
    scene_id,
    shot_number,
    size = '',
    angle = '',
    movement = '',
    description = '',
    equipment = '',
  } = req.body;
  if (!scene_id) return res.status(400).json({ error: 'scene_id is required' });
  if (!shot_number || !String(shot_number).trim()) return res.status(400).json({ error: 'shot_number is required' });

  const maxOrder = db.prepare('SELECT COALESCE(MAX(order_index), -1) AS m FROM shots WHERE scene_id = ?').get(scene_id).m;

  const result = db
    .prepare(
      `INSERT INTO shots (scene_id, shot_number, size, angle, movement, description, equipment, order_index)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(scene_id, shot_number, size, angle, movement, description, equipment, maxOrder + 1);

  res.status(201).json(db.prepare('SELECT * FROM shots WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM shots WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Shot not found' });
  const { shot_number, size, angle, movement, description, equipment, status, order_index } = req.body;
  db.prepare(
    `UPDATE shots SET shot_number = ?, size = ?, angle = ?, movement = ?, description = ?, equipment = ?,
       status = ?, order_index = ? WHERE id = ?`
  ).run(
    shot_number ?? existing.shot_number,
    size ?? existing.size,
    angle ?? existing.angle,
    movement ?? existing.movement,
    description ?? existing.description,
    equipment ?? existing.equipment,
    status ?? existing.status,
    order_index === undefined ? existing.order_index : order_index,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM shots WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM shots WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

router.post('/bulk', (req, res) => {
  const { scene_id, shots } = req.body;
  if (!scene_id) return res.status(400).json({ error: 'scene_id is required' });
  if (!Array.isArray(shots) || shots.length === 0) {
    return res.status(400).json({ error: 'shots must be a non-empty array' });
  }

  const maxOrder = db.prepare('SELECT COALESCE(MAX(order_index), -1) AS m FROM shots WHERE scene_id = ?').get(scene_id).m;

  const insert = db.prepare(
    `INSERT INTO shots (scene_id, shot_number, size, angle, movement, description, equipment, order_index)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertedIds = [];
  const tx = db.transaction((rows) => {
    rows.forEach((s, i) => {
      if (!s || !s.description || !String(s.description).trim()) return;
      insertedIds.push(
        insert.run(
          scene_id,
          s.shot_number ? String(s.shot_number) : String(maxOrder + 2 + i),
          s.size || '',
          s.angle || '',
          s.movement || '',
          String(s.description).trim(),
          s.equipment || '',
          maxOrder + 1 + i
        ).lastInsertRowid
      );
    });
  });
  tx(shots);

  const created = insertedIds.map((id) => db.prepare('SELECT * FROM shots WHERE id = ?').get(id));
  res.status(201).json(created);
});

router.post('/reorder', (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array of shot ids' });
  const update = db.prepare('UPDATE shots SET order_index = ? WHERE id = ?');
  const tx = db.transaction((ids) => {
    ids.forEach((id, index) => update.run(index, id));
  });
  tx(order);
  res.status(204).end();
});

module.exports = router;
