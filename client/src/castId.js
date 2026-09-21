// Stripboard-style Cast ID#: a compact stand-in for a character's full name,
// numbered in the order that character was first introduced. Contact rows
// are auto-created (via ensureCastContact) in the order a cast element gets
// tagged on a scene, so id order approximates script order. Shared by
// Schedule (stripboard rows, call sheets) and Cast & Crew so the same
// character shows the same number everywhere.
export function castNumbersByRole(contacts) {
  const map = {};
  contacts
    .filter((c) => c.department === 'cast')
    .sort((a, b) => a.id - b.id)
    .forEach((c, i) => {
      const key = (c.role || '').trim().toUpperCase();
      if (key) map[key] = i + 1;
    });
  return map;
}
