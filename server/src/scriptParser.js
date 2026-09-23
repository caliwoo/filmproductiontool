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

// Pure pagination noise -- never real screenplay content, always dropped.
const PAGE_ARTIFACT_RE = /^(\d+\.?|CONTINUED:?|\(CONTINUED\))$/i;

// Standalone transition lines. Unlike a character cue, these end a beat rather
// than introduce dialogue, so they're recognized by their own vocabulary
// instead of just "short and uppercase".
const TRANSITION_RE =
  /^(FADE (IN|OUT|TO BLACK)[:.]?|CUT TO:?|DISSOLVE TO:?|SMASH CUT TO:?|MATCH CUT TO:?|JUMP CUT TO:?|TO BLACK\.?|THE END\.?)$/i;

// A character cue's own name is followed by one of these extensions; strip it
// off before checking cue length so "JULIANE (CONT'D)" still reads as a name.
const CHARACTER_SUFFIX_RE = /\s*\((V\.O\.|O\.S\.|O\.C\.|CONT'?D|CONT[’']D)\.?\)\s*$/i;

// Screenplays are conventionally set in Courier on a Letter page with action
// starting ~1.5in (108pt) from the left and dialogue ~2.5in (180pt). Any line
// at or above this threshold is past where action ever sits, so it's either
// dialogue or (via the pattern checks below) a character cue -- this is
// deliberately the ONE positional signal the classifier leans on, because
// action and dialogue are otherwise both ordinary mixed-case prose with
// nothing but position to tell them apart. It only needs to bucket a line
// coarsely, not reproduce its exact position, so it tolerates a PDF whose
// margins are a bit off standard -- and unlike a scheme that keeps classifying
// lines as dialogue until a blank line resets it, a per-line decision here
// can't cascade: a PDF that never emits a genuinely blank line between
// paragraphs (several real screenplay exports don't) can't drag the rest of
// a scene into one long misclassified dialogue block.
const ACTION_MAX_X = 155; // ~2.15in

function normalizeIntExt(raw) {
  const stripped = raw.toUpperCase().replace(/\./g, '').replace(/\s+/g, '');
  if (stripped.includes('/')) return 'INT/EXT';
  return stripped.startsWith('E') ? 'EXT' : 'INT';
}

function roundToEighth(pages) {
  return Math.max(0.125, Math.round(pages * 8) / 8);
}

function isUpperCase(text) {
  return /[A-Z]/.test(text) && text === text.toUpperCase();
}

/**
 * Classifies a scene's body lines (already excludes the heading line itself)
 * into typed screenplay elements -- action, character, parenthetical,
 * dialogue, or transition -- independently per line, from that line's own
 * text pattern and left x-position. Parentheticals and transitions are
 * recognized purely by pattern (a parenthetical always opens with "(", and
 * real-world transitions are drawn from a small, well-known vocabulary) so
 * neither depends on position at all. A character cue is an all-caps line
 * that isn't a complete punctuated sentence (ruling out an all-caps action
 * beat like "SILENCE." or "BOOM!") sitting past the action margin. Anything
 * else past the action margin is dialogue; anything at or before it is
 * action, including a mid-paragraph word that wrapped without the rest of
 * its line's indent (a quirk seen in some PDF exports) -- it still reads as
 * action rather than being pulled into whatever came before it.
 */
function classifyBodyLines(lines) {
  const elements = [];

  lines.forEach(({ text, x }) => {
    if (!text) return;
    if (PAGE_ARTIFACT_RE.test(text)) return;

    if (text.startsWith('(')) {
      elements.push({ type: 'parenthetical', text });
      return;
    }

    const upper = isUpperCase(text);
    if (upper && TRANSITION_RE.test(text)) {
      elements.push({ type: 'transition', text });
      return;
    }

    if (x !== null && x < ACTION_MAX_X) {
      elements.push({ type: 'action', text });
      return;
    }

    const cueName = text.replace(CHARACTER_SUFFIX_RE, '').trim();
    if (upper && cueName.length >= 2 && cueName.length <= 40 && !/[.!?]$/.test(text.trim())) {
      elements.push({ type: 'character', text });
      return;
    }

    elements.push({ type: x === null ? 'action' : 'dialogue', text });
  });

  // A real character cue is always followed by that character's own
  // parenthetical or dialogue -- that's the entire grammatical point of one.
  // A "character"-shaped line (short, all-caps, unpunctuated) with anything
  // else right after it -- action, another cue, a transition, or the end of
  // the scene -- is never actually introducing speech. It's almost always
  // page-break noise the PDF text extraction pulled in from a running
  // header/footer (a title or act label repeated on every page), which
  // otherwise sits in the middle of a scene as a bogus character cue with no
  // dialogue and can derail anything reading the scene as a whole (e.g. the
  // AI shot lister, which is handed the classified line types verbatim).
  elements.forEach((el, i) => {
    if (el.type !== 'character') return;
    const next = elements[i + 1];
    if (!next || (next.type !== 'dialogue' && next.type !== 'parenthetical')) {
      el.type = 'action';
    }
  });

  return elements;
}

