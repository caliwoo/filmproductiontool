const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const { projectId } = req.query;
  const rows = projectId
    ? db.prepare('SELECT * FROM shoot_days WHERE project_id = ? ORDER BY day_number, id').all(projectId)
    : db.prepare('SELECT * FROM shoot_days ORDER BY day_number, id').all();
  res.json(rows);
});

router.post('/', (req, res) => {
  const { project_id, day_number, shoot_date = '', general_call_time = '', location_id = null, weather = '', notes = '' } = req.body;
  if (!project_id) return res.status(400).json({ error: 'project_id is required' });

  const nextDay =
    day_number ??
    (db.prepare('SELECT COALESCE(MAX(day_number), 0) AS m FROM shoot_days WHERE project_id = ?').get(project_id).m + 1);

  const result = db
    .prepare(
      `INSERT INTO shoot_days (project_id, day_number, shoot_date, general_call_time, location_id, weather, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(project_id, nextDay, shoot_date, general_call_time, location_id, weather, notes);

  res.status(201).json(db.prepare('SELECT * FROM shoot_days WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM shoot_days WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Shoot day not found' });
  const { day_number, shoot_date, general_call_time, location_id, weather, notes } = req.body;
  db.prepare(
    `UPDATE shoot_days SET day_number = ?, shoot_date = ?, general_call_time = ?, location_id = ?,
       weather = ?, notes = ? WHERE id = ?`
  ).run(
    day_number ?? existing.day_number,
    shoot_date ?? existing.shoot_date,
    general_call_time ?? existing.general_call_time,
    location_id === undefined ? existing.location_id : location_id,
    weather ?? existing.weather,
    notes ?? existing.notes,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM shoot_days WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM shoot_days WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// Applies a full drag-and-drop reorder from the Schedule page in one shot:
// day order (day_number becomes each day's position in the array) and which
// day each scene assignment belongs to, plus its order within that day. The
// browser stages these moves locally; this is the "commit changes" step
// that makes them permanent.
router.post('/reorder-all', (req, res) => {
  const { days } = req.body;
  if (!Array.isArray(days)) return res.status(400).json({ error: 'days must be an array' });

  const updateDayNumber = db.prepare('UPDATE shoot_days SET day_number = ? WHERE id = ?');
  const updateAssignment = db.prepare('UPDATE shoot_day_scenes SET shoot_day_id = ?, order_index = ? WHERE id = ?');

  const tx = db.transaction((dayList) => {
    dayList.forEach((day, dayIndex) => {
      updateDayNumber.run(dayIndex + 1, day.id);
      (day.scene_assignment_ids || []).forEach((assignmentId, sceneIndex) => {
        updateAssignment.run(day.id, sceneIndex, assignmentId);
      });
    });
  });
  tx(days);

  res.status(204).end();
});

// --- Scenes assigned to a shoot day (stripboard-lite) ---

router.get('/:id/scenes', (req, res) => {
  const rows = db
    .prepare(
      `SELECT sds.id AS assignment_id, sds.order_index AS assignment_order, sds.scheduled_time, sds.estimated_minutes, s.*
       FROM shoot_day_scenes sds
       JOIN scenes s ON s.id = sds.scene_id
       WHERE sds.shoot_day_id = ?
       ORDER BY sds.order_index, sds.id`
    )
    .all(req.params.id);

  const enriched = rows.map((scene) => {
    const location = scene.location_id ? db.prepare('SELECT name FROM locations WHERE id = ?').get(scene.location_id) : null;
    const cast = db
      .prepare("SELECT value FROM scene_elements WHERE scene_id = ? AND category = 'cast'")
      .all(scene.id)
      .map((r) => r.value);
    return { ...scene, location_name: location ? location.name : null, cast };
  });

  res.json(enriched);
});

router.post('/:id/scenes', (req, res) => {
  const { scene_id, scheduled_time = '', estimated_minutes = 60 } = req.body;
  if (!scene_id) return res.status(400).json({ error: 'scene_id is required' });
  const maxOrder = db
    .prepare('SELECT COALESCE(MAX(order_index), -1) AS m FROM shoot_day_scenes WHERE shoot_day_id = ?')
    .get(req.params.id).m;
  const result = db
    .prepare(
      `INSERT INTO shoot_day_scenes (shoot_day_id, scene_id, order_index, scheduled_time, estimated_minutes)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(req.params.id, scene_id, maxOrder + 1, scheduled_time, estimated_minutes);
  res.status(201).json(db.prepare('SELECT * FROM shoot_day_scenes WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/scenes/:assignmentId', (req, res) => {
  const existing = db.prepare('SELECT * FROM shoot_day_scenes WHERE id = ?').get(req.params.assignmentId);
  if (!existing) return res.status(404).json({ error: 'Assignment not found' });
  const { scheduled_time, estimated_minutes, order_index } = req.body;
  db.prepare(
    'UPDATE shoot_day_scenes SET scheduled_time = ?, estimated_minutes = ?, order_index = ? WHERE id = ?'
  ).run(
    scheduled_time ?? existing.scheduled_time,
    estimated_minutes ?? existing.estimated_minutes,
    order_index === undefined ? existing.order_index : order_index,
    req.params.assignmentId
  );
  res.json(db.prepare('SELECT * FROM shoot_day_scenes WHERE id = ?').get(req.params.assignmentId));
});

router.delete('/scenes/:assignmentId', (req, res) => {
  db.prepare('DELETE FROM shoot_day_scenes WHERE id = ?').run(req.params.assignmentId);
  res.status(204).end();
});

router.post('/:id/scenes/reorder', (req, res) => {
  const { order } = req.body; // array of shoot_day_scenes assignment ids
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array of assignment ids' });
  const update = db.prepare('UPDATE shoot_day_scenes SET order_index = ? WHERE id = ?');
  const tx = db.transaction((ids) => {
    ids.forEach((id, index) => update.run(index, id));
  });
  tx(order);
  res.status(204).end();
});

// --- Crew/cast call times for a shoot day ---

router.get('/:id/calls', (req, res) => {
  const rows = db
    .prepare(
      `SELECT sdc.id AS call_id, sdc.call_time, sdc.notes AS call_notes, c.*
       FROM shoot_day_calls sdc
       JOIN contacts c ON c.id = sdc.contact_id
       WHERE sdc.shoot_day_id = ?
       ORDER BY c.department, c.name`
    )
    .all(req.params.id);
  res.json(rows);
});

router.put('/:id/calls/:contactId', (req, res) => {
  const { call_time = '', notes = '' } = req.body;
  db.prepare(
    `INSERT INTO shoot_day_calls (shoot_day_id, contact_id, call_time, notes)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(shoot_day_id, contact_id) DO UPDATE SET call_time = excluded.call_time, notes = excluded.notes`
  ).run(req.params.id, req.params.contactId, call_time, notes);
  res.status(204).end();
});

router.delete('/:id/calls/:contactId', (req, res) => {
  db.prepare('DELETE FROM shoot_day_calls WHERE shoot_day_id = ? AND contact_id = ?').run(
    req.params.id,
    req.params.contactId
  );
  res.status(204).end();
});

// --- Full call sheet aggregation ---

router.get('/:id/call-sheet', (req, res) => {
  const day = db.prepare('SELECT * FROM shoot_days WHERE id = ?').get(req.params.id);
  if (!day) return res.status(404).json({ error: 'Shoot day not found' });

  const location = day.location_id ? db.prepare('SELECT * FROM locations WHERE id = ?').get(day.location_id) : null;
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(day.project_id);

  const scenes = db
    .prepare(
      `SELECT sds.order_index AS assignment_order, sds.scheduled_time, sds.estimated_minutes, s.*
       FROM shoot_day_scenes sds
       JOIN scenes s ON s.id = sds.scene_id
       WHERE sds.shoot_day_id = ?
       ORDER BY sds.order_index, sds.id`
    )
    .all(req.params.id)
    .map((scene) => ({
      ...scene,
      elements: db.prepare('SELECT * FROM scene_elements WHERE scene_id = ? ORDER BY category, id').all(scene.id),
      location: scene.location_id ? db.prepare('SELECT * FROM locations WHERE id = ?').get(scene.location_id) : null,
    }));

  const calls = db
    .prepare(
      `SELECT sdc.call_time, sdc.notes AS call_notes, c.*
       FROM shoot_day_calls sdc
       JOIN contacts c ON c.id = sdc.contact_id
       WHERE sdc.shoot_day_id = ?
       ORDER BY c.department, c.name`
    )
    .all(req.params.id);

  res.json({ project, day, location, scenes, calls });
});

module.exports = router;
