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

/**
 * Detects scene headings (sluglines) in raw screenplay text and returns one
 * entry per scene with its heading text, INT/EXT, day/night, a short
 * synopsis pulled from the following lines, and a scene number — taken from
 * the heading when present, otherwise assigned sequentially.
 */
function parseScriptText(text) {
  const rawLines = text.split(/\r?\n/).map((l) => l.replace(/[ \t]+/g, ' ').trim());

  const headings = [];
  rawLines.forEach((line, idx) => {
    if (!line || line.length > 140) return;
    const match = line.match(HEADING_RE);
    if (match) headings.push({ idx, match });
  });

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
    const bodyLines = rawLines.slice(idx + 1, nextIdx).filter((l) => l && !PAGE_ARTIFACT_RE.test(l));
    const synopsis = bodyLines.join(' ').slice(0, 400).trim();

    return {
      scene_number: leadingNumber || trailingNumber || null,
      int_ext: normalizeIntExt(intExtRaw),
      day_night: dayNight || 'DAY',
      heading: heading || body,
      synopsis,
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
