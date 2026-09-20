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

// pdf-parse's default text renderer only tracks line breaks (by Y position) --
// it drops each item's horizontal position entirely, so a screenplay's
// margins (character names, dialogue, parentheticals all indented
// differently from action lines) are gone before we ever see the text. This
// reconstructs an approximate left margin per line from each text item's X
// coordinate, converting it to a proportional run of leading spaces so the
// original layout survives into the extracted text.
function renderPageWithLayout(pageData) {
  const renderOptions = { normalizeWhitespace: false, disableCombineTextItems: false };
  return pageData.getTextContent(renderOptions).then((textContent) => {
    let lastY = null;
    let text = '';
    textContent.items.forEach((item) => {
      const y = item.transform[5];
      if (lastY === null || y === lastY) {
        text += item.str;
      } else {
        const x = item.transform[4];
        // Screenplays are conventionally set in Courier, a fixed-width font
        // whose character advance is ~0.6x its point size; item.transform[0]
        // approximates that point size for this run of text.
        const fontSize = Math.abs(item.transform[0]) || 12;
        const charWidth = fontSize * 0.6 || 7.2;
        const spaceCount = Math.min(40, Math.max(0, Math.round(x / charWidth)));
        text += `\n${' '.repeat(spaceCount)}${item.str}`;
      }
      lastY = y;
    });
    return text;
  });
}

router.post('/parse', upload.single('script'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'No PDF file uploaded' });
  try {
    const data = await pdfParse(req.file.buffer, { pagerender: renderPageWithLayout });
    const scenes = parseScriptText(data.text, { numPages: data.numpages });
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
    `INSERT INTO scenes (project_id, scene_number, heading, int_ext, day_night, synopsis, page_count, order_index)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
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
        Number(s.page_count) || 1,
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
