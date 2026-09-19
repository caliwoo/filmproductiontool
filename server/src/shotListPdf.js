const PDFDocument = require('pdfkit');

const PAGE_WIDTH = 792; // US Letter, landscape, points
const PAGE_HEIGHT = 612;
const MARGIN = 30;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const CELL_PADDING = 5;
const HEADER_HEIGHT = 34;
const MIN_ROW_HEIGHT = 30;
const BODY_FONT_SIZE = 8;

const COLUMNS = [
  { key: 'shot_number', label: 'Shot No.', width: 46, color: '#FCEFD0' },
  { key: 'description', label: 'Scene / Description', width: 168, color: '#FBE0B4' },
  { key: 'camera', label: 'Camera Angle / Movement', width: 104, color: '#FCCBA0' },
  { key: 'location', label: 'Location', width: 84, color: '#F8B8B0' },
  { key: 'time', label: 'Time of Day', width: 66, color: '#F6ACC0' },
  { key: 'equipment', label: 'Equipment / Lens', width: 96, color: '#F4A0A8' },
  { key: 'talent', label: 'Talent / Props', width: 96, color: '#E8899E' },
  { key: 'duration', label: 'Duration / Notes', width: 72, color: '#DD7C9C' },
];

function drawTableHeader(doc, y) {
  let x = MARGIN;
  COLUMNS.forEach((col) => {
    doc.rect(x, y, col.width, HEADER_HEIGHT).fillAndStroke(col.color, '#a88');
    doc
      .fillColor('#1a1a1a')
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .text(col.label, x + CELL_PADDING, y + 10, { width: col.width - CELL_PADDING * 2, align: 'left' });
    x += col.width;
  });
  return y + HEADER_HEIGHT;
}

function rowHeightFor(doc, values) {
  doc.font('Helvetica').fontSize(BODY_FONT_SIZE);
  let maxH = MIN_ROW_HEIGHT;
  COLUMNS.forEach((col) => {
    const text = values[col.key] || '—';
    const h = doc.heightOfString(text, { width: col.width - CELL_PADDING * 2 }) + CELL_PADDING * 2 + 4;
    if (h > maxH) maxH = h;
  });
  return maxH;
}

function drawRow(doc, y, values, striped) {
  const height = rowHeightFor(doc, values);
  let x = MARGIN;
  COLUMNS.forEach((col) => {
    doc.rect(x, y, col.width, height).fillAndStroke(striped ? '#FFFBF5' : '#FFFFFF', '#ddd');
    doc
      .fillColor('#222')
      .font('Helvetica')
      .fontSize(BODY_FONT_SIZE)
      .text(values[col.key] || '—', x + CELL_PADDING, y + CELL_PADDING, {
        width: col.width - CELL_PADDING * 2,
        height: height - CELL_PADDING * 2,
      });
    x += col.width;
  });
  return y + height;
}

function newPage(doc) {
  doc.addPage({ size: 'LETTER', layout: 'landscape', margin: MARGIN });
  return drawTableHeader(doc, MARGIN);
}

function renderShotListPdf({ project, rows }) {
  const doc = new PDFDocument({ size: 'LETTER', layout: 'landscape', margin: MARGIN, bufferPages: true });

  doc
    .font('Times-Bold')
    .fontSize(28)
    .fillColor('#111')
    .text('SHOT LIST', 0, MARGIN, { width: PAGE_WIDTH, align: 'center' });
  doc
    .font('Helvetica')
    .fontSize(12)
    .fillColor('#555')
    .text(`"${project.name}"`, 0, MARGIN + 34, { width: PAGE_WIDTH, align: 'center' });

  let y = MARGIN + 62;
  y = drawTableHeader(doc, y);

  rows.forEach((row, i) => {
    const height = rowHeightFor(doc, row);
    if (y + height > PAGE_HEIGHT - MARGIN) {
      y = newPage(doc);
    }
    y = drawRow(doc, y, row, i % 2 === 1);
  });

  if (rows.length === 0) {
    doc
      .font('Helvetica-Oblique')
      .fontSize(11)
      .fillColor('#888')
      .text('No shots have been added to this project yet.', MARGIN, y + 16, { width: CONTENT_WIDTH, align: 'center' });
  }

  return doc;
}

module.exports = { renderShotListPdf };
