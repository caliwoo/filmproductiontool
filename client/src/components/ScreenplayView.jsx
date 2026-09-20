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

export default function ScreenplayView({ elements, tags }) {
  return (
    <div className="screenplay-view">
      {elements.map((el, i) => (
        <p key={i} className={TYPE_CLASS[el.type] || 'action'}>
          {highlightText(el.text, tags)}
        </p>
      ))}
    </div>
  );
}
