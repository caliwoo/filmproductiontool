// Heuristic shooting-schedule generator, applying as much of the standard
// AD scheduling playbook as the tracked breakdown data supports:
//   - group scenes by location to minimize company moves
//   - schedule locations with exterior scenes earlier (weather contingency)
//   - tackle higher-complexity scenes (stunts/sfx/vehicles/extras) earlier
//   - never mix DAY and NIGHT scenes in the same shoot day (turnarounds)
//   - cap each day at a target page count
//   - within a day, scenes tagged with animals go first (early-in-day rule;
//     there's no separate "minor" tag to apply the same rule to)
// It does not know actor availability, legal minor hour limits, weather
// forecasts, or budget -- those need a human pass after generating this.

const COMPLEXITY_WEIGHT = { stunts: 3, sfx: 3, vehicles: 2, extras: 2, animals: 2 };

function dayNightGroup(dayNight) {
  return dayNight === 'NIGHT' ? 'night' : 'day';
}

function timeToMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins) {
  const wrapped = ((mins % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function buildSchedulePreview(db, projectId, { pagesPerDay = 5 } = {}) {
  const scenes = db.prepare('SELECT * FROM scenes WHERE project_id = ? ORDER BY order_index, id').all(projectId);
  const locations = db.prepare('SELECT * FROM locations WHERE project_id = ?').all(projectId);
  const locationById = new Map(locations.map((l) => [l.id, l]));

  const elementsByScene = new Map();
  scenes.forEach((s) => {
    elementsByScene.set(s.id, db.prepare('SELECT category FROM scene_elements WHERE scene_id = ?').all(s.id));
  });

  const complexityScore = (sceneId) =>
    (elementsByScene.get(sceneId) || []).reduce((sum, e) => sum + (COMPLEXITY_WEIGHT[e.category] || 0), 0);

  const hasCategory = (sceneId, category) => (elementsByScene.get(sceneId) || []).some((e) => e.category === category);

  // Rank locations: any-exterior locations first, then by total complexity
  // (weather buffer + tackle the hardest setups earliest).
  const locationStats = new Map();
  scenes.forEach((s) => {
    const key = s.location_id ?? 'none';
    const stat = locationStats.get(key) || { hasExt: false, totalComplexity: 0 };
    if (s.int_ext === 'EXT' || s.int_ext === 'INT/EXT') stat.hasExt = true;
    stat.totalComplexity += complexityScore(s.id);
    locationStats.set(key, stat);
  });
  const locationRank = new Map();
  [...locationStats.keys()]
    .sort((a, b) => {
      const sa = locationStats.get(a);
      const sb = locationStats.get(b);
      if (sa.hasExt !== sb.hasExt) return sa.hasExt ? -1 : 1;
      return sb.totalComplexity - sa.totalComplexity;
    })
    .forEach((key, i) => locationRank.set(key, i));

  const ordered = [...scenes].sort((a, b) => {
    const la = locationRank.get(a.location_id ?? 'none');
    const lb = locationRank.get(b.location_id ?? 'none');
    if (la !== lb) return la - lb;
    const dna = dayNightGroup(a.day_night) === 'night' ? 1 : 0;
    const dnb = dayNightGroup(b.day_night) === 'night' ? 1 : 0;
    if (dna !== dnb) return dna - dnb;
    const ca = complexityScore(a.id);
    const cb = complexityScore(b.id);
    if (ca !== cb) return cb - ca;
    return a.order_index - b.order_index;
  });

  // Bin-pack into days: cap pages/day, never mix day/night in one day.
  const rawDays = [];
  let current = null;

  ordered.forEach((scene) => {
    const group = dayNightGroup(scene.day_night);
    const pages = Number(scene.page_count) || 0;
    const wouldOverflow = current && current.scenes.length > 0 && current.totalPages + pages > pagesPerDay;
    const mismatchedGroup = current && current.dnGroup !== group;

    if (!current || wouldOverflow || mismatchedGroup) {
      current = { scenes: [], totalPages: 0, dnGroup: group, locationCounts: new Map() };
      rawDays.push(current);
    }

    current.scenes.push(scene);
    current.totalPages += pages;
    const locKey = scene.location_id ?? 'none';
    current.locationCounts.set(locKey, (current.locationCounts.get(locKey) || 0) + 1);
  });

  // Within a day, animal-tagged scenes go first (early-call rule).
  rawDays.forEach((day) => {
    day.scenes.sort((a, b) => (hasCategory(a.id, 'animals') ? 0 : 1) - (hasCategory(b.id, 'animals') ? 0 : 1));
  });

  return rawDays.map((day, i) => {
    let dominantLocationId = null;
    let maxCount = 0;
    day.locationCounts.forEach((count, key) => {
      if (count > maxCount) {
        maxCount = count;
        dominantLocationId = key === 'none' ? null : key;
      }
    });

    const generalCallTime = day.dnGroup === 'night' ? '17:00' : '07:00';
    let cursor = timeToMinutes(generalCallTime);

    const sceneEntries = day.scenes.map((scene) => {
      const estimated_minutes = 60;
      const scheduled_time = minutesToTime(cursor);
      cursor += estimated_minutes;
      return {
        scene_id: scene.id,
        scene_number: scene.scene_number,
        heading: scene.heading,
        int_ext: scene.int_ext,
        day_night: scene.day_night,
        page_count: scene.page_count,
        location_id: scene.location_id,
        location_name: scene.location_id ? locationById.get(scene.location_id)?.name || null : null,
        scheduled_time,
        estimated_minutes,
      };
    });

    return {
      day_number: i + 1,
      day_night: day.dnGroup,
      general_call_time: generalCallTime,
      location_id: dominantLocationId,
      location_name: dominantLocationId ? locationById.get(dominantLocationId)?.name || null : null,
      total_pages: Math.round(day.totalPages * 8) / 8,
      scenes: sceneEntries,
    };
  });
}

function commitSchedule(db, projectId, days) {
  const insertDay = db.prepare(
    `INSERT INTO shoot_days (project_id, day_number, general_call_time, location_id) VALUES (?, ?, ?, ?)`
  );
  const insertSceneAssignment = db.prepare(
    `INSERT INTO shoot_day_scenes (shoot_day_id, scene_id, order_index, scheduled_time, estimated_minutes)
     VALUES (?, ?, ?, ?, ?)`
  );

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM shoot_days WHERE project_id = ?').run(projectId);
    days.forEach((day, dayIndex) => {
      const shootDayId = insertDay.run(
        projectId,
        day.day_number || dayIndex + 1,
        day.general_call_time || '',
        day.location_id || null
      ).lastInsertRowid;

      (day.scenes || []).forEach((scene, order) => {
        insertSceneAssignment.run(shootDayId, scene.scene_id, order, scene.scheduled_time || '', scene.estimated_minutes || 60);
      });
    });
  });
  tx();
}

module.exports = { buildSchedulePreview, commitSchedule };
