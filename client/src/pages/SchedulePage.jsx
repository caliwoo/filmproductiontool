import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../api.js';
import DayCard from '../components/DayCard.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import BuildScheduleDialog from '../components/BuildScheduleDialog.jsx';

export default function SchedulePage() {
  const { projectId } = useOutletContext();
  const [days, setDays] = useState([]);
  const [assignmentsByDay, setAssignmentsByDay] = useState({});
  const [scenes, setScenes] = useState([]);
  const [castNumberByName, setCastNumberByName] = useState({});
  const [error, setError] = useState('');
  const [dayToDelete, setDayToDelete] = useState(null);
  const [showBuildSchedule, setShowBuildSchedule] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draggingDayId, setDraggingDayId] = useState(null);
  const [draggingScene, setDraggingScene] = useState(null); // { fromDayId, assignmentId }
  const [ghost, setGhost] = useState(null); // { label, x, y }

  function load() {
    Promise.all([
      api.get(`/shoot-days?projectId=${projectId}`),
      api.get(`/scenes?projectId=${projectId}`),
      api.get(`/contacts?projectId=${projectId}`),
    ])
      .then(([dayRows, sceneRows, contactRows]) => {
        setDays(dayRows);
        setScenes(sceneRows);

        // Stripboard-style Cast ID#: a compact stand-in for the full name,
        // numbered in the order each cast member was first introduced.
        const castMap = {};
        contactRows
          .filter((c) => c.department === 'cast')
          .sort((a, b) => a.id - b.id)
          .forEach((c, i) => {
            const key = (c.role || '').trim().toUpperCase();
            if (key) castMap[key] = i + 1;
          });
        setCastNumberByName(castMap);

        return Promise.all(dayRows.map((d) => api.get(`/shoot-days/${d.id}/scenes`))).then((perDay) => {
          const map = {};
          dayRows.forEach((d, i) => {
            map[d.id] = perDay[i];
          });
          setAssignmentsByDay(map);
          setDirty(false);
        });
      })
      .catch((err) => setError(err.message));
  }

  useEffect(load, [projectId]);

  async function reloadDay(dayId) {
    try {
      const rows = await api.get(`/shoot-days/${dayId}/scenes`);
      setAssignmentsByDay((prev) => ({ ...prev, [dayId]: rows }));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddDay() {
    try {
      await api.post('/shoot-days', { project_id: projectId });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function confirmDeleteDay() {
    await api.del(`/shoot-days/${dayToDelete.id}`);
    setDayToDelete(null);
    load();
  }

  function moveDay(fromDayId, toIndex) {
    setDays((prev) => {
      const fromIndex = prev.findIndex((d) => d.id === fromDayId);
      if (fromIndex === -1 || fromIndex === toIndex) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, moved);
      return next;
    });
    setDirty(true);
  }

  // toIndexRaw is the drop target's position in the ORIGINAL (pre-move) list
  // of the destination day -- adjusted below for the same-day case, where
  // removing the dragged item first shifts everything after it.
  function moveScene(fromDayId, toDayId, assignmentId, toIndexRaw) {
    setAssignmentsByDay((prev) => {
      const fromList = [...(prev[fromDayId] || [])];
      const fromIndex = fromList.findIndex((s) => s.assignment_id === assignmentId);
      if (fromIndex === -1) return prev;
      const [moved] = fromList.splice(fromIndex, 1);

      const toIndex = fromDayId === toDayId && fromIndex < toIndexRaw ? toIndexRaw - 1 : toIndexRaw;
      const toList = fromDayId === toDayId ? fromList : [...(prev[toDayId] || [])];
      toList.splice(Math.max(0, Math.min(toIndex, toList.length)), 0, moved);

      return { ...prev, [fromDayId]: fromList, [toDayId]: toList };
    });
    setDirty(true);
  }

  // Manual mouse-driven drag instead of native HTML5 drag-and-drop -- the
  // native drag/drop DOM events turn out to be unreliable to actually
  // initiate from a real mouse in some browsers/environments. This tracks
  // the drag with plain mousedown/mouseup and resolves the drop target from
  // the cursor position, which works everywhere a mouse does. A translucent
  // label follows the cursor the whole time, mimicking the native drag
  // image a browser would otherwise draw for you.
  function startDrag(kind, payload, label, x, y) {
    if (kind === 'day') setDraggingDayId(payload.dayId);
    else setDraggingScene(payload);
    setGhost({ label, x, y });
    document.body.classList.add('dnd-active');

    function onMove(e) {
      setGhost((g) => (g ? { ...g, x: e.clientX, y: e.clientY } : g));
    }

    function finish(e) {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', finish);
      document.body.classList.remove('dnd-active');
      setGhost(null);

      const el = document.elementFromPoint(e.clientX, e.clientY);
      const dayEl = el && el.closest('[data-day-card]');

      if (dayEl) {
        if (kind === 'day') {
          moveDay(payload.dayId, Number(dayEl.dataset.dayIndex));
        } else {
          const toDayId = Number(dayEl.dataset.dayId);
          const rowEl = el.closest('[data-scene-row]');
          let toIndex = Number.MAX_SAFE_INTEGER; // past the end; moveScene clamps it
          if (rowEl) {
            const rect = rowEl.getBoundingClientRect();
            const isAfter = e.clientY - rect.top > rect.height / 2;
            toIndex = Number(rowEl.dataset.rowIndex) + (isAfter ? 1 : 0);
          }
          moveScene(payload.fromDayId, toDayId, payload.assignmentId, toIndex);
        }
      }

      setDraggingDayId(null);
      setDraggingScene(null);
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', finish);
  }

  async function handleCommit() {
    setSaving(true);
    setError('');
    try {
      await api.post('/shoot-days/reorder-all', {
        days: days.map((d) => ({
          id: d.id,
          scene_assignment_ids: (assignmentsByDay[d.id] || []).map((s) => s.assignment_id),
        })),
      });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2>Schedule</h2>
        <div className="flex-row">
          <button className="btn btn-secondary" onClick={() => setShowBuildSchedule(true)}>
            ✨ Build Shooting Schedule
          </button>
          <button className="btn" onClick={handleAddDay}>
            + Add Shoot Day
          </button>
        </div>
      </div>
      {error && <div className="error-banner">{error}</div>}

      {dirty && (
        <div className="commit-bar">
          <span>Drag order changed &mdash; not saved yet.</span>
          <div className="flex-row">
            <button className="btn btn-secondary" onClick={load} disabled={saving}>
              Discard
            </button>
            <button className="btn" onClick={handleCommit} disabled={saving}>
              {saving ? 'Saving...' : 'Commit Changes'}
            </button>
          </div>
        </div>
      )}

      {showBuildSchedule && (
        <BuildScheduleDialog
          projectId={projectId}
          onClose={() => setShowBuildSchedule(false)}
          onApplied={() => {
            setShowBuildSchedule(false);
            load();
          }}
        />
      )}

      <div className="day-list">
        {days.map((day, index) => (
          <DayCard
            key={day.id}
            day={day}
            dayNumber={index + 1}
            assigned={assignmentsByDay[day.id] || []}
            allScenes={scenes}
            castNumberByName={castNumberByName}
            onChange={load}
            onReloadDay={() => reloadDay(day.id)}
            onDelete={() => setDayToDelete(day)}
            draggingDayId={draggingDayId}
            draggingScene={draggingScene}
            onStartDayDrag={(x, y) => startDrag('day', { dayId: day.id }, `Day ${index + 1}`, x, y)}
            onStartSceneDrag={(assignmentId, label, x, y) =>
              startDrag('scene', { fromDayId: day.id, assignmentId }, label, x, y)
            }
            dayIndex={index}
          />
        ))}
        {days.length === 0 && <p className="empty-state">No shoot days yet. Add your first one above.</p>}
      </div>

      {dayToDelete && (
        <ConfirmDialog
          title="Delete shoot day?"
          message={`This will permanently delete Day ${dayToDelete.day_number} and unassign its scenes and crew calls. This can't be undone.`}
          confirmLabel="Delete Day"
          onConfirm={confirmDeleteDay}
          onCancel={() => setDayToDelete(null)}
        />
      )}

      {ghost && (
        <div className="drag-ghost" style={{ left: ghost.x, top: ghost.y }}>
          {ghost.label}
        </div>
      )}
    </div>
  );
}
