const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const { projectId } = req.query;
  const rows = projectId
    ? db.prepare('SELECT * FROM locations WHERE project_id = ? ORDER BY id').all(projectId)
    : db.prepare('SELECT * FROM locations ORDER BY id').all();
  res.json(rows);
});

router.post('/', (req, res) => {
  const { project_id, name, address = '', notes = '' } = req.body;
  if (!project_id) return res.status(400).json({ error: 'project_id is required' });
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  const result = db
    .prepare('INSERT INTO locations (project_id, name, address, notes) VALUES (?, ?, ?, ?)')
    .run(project_id, name.trim(), address, notes);
  res.status(201).json(db.prepare('SELECT * FROM locations WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM locations WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Location not found' });
  const { name, address, notes } = req.body;
  db.prepare('UPDATE locations SET name = ?, address = ?, notes = ? WHERE id = ?').run(
    name ?? existing.name,
    address ?? existing.address,
    notes ?? existing.notes,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM locations WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM locations WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

module.exports = router;
