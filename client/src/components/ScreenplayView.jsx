import { markedShotColors } from '../shotColors.js';

const TYPE_CLASS = {
  scene_heading: 'scene-heading',
  action: 'action',
  character: 'character',
  parenthetical: 'parenthetical',
  dialogue: 'dialogue',
  transition: 'transition',
};

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Wraps every occurrence of a tagged breakdown element's value (e.g. a cast
// member's name, a prop) in this line with a <mark> in that element's
// category color, so a scene's tagged elements are visible right in the
// script text instead of only in the tag list below it. Overlapping matches
// (e.g. one tag's value is a substring of another's) keep only the longest,
// leftmost match so text is never double-wrapped.
function highlightText(text, tags) {
  if (!tags || tags.length === 0) return text;

  const matches = [];
  tags.forEach((tag) => {
    const value = tag.value && tag.value.trim();
    if (!value) return;
    const re = new RegExp(`\\b${escapeRegExp(value)}\\b`, 'gi');
    let match;
    while ((match = re.exec(text))) {
      matches.push({ start: match.index, end: match.index + match[0].length, category: tag.category });
      if (match[0].length === 0) re.lastIndex += 1;
    }
  });
  if (matches.length === 0) return text;

  matches.sort((a, b) => a.start - b.start || b.end - a.end);
  const selected = [];
  let lastEnd = 0;
  matches.forEach((m) => {
    if (m.start >= lastEnd) {
      selected.push(m);
      lastEnd = m.end;
    }
  });

  const parts = [];
  let cursor = 0;
  selected.forEach((m, i) => {
    if (m.start > cursor) parts.push(text.slice(cursor, m.start));
    parts.push(
      <mark key={i} className={`highlight ${m.category}`}>
        {text.slice(m.start, m.end)}
      </mark>
    );
    cursor = m.end;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

// Breaks a line's text at each marker's character offset and inserts a
// circled shot-number cut-mark there -- like an AD marking up a printed
// script by hand to show where a new setup's coverage begins. Markers on
// the same line are sorted so multiple cuts within one line appear in the
// right order; breakdown-tag highlighting still applies within each
// resulting segment. Each mark is clickable, jumping to that shot's row in
// the shot list below (via onMarkClick), so the mark is a real reference
// into the list rather than just a static annotation.
function renderLine(text, tags, markers, onMarkClick) {
  if (!markers.length) return highlightText(text, tags);

  const parts = [];
  let cursor = 0;
  markers.forEach((m) => {
    const offset = Math.max(0, Math.min(m.offset, text.length));
    if (offset > cursor) parts.push(<span key={`t${parts.length}`}>{highlightText(text.slice(cursor, offset), tags)}</span>);
    parts.push(
      <span
        key={`m${m.id}`}
        id={`shot-mark-${m.id}`}
        className="shot-cut-mark"
        style={{ borderColor: m.color, color: m.color }}
        title={`Shot ${m.shot_number}${m.description ? `: ${m.description}` : ''} — click to jump to it in the shot list`}
        role="button"
        tabIndex={0}
        onClick={() => onMarkClick && onMarkClick(m.id)}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && onMarkClick) onMarkClick(m.id);
        }}
      >
        {m.shot_number}
      </span>
    );
    cursor = offset;
  });
  if (cursor < text.length) parts.push(<span key={`t${parts.length}`}>{highlightText(text.slice(cursor), tags)}</span>);
  return parts;
}

export default function ScreenplayView({ elements, tags, shots, onMarkClick }) {
  // Only a shot the AI (or an edit) placed at a specific point in the text
  // can be marked -- manually-added shots have no marker and just don't
  // appear here, same as before this feature existed.
  const markedShots = (shots || []).filter((s) => Number.isInteger(s.marker_line) && Number.isInteger(s.marker_offset));
  const colors = markedShotColors(shots);
  const markersForLine = (index) =>
    markedShots
      .filter((s) => s.marker_line === index)
      .map((s) => ({ id: s.id, offset: s.marker_offset, shot_number: s.shot_number, description: s.description, color: colors.get(s.id) }))
      .sort((a, b) => a.offset - b.offset);

  return (
    <div className="screenplay-view">
      {elements.map((el, i) => (
        <p key={i} className={TYPE_CLASS[el.type] || 'action'}>
          {renderLine(el.text, tags, markersForLine(i), onMarkClick)}
        </p>
      ))}

      {markedShots.length > 0 && (
        <div className="shot-marker-legend">
          {markedShots.map((s) => (
            <span
              key={s.id}
              className="shot-marker-legend-item"
              role="button"
              tabIndex={0}
              onClick={() => onMarkClick && onMarkClick(s.id)}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && onMarkClick) onMarkClick(s.id);
              }}
            >
              <span className="shot-cut-mark shot-cut-mark-legend" style={{ borderColor: colors.get(s.id), color: colors.get(s.id) }}>
                {s.shot_number}
              </span>
              {s.description || `${s.size} ${s.angle}`.trim() || 'Shot'}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
