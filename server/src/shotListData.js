const db = require('./db');

/**
 * Flattens every shot across every scene in a project into one list, joined
 * with each scene's location and cast/props tags, ordered the way the
 * scenes and shots are ordered in the Script Breakdown / Shot List.
 */
function getShotListRows(projectId) {
  const scenes = db.prepare('SELECT * FROM scenes WHERE project_id = ? ORDER BY order_index, id').all(projectId);

  const rows = [];
  scenes.forEach((scene) => {
    const location = scene.location_id
      ? db.prepare('SELECT * FROM locations WHERE id = ?').get(scene.location_id)
      : null;
    const elements = db.prepare('SELECT * FROM scene_elements WHERE scene_id = ?').all(scene.id);
    const cast = elements.filter((e) => e.category === 'cast').map((e) => e.value);
    const props = elements.filter((e) => e.category === 'props').map((e) => e.value);
    const shots = db.prepare('SELECT * FROM shots WHERE scene_id = ? ORDER BY order_index, id').all(scene.id);

    shots.forEach((shot) => {
      rows.push({
        scene_id: scene.id,
        scene_number: scene.scene_number,
        scene_heading: scene.heading,
        day_night: scene.day_night,
        location: location ? location.name : null,
        shot_id: shot.id,
        shot_number: shot.shot_number,
        description: shot.description,
        size: shot.size,
        angle: shot.angle,
        movement: shot.movement,
        equipment: shot.equipment,
        status: shot.status,
        cast,
        props,
      });
    });
  });

  return rows;
}

module.exports = { getShotListRows };
