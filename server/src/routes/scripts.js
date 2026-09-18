const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const db = require('../db');
const { parseScriptText } = require('../scriptParser');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') return cb(new Error('Only PDF files are supported'));
    cb(null, true);
  },
});

const router = express.Router();

router.post('/parse', upload.single('script'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'No PDF file uploaded' });
  try {
    const data = await pdfParse(req.file.buffer);
    const scenes = parseScriptText(data.text);
    if (scenes.length === 0) {
      return res
        .status(422)
        .json({ error: 'No scene headings (INT./EXT.) were detected in this PDF. Is it a screenplay?' });
    }
    res.json({ scenes, pageCount: data.numpages });
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
    `INSERT INTO scenes (project_id, scene_number, heading, int_ext, day_night, synopsis, order_index)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
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
        s.synopsis || '',
        maxOrder + 1 + i
      );
      insertedIds.push(result.lastInsertRowid);
    });
  });
  tx(scenes);

  const created = insertedIds.map((id) => ({
    ...db.prepare('SELECT * FROM scenes WHERE id = ?').get(id),
    elements: [],
  }));
  res.status(201).json(created);
});

router.use((err, req, res, next) => {
  res.status(400).json({ error: err.message || 'Could not process this file' });
});

module.exports = router;
