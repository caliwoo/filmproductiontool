const express = require('express');
const db = require('../db');
const { getShotListRows, groupRowsBySetup } = require('../shotListData');
const { renderShotListPdf } = require('../shotListPdf');
const { buildSchedulePreview, commitSchedule } = require('../scheduleBuilder');

const router = express.Router();

router.get('/', (req, res) => {
  const projects = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
  res.json(projects);
});

router.get('/:id', (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json(project);
});

router.post('/', (req, res) => {
  const { name, description = '' } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  const result = db.prepare('INSERT INTO projects (name, description) VALUES (?, ?)').run(name.trim(), description);
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(project);
});

router.put('/:id', (req, res) => {
  const { name, description } = req.body;
  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Project not found' });
  db.prepare('UPDATE projects SET name = ?, description = ? WHERE id = ?').run(
    name ?? existing.name,
    description ?? existing.description,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// --- Master shot list: every shot across every scene, for viewing/exporting ---

router.get('/:id/shot-list', (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  let rows = getShotListRows(req.params.id);
  if (req.query.group === 'setup') rows = groupRowsBySetup(rows);
  res.json({ project, rows });
});

router.get('/:id/shot-list-pdf', (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  let sourceRows = getShotListRows(req.params.id);
  if (req.query.group === 'setup') sourceRows = groupRowsBySetup(sourceRows);

  const rows = sourceRows.map((r) => ({
    shot_number: r.shot_number,
    scene_number: r.scene_number,
    description: [r.scene_heading, r.description].filter(Boolean).join(' — '),
    subject: r.subject,
    camera: [r.size, r.angle, r.movement].filter(Boolean).join(', '),
    lens: r.lens,
    location: r.location,
    time: r.day_night,
    equipment: r.equipment,
    talent: [...r.cast, ...r.props].join(', '),
    notes: [r.spatial_composition, r.setup_notes].filter(Boolean).join(' — '),
  }));

  const safeName = project.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'Project';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}-Shot-List.pdf"`);

  const doc = renderShotListPdf({ project, rows });
  doc.pipe(res);
  doc.end();
});

// --- Automatic shooting schedule builder ---

router.post('/:id/build-schedule/preview', (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const sceneCount = db.prepare('SELECT COUNT(*) AS c FROM scenes WHERE project_id = ?').get(req.params.id).c;
  if (sceneCount === 0) {
    return res.status(422).json({ error: 'Add scenes in Script Breakdown before building a schedule.' });
  }

  const pagesPerDay = Number(req.body.pagesPerDay) || 5;
  const startDate = req.body.startDate || null;
  const workDaysPerWeek = Number(req.body.workDaysPerWeek) === 6 ? 6 : 5;
  const { days, excludedScenes } = buildSchedulePreview(db, req.params.id, { pagesPerDay, startDate, workDaysPerWeek });

  if (days.length === 0) {
    return res.status(422).json({
      error:
        'No scenes are ready to schedule yet. A scene needs at least one tagged breakdown element and at least one shot before it can be scheduled.',
      excludedScenes,
    });
  }

  const existingDaysCount = db.prepare('SELECT COUNT(*) AS c FROM shoot_days WHERE project_id = ?').get(req.params.id).c;

  res.json({ days, excludedScenes, existingDaysCount });
});

router.post('/:id/build-schedule/commit', (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const { days } = req.body;
  if (!Array.isArray(days) || days.length === 0) {
    return res.status(400).json({ error: 'days must be a non-empty array' });
  }

  commitSchedule(db, req.params.id, days);
  res.status(201).json({ ok: true });
});

module.exports = router;