/**
 * Detects scene headings (sluglines) in a document's lines and returns one
 * entry per scene with its heading text, INT/EXT, day/night, a scene number
 * — taken from the heading when present, otherwise assigned sequentially —
 * an estimated page_count in eighths of a page (the AD stripboard
 * convention) based on how many lines the scene spans relative to the PDF's
 * real page count, a flattened `synopsis` string (for search, AI features,
 * and manual editing), and `script_elements`: the same body classified into
 * typed screenplay elements for formatted display.
 *
 * `lines` is an array of `{ text, x }`, one per line of the source PDF:
 * `text` is that line's fully-trimmed content (empty string for a blank
 * line), and `x` is the left-edge point-position of its first real glyph on
 * the page, read directly from the PDF rather than estimated.
 */
function parseScriptLines(lines, { numPages } = {}) {
  const headings = [];
  lines.forEach(({ text }, idx) => {
    if (!text || text.length > 140) return;
    const match = text.match(HEADING_RE);
    if (match) headings.push({ idx, match });
  });

  const avgLinesPerPage = numPages > 0 && lines.length > 0 ? lines.length / numPages : null;

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

    const nextIdx = headings[i + 1] ? headings[i + 1].idx : lines.length;
    const scriptElements = classifyBodyLines(lines.slice(idx + 1, nextIdx));
    const synopsis = scriptElements
      .map((el) => el.text)
      .join('\n')
      .slice(0, 8000);
    const page_count = avgLinesPerPage ? roundToEighth((nextIdx - idx) / avgLinesPerPage) : 1;

    return {
      scene_number: leadingNumber || trailingNumber || null,
      int_ext: normalizeIntExt(intExtRaw),
      day_night: dayNight || 'DAY',
      heading: heading || body,
      synopsis,
      script_elements: scriptElements,
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

// Lines before the screenplay's first scene heading are its title page --
// usually just the title, a "by AUTHOR" byline, and boilerplate (draft
// status, copyright, contact info) with no further structure to lean on.
// Used to prefill a new project's name/description when it's created
// directly from an uploaded script, so the title page isn't just discarded.
function extractTitleInfo(lines) {
  const firstHeadingIdx = lines.findIndex(({ text }) => text && text.length <= 140 && HEADING_RE.test(text));
  const titlePageLines = (firstHeadingIdx === -1 ? lines : lines.slice(0, firstHeadingIdx))
    .map((l) => l.text.trim())
    .filter(Boolean);

  const BYLINE_RE = /^(?:written\s+)?by\s+(.+)$/i;
  // Many title pages put "Written by" on its own line with the author's name
  // on the next one, rather than both on a single line.
  const BYLINE_LABEL_ONLY_RE = /^(?:written\s+)?by$/i;
  const BOILERPLATE_RE = /^(final\s+draft|revised|draft|shooting\s+script|copyright|\(c\)|©|wga\s)/i;

  let title = null;
  let author = null;
  titlePageLines.forEach((line, i) => {
    const bylineMatch = line.match(BYLINE_RE);
    if (bylineMatch) {
      if (!author) author = bylineMatch[1].trim();
      return;
    }
    if (BYLINE_LABEL_ONLY_RE.test(line)) {
      if (!author && titlePageLines[i + 1]) author = titlePageLines[i + 1].trim();
      return;
    }
    if (!title && !BOILERPLATE_RE.test(line) && line.length <= 80) {
      title = line.replace(/^["'“]+|["'”]+$/g, '').trim();
    }
  });

  return { title: title || null, author: author || null };
}

module.exports = { parseScriptLines, classifyBodyLines, extractTitleInfo };
