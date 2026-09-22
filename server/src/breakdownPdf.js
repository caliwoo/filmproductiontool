const PDFDocument = require('pdfkit');
const { locationLabel } = require('./locationSync');

// AD stripboards track script length in eighths of a page (e.g. "2 3/8"),
// not decimals.
function formatPageLength(decimal) {
  const total = Math.max(0, Math.round((Number(decimal) || 0) * 8));
  const whole = Math.floor(total / 8);
  const eighths = total % 8;
  if (eighths === 0) return `${whole}`;
  return whole === 0 ? `${eighths}/8` : `${whole} ${eighths}/8`;
}

const PAGE_WIDTH = 612; // US Letter, points
const MARGIN = 36;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const CATEGORY_LABELS = {
  cast: 'Cast',
  stunts: 'Stunts',
  extras: 'Extras',
  props: 'Props',
  wardrobe: 'Wardrobe',
  vehicles: 'Vehicles',
  sfx: 'Special Effects',
  vfx: 'Visual Effects',
  sound: 'Sound',
  makeup: 'Makeup / Hair',
  animals: 'Animals',
  notes: 'Notes',
};

function box(doc, x, y, w, h) {
  doc.lineWidth(1).rect(x, y, w, h).stroke();
}

function labeledCell(doc, x, y, w, h, label, value, { valueSize = 10, align = 'left', emptyMessage } = {}) {
  box(doc, x, y, w, h);
  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor('#444')
    .text(label.toUpperCase(), x + 6, y + 5, { width: w - 12, align });

  if (value) {
    doc
      .font('Helvetica')
      .fontSize(valueSize)
      .fillColor('#000')
      .text(value, x + 6, y + 18, { width: w - 12, height: h - 24, align, ellipsis: true });
  } else {
    doc
      .font('Helvetica-Oblique')
      .fontSize(Math.max(valueSize - 1, 7))
      .fillColor('#999')
      .text(emptyMessage || '—', x + 6, y + 18, { width: w - 12, height: h - 24, align, ellipsis: true });
  }
}

function elementBox(doc, x, y, w, h, category, elements) {
  box(doc, x, y, w, h);
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor('#000')
    .text(CATEGORY_LABELS[category] || category, x + 6, y + 6, { width: w - 12 });

  const values = elements.filter((e) => e.category === category).map((e) => e.value);
  const text = values.length ? values.join('\n') : '—';
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(values.length ? '#000' : '#999')
    .text(text, x + 6, y + 22, { width: w - 12, height: h - 28, ellipsis: true });
}

function generateBreakdownSheet(doc, { project, scene, location, elements }) {
  doc.font('Helvetica');

  // --- Top header: breakdown # box, title, scene # box ---
  const headerBoxW = 130;
  const headerBoxH = 44;

  box(doc, MARGIN, MARGIN, headerBoxW, headerBoxH);
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .text('BREAKDOWN SHEET #', MARGIN + 6, MARGIN + 8, { width: headerBoxW - 12, align: 'center' });
  doc
    .font('Helvetica-Bold')
    .fontSize(13)
    .text(String(scene.scene_number), MARGIN + 6, MARGIN + 24, { width: headerBoxW - 12, align: 'center' });

  const rightBoxX = MARGIN + CONTENT_WIDTH - headerBoxW;
  box(doc, rightBoxX, MARGIN, headerBoxW, headerBoxH);
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .text('SCENE #', rightBoxX + 6, MARGIN + 8, { width: headerBoxW - 12, align: 'center' });
  doc
    .font('Helvetica-Bold')
    .fontSize(13)
    .text(String(scene.scene_number), rightBoxX + 6, MARGIN + 24, { width: headerBoxW - 12, align: 'center' });

  doc
    .font('Helvetica-Bold')
    .fontSize(18)
    .fillColor('#000')
    .text('SCRIPT BREAKDOWN SHEET', 0, MARGIN + 6, { width: PAGE_WIDTH, align: 'center' });
  doc
    .font('Helvetica-Oblique')
    .fontSize(13)
    .text(`"${project.name}"`, 0, MARGIN + 28, { width: PAGE_WIDTH, align: 'center' });

  // --- Scene info grid ---
  let y = MARGIN + headerBoxH + 12;
  const row1H = 46;
  const row2H = 64;
  const colA = 90; // INT/EXT
  const colB = 230; // Set
  const colC = 110; // Day/Night
  const colD = CONTENT_WIDTH - colA - colB - colC; // Pages

  labeledCell(doc, MARGIN, y, colA, row1H, 'Int / Ext', scene.int_ext, { align: 'center' });
  labeledCell(doc, MARGIN + colA, y, colB, row1H, 'Set', scene.heading);
  labeledCell(doc, MARGIN + colA + colB, y, colC, row1H, 'Day / Night', scene.day_night, { align: 'center' });
  labeledCell(doc, MARGIN + colA + colB + colC, y, colD, row1H, 'Pages', formatPageLength(scene.page_count), {
    align: 'center',
  });

  y += row1H;
  labeledCell(doc, MARGIN, y, colA + colB, row2H, 'Description', scene.synopsis, { valueSize: 9 });
  const noLocationMessage = 'Select a location for this scene in Script Breakdown to fill this in';
  labeledCell(doc, MARGIN + colA + colB, y, colC, row2H, 'Location', locationLabel(location), {
    valueSize: 9,
    emptyMessage: noLocationMessage,
  });
  labeledCell(doc, MARGIN + colA + colB + colC, y, colD, row2H, 'Address', location ? location.address : null, {
    valueSize: 9,
    emptyMessage: noLocationMessage,
  });

  // --- Breakdown element boxes ---
  y += row2H + 10;
  const rowH = 108;
  const col3 = CONTENT_WIDTH / 3;

  const grid = [
    ['cast', 'stunts', 'extras'],
    ['props', 'wardrobe', 'vehicles'],
    ['sfx', 'vfx', 'sound'],
    ['makeup', 'animals', 'notes'],
  ];

  grid.forEach((row) => {
    row.forEach((category, i) => {
      elementBox(doc, MARGIN + i * col3, y, col3, rowH, category, elements);
    });
    y += rowH;
  });

  // --- Footer ---
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#888')
    .text(`Generated by OmniSlate on ${new Date().toISOString().slice(0, 10)}`, MARGIN, y + 10, {
      width: CONTENT_WIDTH,
      align: 'center',
    });
}

function renderBreakdownPdf(data) {
  const doc = new PDFDocument({ size: 'LETTER', margin: MARGIN, bufferPages: true });
  generateBreakdownSheet(doc, data);
  return doc;
}

module.exports = { renderBreakdownPdf };
