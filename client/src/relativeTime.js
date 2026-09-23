// Formats a SQLite `datetime('now')`-style UTC timestamp ("YYYY-MM-DD
// HH:MM:SS") as a short relative string ("3 days ago"), via the app's own
// t() so it comes out in whichever language is active.
export function formatRelativeTime(timestamp, t) {
  if (!timestamp) return '';
  const date = new Date(timestamp.replace(' ', 'T') + 'Z');
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);

  if (diffMin < 1) return t('relativeTime.justNow');
  if (diffMin < 60) return t('relativeTime.minutesAgo', { count: diffMin });

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return t('relativeTime.hoursAgo', { count: diffHr });

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return t('relativeTime.yesterday');
  if (diffDay < 7) return t('relativeTime.daysAgo', { count: diffDay });

  const diffWeek = Math.floor(diffDay / 7);
  if (diffWeek < 5) return t('relativeTime.weeksAgo', { count: diffWeek });

  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return t('relativeTime.monthsAgo', { count: diffMonth });

  const diffYear = Math.floor(diffDay / 365);
  return t('relativeTime.yearsAgo', { count: diffYear });
}
