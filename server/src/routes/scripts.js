const path = require('path');
const { Worker } = require('worker_threads');
const express = require('express');
const multer = require('multer');
const db = require('../db');
const { ensureLocation } = require('../locationSync');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') return cb(new Error('Only PDF files are supported'));
    cb(null, true);
  },
});

const router = express.Router();

// Parsing runs in a worker thread (scriptParseWorker.js), not inline here --
// a feature-length script's PDF text extraction is CPU-bound enough to block
// the main event loop for well over Railway's proxy dial timeout, which
// turns into a 502 even though the server itself never crashed. See that
// file for the full explanation.
function parseInWorker(buffer) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, '../scriptParseWorker.js'), {
      workerData: { buffer },
    });
    worker.once('message', (msg) => {
      worker.terminate();
      if (msg.ok) resolve(msg.result);
      else reject(new Error(msg.error));
    });
    worker.once('error', (err) => {
      worker.terminate();
      reject(err);
    });
  });
}

router.post('/parse', upload.single('script'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'No PDF file uploaded' });
  try {
    const { scenes, pageCount, suggestedName, suggestedDescription } = await parseInWorker(req.file.buffer);
    if (scenes.length === 0) {
      return res
        .status(422)
        .json({ error: 'No scene headings (INT./EXT.) were detected in this PDF. Is it a screenplay?' });
    }
    res.json({ scenes, pageCount, suggestedName, suggestedDescription });
  } catch (err) {
    next(err);
  }
});

router.post('/import', (req, res) => {
  const { project_id, scenes } = req.body;
  if (!project_id) return res.status(400).json({ error: 'project_id is required' });
  if (!Array.isArray(scenes) || scenes.length === 0) {
    return res.status(400).json({ error: 'scenes must be a non-empty array' });
  }

  const maxOrder = db
    .prepare('SELECT COALESCE(MAX(order_index), -1) AS m FROM scenes WHERE project_id = ?')
    .get(project_id).m;

  const insert = db.prepare(
    `INSERT INTO scenes (project_id, scene_number, heading, int_ext, day_night, location_id, synopsis, script_elements, page_count, order_index)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const insertedIds = [];
  const tx = db.transaction((rows) => {
    rows.forEach((s, i) => {
      const result = insert.run(
        project_id,
        String(s.scene_number ?? i + 1),
        s.heading || '',
        s.int_ext || 'INT',
        s.day_night || 'DAY',
        ensureLocation(db, project_id, s.heading),
        s.synopsis || '',
        Array.isArray(s.script_elements) ? JSON.stringify(s.script_elements) : null,
        Number(s.page_count) || 1,
        maxOrder + 1 + i
      );
      insertedIds.push(result.lastInsertRowid);
    });
  });
  tx(scenes);

  const created = insertedIds.map((id) => {
    const row = db.prepare('SELECT * FROM scenes WHERE id = ?').get(id);
    let script_elements = null;
    if (row.script_elements) {
      try {
        script_elements = JSON.parse(row.script_elements);
      } catch {
        script_elements = null;
      }
    }
    return { ...row, script_elements, elements: [] };
  });
  res.status(201).json(created);
});

router.use((err, req, res, next) => {
  res.status(400).json({ error: err.message || 'Could not process this file' });
});

module.exports = router;
