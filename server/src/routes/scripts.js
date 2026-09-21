const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const db = require('../db');
const { parseScriptLines, extractTitleInfo } = require('../scriptParser');
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

// pdf-parse's default text renderer only tracks line breaks (by Y position) --
// it drops each item's horizontal position entirely, so there's no way to
// tell a character cue from an action line once the text comes back. This
// collects each page's lines as `{ text, x }` instead: `x` is the left-edge
// point-position of a line's first real glyph, read straight from pdf.js's
// own item geometry (not reconstructed or guessed), which the parser uses to
// classify each line into a screenplay element type. Lines are gathered into
// `allLines` via closure rather than returned as pagerender's string, since
// we need structured data, not text pdf-parse would just concatenate.
function createPageCollector(allLines) {
  return function collectPage(pageData) {
    const renderOptions = { normalizeWhitespace: false, disableCombineTextItems: false };
    return pageData.getTextContent(renderOptions).then((textContent) => {
      let lastY = null;
      let lineText = '';
      let lineX = null;

      const flushLine = () => {
        allLines.push({ text: lineText.replace(/\s+/g, ' ').trim(), x: lineX });
      };

      textContent.items.forEach((item) => {
        const y = item.transform[5];
        if (lastY !== null && y !== lastY) {
          flushLine();
          lineText = '';
          lineX = null;
        }
        if (lineX === null && item.str.trim() !== '') {
          lineX = item.transform[4];
        }
        lineText += item.str;
        lastY = y;
      });
      if (lastY !== null) flushLine();

      return '';
    });
  };
}

router.post('/parse', upload.single('script'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'No PDF file uploaded' });
  try {
    const allLines = [];
    const data = await pdfParse(req.file.buffer, { pagerender: createPageCollector(allLines) });
    const scenes = parseScriptLines(allLines, { numPages: data.numpages });
    if (scenes.length === 0) {
      return res
        .status(422)
        .json({ error: 'No scene headings (INT./EXT.) were detected in this PDF. Is it a screenplay?' });
    }
    const { title, author } = extractTitleInfo(allLines);
    res.json({
      scenes,
      pageCount: data.numpages,
      suggestedName: title,
      suggestedDescription: author ? `Written by ${author}` : null,
    });
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
