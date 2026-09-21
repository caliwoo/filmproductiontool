// Distinct from the breakdown-element highlight palette (which colors text
// inline) so a shot cut-mark is never mistaken for a tagged cast/prop
// highlight -- a cut-mark is a circled number breaking the text flow, not a
// text color.
export const SHOT_COLORS = [
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

// Assigns each shot with a resolved text-position marker a stable color, by
// its position among marked shots. Computed once and shared between
// ScreenplayView (the cut-marks) and ShotList (the row indicator) so the
// same shot always shows the same color in both places.
export function markedShotColors(shots) {
  const marked = (shots || []).filter((s) => Number.isInteger(s.marker_line) && Number.isInteger(s.marker_offset));
  const colors = new Map();
  marked.forEach((s, i) => colors.set(s.id, SHOT_COLORS[i % SHOT_COLORS.length]));
  return colors;
}
