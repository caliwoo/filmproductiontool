// Screenplay page length is conventionally tracked in eighths of a page
// (e.g. "2 3/8 pgs"), not decimals -- this converts between that and the
// plain decimal `page_count` stored on a scene.
export function decimalToEighths(decimal) {
  const total = Math.max(0, Math.round((Number(decimal) || 0) * 8));
  return { whole: Math.floor(total / 8), eighths: total % 8 };
}

export function eighthsToDecimal(whole, eighths) {
  return (Number(whole) || 0) + (Number(eighths) || 0) / 8;
}

export function formatPageLength(decimal) {
  const { whole, eighths } = decimalToEighths(decimal);
  if (eighths === 0) return `${whole}`;
  return whole === 0 ? `${eighths}/8` : `${whole} ${eighths}/8`;
}
