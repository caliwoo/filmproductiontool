const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const { projectId } = req.query;
  const rows = projectId
    ? db.prepare('SELECT * FROM contacts WHERE project_id = ? ORDER BY department, name').all(projectId)
    : db.prepare('SELECT * FROM contacts ORDER BY department, name').all();
  res.json(rows);
});

router.post('/', (req, res) => {
  const { project_id, name, role = '', department = 'crew', phone = '', email = '' } = req.body;
  if (!project_id) return res.status(400).json({ error: 'project_id is required' });
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  const result = db
    .prepare('INSERT INTO contacts (project_id, name, role, department, phone, email) VALUES (?, ?, ?, ?, ?, ?)')
    .run(project_id, name.trim(), role, department, phone, email);
  res.status(201).json(db.prepare('SELECT * FROM contacts WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Contact not found' });
  const { name, role, department, phone, email } = req.body;
  db.prepare(
    'UPDATE contacts SET name = ?, role = ?, department = ?, phone = ?, email = ? WHERE id = ?'
  ).run(
    name ?? existing.name,
    role ?? existing.role,
    department ?? existing.department,
    phone ?? existing.phone,
    email ?? existing.email,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM contacts WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

module.exports = router;
