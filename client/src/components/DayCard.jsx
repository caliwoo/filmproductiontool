import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api.js';

export default function DayCard({
  day,
  dayNumber,
  assigned,
  locations,
  allScenes,
  onChange,
  onReloadDay,
  onDelete,
  draggingDayId,
  setDraggingDayId,
  moveDay,
  draggingScene,
  setDraggingScene,
  moveScene,
  dropIndex,
}) {
  const [sceneToAdd, setSceneToAdd] = useState('');
  const [error, setError] = useState('');

  const location = locations.find((l) => l.id === day.location_id);
  const assignedIds = new Set(assigned.map((s) => s.id));
  const available = allScenes.filter((s) => !assignedIds.has(s.id));

  async function updateField(field, value) {
    try {
      await api.put(`/shoot-days/${day.id}`, { [field]: value });
      onChange();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAssign(e) {
    e.preventDefault();
    if (!sceneToAdd) return;
    try {
      await api.post(`/shoot-days/${day.id}/scenes`, { scene_id: Number(sceneToAdd) });
      setSceneToAdd('');
      onReloadDay();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleUnassign(assignmentId) {
    await api.del(`/shoot-days/scenes/${assignmentId}`);
    onReloadDay();
  }

  function handleDayDragStart(e) {
    if (!e.target.closest('.drag-handle')) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.effectAllowed = 'move';
    setDraggingDayId(day.id);
  }

  function handleDayDragOver(e) {
    if (draggingDayId === null || draggingDayId === day.id) return;
    e.preventDefault();
  }

  function handleDayDrop(e) {
    if (draggingDayId === null || draggingDayId === day.id) return;
    e.preventDefault();
    moveDay(draggingDayId, dropIndex);
    setDraggingDayId(null);
  }

  function handleSceneDragStart(assignmentId) {
    return (e) => {
      if (!e.target.closest('.drag-handle')) {
        e.preventDefault();
        return;
      }
      e.stopPropagation();
      e.dataTransfer.effectAllowed = 'move';
      setDraggingScene({ fromDayId: day.id, assignmentId });
    };
  }

  function handleSceneDragOver(e) {
    if (!draggingScene) return;
    e.preventDefault();
    e.stopPropagation();
  }

  function handleSceneDropOnRow(rowIndex) {
    return (e) => {
      if (!draggingScene) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      const isAfter = e.clientY - rect.top > rect.height / 2;
      moveScene(draggingScene.fromDayId, day.id, draggingScene.assignmentId, rowIndex + (isAfter ? 1 : 0));
      setDraggingScene(null);
    };
  }

  function handleSceneDropAtEnd(e) {
    if (!draggingScene) return;
    e.preventDefault();
    moveScene(draggingScene.fromDayId, day.id, draggingScene.assignmentId, assigned.length);
    setDraggingScene(null);
  }

  return (
    <div
      className={`day-card ${draggingDayId === day.id ? 'dragging' : ''}`}
      onDragOver={handleDayDragOver}
      onDrop={handleDayDrop}
    >
      <div className="day-card-header" draggable onDragStart={handleDayDragStart} onDragEnd={() => setDraggingDayId(null)}>
        <div className="flex-row" style={{ alignItems: 'flex-start', gap: 10 }}>
          <span className="drag-handle" title="Drag to reorder days">
            ⠿
          </span>
          <div>
            <h3>Day {dayNumber}</h3>
            <div className="day-meta">
              {day.shoot_date || 'No date set'} &middot; Call {day.general_call_time || '—'}
              {location && <> &middot; {location.name}</>}
            </div>
          </div>
        </div>
        <div className="flex-row">
          <Link className="btn btn-secondary" to={`${day.id}/call-sheet`}>
            View Call Sheet
          </Link>
          <button className="icon-btn" onClick={() => onDelete(day.id)} title="Delete day">
            ✕
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="inline-form">
        <input
          type="date"
          defaultValue={day.shoot_date}
          onBlur={(e) => updateField('shoot_date', e.target.value)}
        />
        <input
          type="time"
          defaultValue={day.general_call_time}
          onBlur={(e) => updateField('general_call_time', e.target.value)}
        />
        <select
          defaultValue={day.location_id || ''}
          onChange={(e) => updateField('location_id', e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">No location</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <input
          placeholder="Weather"
          defaultValue={day.weather}
          onBlur={(e) => updateField('weather', e.target.value)}
        />
      </div>

      <div className="section-label">Scenes on this day</div>
      <div onDragOver={(e) => draggingScene && e.preventDefault()} onDrop={handleSceneDropAtEnd}>
        {assigned.map((scene, i) => (
          <div
            className={`assigned-scene-row ${
              draggingScene && draggingScene.assignmentId === scene.assignment_id ? 'dragging' : ''
            }`}
            key={scene.assignment_id}
            draggable
            onDragStart={handleSceneDragStart(scene.assignment_id)}
            onDragEnd={() => setDraggingScene(null)}
            onDragOver={handleSceneDragOver}
            onDrop={handleSceneDropOnRow(i)}
          >
            <span className="flex-row" style={{ gap: 8 }}>
              <span className="drag-handle" title="Drag to reorder, or drop on another day">
                ⠿
              </span>
              <span>
                {scene.scene_number}. {scene.int_ext} {scene.heading} - {scene.day_night}
                {scene.scheduled_time && <span className="muted"> &nbsp;@ {scene.scheduled_time}</span>}
              </span>
            </span>
            <button className="icon-btn" onClick={() => handleUnassign(scene.assignment_id)}>
              ✕
            </button>
          </div>
        ))}
        {assigned.length === 0 && <p className="muted">No scenes assigned yet.</p>}
      </div>

      <form className="inline-form" onSubmit={handleAssign}>
        <select value={sceneToAdd} onChange={(e) => setSceneToAdd(e.target.value)}>
          <option value="">Add a scene...</option>
          {available.map((s) => (
            <option key={s.id} value={s.id}>
              {s.scene_number}. {s.heading}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn-secondary">
          Assign
        </button>
      </form>
    </div>
  );
}
