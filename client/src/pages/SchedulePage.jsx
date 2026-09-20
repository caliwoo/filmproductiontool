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
  const [locations, setLocations] = useState([]);
  const [scenes, setScenes] = useState([]);
  const [error, setError] = useState('');
  const [dayToDelete, setDayToDelete] = useState(null);
  const [showBuildSchedule, setShowBuildSchedule] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draggingDayId, setDraggingDayId] = useState(null);
  const [draggingScene, setDraggingScene] = useState(null); // { fromDayId, assignmentId }

  function load() {
    Promise.all([
      api.get(`/shoot-days?projectId=${projectId}`),
      api.get(`/locations?projectId=${projectId}`),
      api.get(`/scenes?projectId=${projectId}`),
    ])
      .then(([dayRows, locationRows, sceneRows]) => {
        setDays(dayRows);
        setLocations(locationRows);
        setScenes(sceneRows);
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
            locations={locations}
            allScenes={scenes}
            onChange={load}
            onReloadDay={() => reloadDay(day.id)}
            onDelete={() => setDayToDelete(day)}
            draggingDayId={draggingDayId}
            setDraggingDayId={setDraggingDayId}
            moveDay={moveDay}
            draggingScene={draggingScene}
            setDraggingScene={setDraggingScene}
            moveScene={moveScene}
            dropIndex={index}
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
    </div>
  );
}
