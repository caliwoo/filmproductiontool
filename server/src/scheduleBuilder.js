// Heuristic shooting-schedule generator, applying as much of the standard
// AD scheduling playbook as the tracked breakdown data supports:
//   - group scenes by location to minimize company moves
//   - schedule locations with exterior scenes earlier (weather contingency)
//   - among locations that tie on the above, cluster ones that share lead
//     cast together, so a lead's scenes fall on as few, closely-spaced
//     days as possible (lead actors are usually paid whether they work
//     that day or not, so gaps between their days are wasted money)
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

// A 6-day week treats Mon-Sat as shoot days (Sunday off); a 5-day week
// treats Mon-Fri as shoot days (Saturday and Sunday off). This is what
// actually turns a chosen workweek length into rest days on the calendar --
// the schedule doesn't otherwise track hours worked, so it can't check a
// rest-period rule's hour minimums directly, but it can keep the right
// number of full days off between weeks.
function isWorkDay(date, workDaysPerWeek) {
  const day = date.getDay(); // 0 = Sunday, 6 = Saturday
  return workDaysPerWeek === 6 ? day !== 0 : day >= 1 && day <= 5;
}

// Assigns each shoot day the next available date on that calendar, in
// order, starting from (and including, if eligible) startDate. Returns the
// days unchanged if no start date was given, so date assignment stays
// entirely optional.
function assignShootDates(days, startDate, workDaysPerWeek) {
  if (!startDate) return days;
  const cursor = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(cursor.getTime())) return days;

  return days.map((day, i) => {
    if (i > 0) cursor.setDate(cursor.getDate() + 1);
    while (!isWorkDay(cursor, workDaysPerWeek)) cursor.setDate(cursor.getDate() + 1);
    return { ...day, shoot_date: cursor.toISOString().slice(0, 10) };
  });
}

// A scene only enters the auto-schedule once it's actually been worked:
// tagged with at least one breakdown element and given at least one shot.
// Scenes that are still just a heading get left out, with a reason, so an
// unfinished breakdown doesn't silently produce a shoot day of guesses.
function readinessFilter(db, allScenes) {
  const ready = [];
  const excluded = [];

  allScenes.forEach((scene) => {
    const elementCount = db.prepare('SELECT COUNT(*) AS c FROM scene_elements WHERE scene_id = ?').get(scene.id).c;
    const shotCount = db.prepare('SELECT COUNT(*) AS c FROM shots WHERE scene_id = ?').get(scene.id).c;
    const missing = [];
    if (elementCount === 0) missing.push('breakdown elements');
    if (shotCount === 0) missing.push('a shot list');

    if (missing.length === 0) {
      ready.push(scene);
    } else {
      excluded.push({
        scene_id: scene.id,
        scene_number: scene.scene_number,
        heading: scene.heading,
        reason: `Missing ${missing.join(' and ')}`,
      });
    }
  });

  return { ready, excluded };
}

// Greedily reorders a set of locations (already given in their preferred
// base order -- e.g. highest complexity first) so that locations sharing
// lead cast members end up adjacent, without disturbing the order when no
// lead cast is tagged at all. Chains forward from the first location,
// always continuing to whichever remaining location shares the most lead
// cast with the current one; ties fall back to the original base order so
// the result is identical to that base order when there's no cast signal.
function clusterLocationsByLeadCast(baseOrderKeys, sharedLeadCastCount) {
  if (baseOrderKeys.length <= 2) return baseOrderKeys;

  const baseIndex = new Map(baseOrderKeys.map((key, i) => [key, i]));
  const remaining = new Set(baseOrderKeys.slice(1));
  const result = [baseOrderKeys[0]];

  while (remaining.size > 0) {
    const current = result[result.length - 1];
    let best = null;
    let bestScore = -1;
    remaining.forEach((candidate) => {
      const score = sharedLeadCastCount(current, candidate);
      if (
        score > bestScore ||
        (score === bestScore && (best === null || baseIndex.get(candidate) < baseIndex.get(best)))
      ) {
        best = candidate;
        bestScore = score;
      }
    });
    result.push(best);
    remaining.delete(best);
  }

  return result;
}

