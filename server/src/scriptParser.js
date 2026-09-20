const TIME_OF_DAY = [
  'CONTINUOUS',
  'MOMENTS LATER',
  'SAME TIME',
  'MORNING',
  'AFTERNOON',
  'EVENING',
  'DAY',
  'NIGHT',
  'DAWN',
  'DUSK',
  'LATER',
  'SAME',
];

const TIME_RE = new RegExp(`[-–—]\\s*(${TIME_OF_DAY.join('|')})\\b`, 'i');

// Optional leading scene number, then INT/EXT (or combined INT/EXT), then the slugline body.
const HEADING_RE = /^(?:(\d+[A-Za-z]?)[.)\-]?\s+)?(INT\.?\s*\/\s*EXT\.?|EXT\.?\s*\/\s*INT\.?|INT|EXT|I\/E)\.?\s+(.+?)\s*$/i;

const PAGE_ARTIFACT_RE = /^(\d+\.?|CONTINUED:?|\(CONTINUED\)|\(MORE\)|FADE (IN|OUT)[:.]?|CUT TO:?)$/i;

function normalizeIntExt(raw) {
  const stripped = raw.toUpperCase().replace(/\./g, '').replace(/\s+/g, '');
  if (stripped.includes('/')) return 'INT/EXT';
  return stripped.startsWith('E') ? 'EXT' : 'INT';
}

function roundToEighth(pages) {
  return Math.max(0.125, Math.round(pages * 8) / 8);
}

/**
 * Detects scene headings (sluglines) in raw screenplay text and returns one
 * entry per scene with its heading text, INT/EXT, day/night, the scene's
 * body text pulled from the following lines (kept as separate lines with
 * their reconstructed left margin, so character names/dialogue/action read
 * the way they did in the original PDF instead of one flattened paragraph),
 * a scene number — taken from the heading when present, otherwise assigned
 * sequentially — and an estimated page_count in eighths of a page (the AD
 * stripboard convention), based on how many lines of the extracted text the
 * scene spans relative to the PDF's real page count. The page count is an
 * approximation (text extraction doesn't preserve exact typographic
 * layout), but it's far closer than defaulting every scene to a flat 1 page.
 */
function parseScriptText(text, { numPages } = {}) {
  // Two views of the same lines: `trimmedLines` for heading/artifact
  // detection (indentation shouldn't matter there), `rawLines` with only
  // trailing whitespace stripped, so leading margin reconstruction survives
  // into the scene body text.
  const rawLines = text.split(/\r?\n/).map((l) => l.replace(/\s+$/, ''));
  const trimmedLines = rawLines.map((l) => l.replace(/[ \t]+/g, ' ').trim());

  const headings = [];
  trimmedLines.forEach((line, idx) => {
    if (!line || line.length > 140) return;
    const match = line.match(HEADING_RE);
    if (match) headings.push({ idx, match });
  });

  const avgLinesPerPage = numPages > 0 && rawLines.length > 0 ? rawLines.length / numPages : null;

  const scenes = headings.map(({ idx, match }, i) => {
    const [, leadingNumber, intExtRaw, restRaw] = match;
    let body = restRaw.trim();

    let trailingNumber = null;
    const trailingMatch = body.match(/^(.*?)\s+(\d+[A-Za-z]?)$/);
    if (!leadingNumber && trailingMatch && TIME_RE.test(trailingMatch[1])) {
      body = trailingMatch[1].trim();
      trailingNumber = trailingMatch[2];
    }

    let heading = body;
    let dayNight = '';
    const timeMatch = body.match(TIME_RE);
    if (timeMatch) {
      heading = body.slice(0, timeMatch.index).replace(/[-–—]\s*$/, '').trim();
      dayNight = timeMatch[1].toUpperCase();
    }

    const nextIdx = headings[i + 1] ? headings[i + 1].idx : rawLines.length;
    const bodyLines = rawLines
      .slice(idx + 1, nextIdx)
      .filter((_, li) => {
        const trimmed = trimmedLines[idx + 1 + li];
        return trimmed && !PAGE_ARTIFACT_RE.test(trimmed);
      });
    const synopsis = bodyLines.join('\n').slice(0, 8000).trim();
    const page_count = avgLinesPerPage ? roundToEighth((nextIdx - idx) / avgLinesPerPage) : 1;

    return {
      scene_number: leadingNumber || trailingNumber || null,
      int_ext: normalizeIntExt(intExtRaw),
      day_night: dayNight || 'DAY',
      heading: heading || body,
      synopsis,
      page_count,
    };
  });

  let counter = 0;
  scenes.forEach((s) => {
    counter += 1;
    if (!s.scene_number) s.scene_number = String(counter);
  });

  return scenes;
}

module.exports = { parseScriptText };
