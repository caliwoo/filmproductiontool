const TYPE_CLASS = {
  scene_heading: 'scene-heading',
  action: 'action',
  character: 'character',
  parenthetical: 'parenthetical',
  dialogue: 'dialogue',
  transition: 'transition',
};

// Distinct from the breakdown-element highlight palette (which colors text
// inline) so a shot marker badge is never mistaken for a tagged cast/prop
// highlight -- shot coverage is a badge before the line, not a text color.
const SHOT_COLORS = [
  '#2563eb',
  '#dc2626',
  '#16a34a',
  '#9333ea',
  '#ea580c',
  '#0891b2',
  '#db2777',
  '#65a30d',
  '#7c3aed',
  '#0d9488',
];

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

export default function ScreenplayView({ elements, tags, shots }) {
  // Only shots the AI (or an edit) placed on a specific line range can be
  // marked -- manually-added shots have no coverage and just don't appear
  // here, same as before this feature existed.
  const coveredShots = (shots || []).filter(
    (s) => Number.isInteger(s.covers_start) && Number.isInteger(s.covers_end)
  );
  const colorForShot = (id) => SHOT_COLORS[coveredShots.findIndex((s) => s.id === id) % SHOT_COLORS.length];
  const shotsForLine = (index) => coveredShots.filter((s) => index >= s.covers_start && index <= s.covers_end);

  return (
    <div className="screenplay-view">
      {elements.map((el, i) => {
        const lineShots = shotsForLine(i);
        return (
          <p key={i} className={TYPE_CLASS[el.type] || 'action'}>
            {lineShots.map((s) => (
              <span
                key={s.id}
                className="shot-marker"
                style={{ background: colorForShot(s.id) }}
                title={`Shot ${s.shot_number}${s.description ? `: ${s.description}` : ''}`}
              >
                {s.shot_number}
              </span>
            ))}
            {highlightText(el.text, tags)}
          </p>
        );
      })}

      {coveredShots.length > 0 && (
        <div className="shot-marker-legend">
          {coveredShots.map((s) => (
            <span key={s.id} className="shot-marker-legend-item">
              <span className="shot-marker" style={{ background: colorForShot(s.id) }}>
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