function buildSchedulePreview(db, projectId, { pagesPerDay = 5, startDate = null, workDaysPerWeek = 5 } = {}) {
  const allScenes = db.prepare('SELECT * FROM scenes WHERE project_id = ? ORDER BY order_index, id').all(projectId);
  const { ready: scenes, excluded: excludedScenes } = readinessFilter(db, allScenes);
  const locations = db.prepare('SELECT * FROM locations WHERE project_id = ?').all(projectId);
  const locationById = new Map(locations.map((l) => [l.id, l]));

  const elementsByScene = new Map();
  scenes.forEach((s) => {
    elementsByScene.set(s.id, db.prepare('SELECT category, value FROM scene_elements WHERE scene_id = ?').all(s.id));
  });

  const complexityScore = (sceneId) =>
    (elementsByScene.get(sceneId) || []).reduce((sum, e) => sum + (COMPLEXITY_WEIGHT[e.category] || 0), 0);

  const hasCategory = (sceneId, category) => (elementsByScene.get(sceneId) || []).some((e) => e.category === category);

  // Lead cast (flagged in Cast & Crew) tagged on a scene, by character name.
  const leadCastNames = new Set(
    db
      .prepare("SELECT role FROM contacts WHERE project_id = ? AND department = 'cast' AND is_lead = 1")
      .all(projectId)
      .map((c) => c.role.trim().toUpperCase())
      .filter(Boolean)
  );
  const leadCastInScene = (sceneId) =>
    (elementsByScene.get(sceneId) || [])
      .filter((e) => e.category === 'cast' && leadCastNames.has(e.value.trim().toUpperCase()))
      .map((e) => e.value.trim().toUpperCase());

  // Rank locations: any-exterior locations first (weather buffer), then --
  // among locations tied on that -- cluster ones sharing lead cast together
  // so a lead actor's days fall close together, then by total complexity
  // (tackle the hardest setups earliest).
  const locationStats = new Map();
  const leadCastByLocation = new Map();
  scenes.forEach((s) => {
    const key = s.location_id ?? 'none';
    const stat = locationStats.get(key) || { hasExt: false, totalComplexity: 0 };
    if (s.int_ext === 'EXT' || s.int_ext === 'INT/EXT') stat.hasExt = true;
    stat.totalComplexity += complexityScore(s.id);
    locationStats.set(key, stat);

    const leadSet = leadCastByLocation.get(key) || new Set();
    leadCastInScene(s.id).forEach((name) => leadSet.add(name));
    leadCastByLocation.set(key, leadSet);
  });

  const sharedLeadCastCount = (keyA, keyB) => {
    const setA = leadCastByLocation.get(keyA) || new Set();
    const setB = leadCastByLocation.get(keyB) || new Set();
    let count = 0;
    setA.forEach((name) => {
      if (setB.has(name)) count += 1;
    });
    return count;
  };

  const baseOrder = [...locationStats.keys()].sort((a, b) => {
    const sa = locationStats.get(a);
    const sb = locationStats.get(b);
    if (sa.hasExt !== sb.hasExt) return sa.hasExt ? -1 : 1;
    return sb.totalComplexity - sa.totalComplexity;
  });
  const extKeys = baseOrder.filter((k) => locationStats.get(k).hasExt);
  const intKeys = baseOrder.filter((k) => !locationStats.get(k).hasExt);
  const finalOrder = [
    ...clusterLocationsByLeadCast(extKeys, sharedLeadCastCount),
    ...clusterLocationsByLeadCast(intKeys, sharedLeadCastCount),
  ];

  const locationRank = new Map();
  finalOrder.forEach((key, i) => locationRank.set(key, i));

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

  // Bin-pack into days: cap pages/day, never mix day/night or locations in one day
  // (a company move mid-day isn't something this heuristic attempts).
  const rawDays = [];
  let current = null;

  ordered.forEach((scene) => {
    const group = dayNightGroup(scene.day_night);
    const locKey = scene.location_id ?? 'none';
    const pages = Number(scene.page_count) || 0;
    const wouldOverflow = current && current.scenes.length > 0 && current.totalPages + pages > pagesPerDay;
    const mismatchedGroup = current && current.dnGroup !== group;
    const mismatchedLocation = current && current.locKey !== locKey;

    if (!current || wouldOverflow || mismatchedGroup || mismatchedLocation) {
      current = { scenes: [], totalPages: 0, dnGroup: group, locKey };
      rawDays.push(current);
    }

    current.scenes.push(scene);
    current.totalPages += pages;
  });

  // Within a day, animal-tagged scenes go first (early-call rule).
  rawDays.forEach((day) => {
    day.scenes.sort((a, b) => (hasCategory(a.id, 'animals') ? 0 : 1) - (hasCategory(b.id, 'animals') ? 0 : 1));
  });

  const days = rawDays.map((day, i) => {
    const locationId = day.locKey === 'none' ? null : day.locKey;
    const leadCastToday = new Set();
    day.scenes.forEach((scene) => leadCastInScene(scene.id).forEach((name) => leadCastToday.add(name)));

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
      location_id: locationId,
      location_name: locationId ? locationById.get(locationId)?.name || null : null,
      total_pages: Math.round(day.totalPages * 8) / 8,
      lead_cast: [...leadCastToday].sort(),
      scenes: sceneEntries,
    };
  });

  return { days: assignShootDates(days, startDate, workDaysPerWeek), excludedScenes };
}

function commitSchedule(db, projectId, days) {
  const insertDay = db.prepare(
    `INSERT INTO shoot_days (project_id, day_number, shoot_date, general_call_time, location_id) VALUES (?, ?, ?, ?, ?)`
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
        day.shoot_date || '',
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
