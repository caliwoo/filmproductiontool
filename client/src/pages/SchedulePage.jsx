import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../api.js';
import DayCard from '../components/DayCard.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

export default function SchedulePage() {
  const { projectId } = useOutletContext();
  const [days, setDays] = useState([]);
  const [locations, setLocations] = useState([]);
  const [scenes, setScenes] = useState([]);
  const [error, setError] = useState('');
  const [dayToDelete, setDayToDelete] = useState(null);

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
      })
      .catch((err) => setError(err.message));
  }

  useEffect(load, [projectId]);

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

  return (
    <div>
      <div className="page-header">
        <h2>Schedule</h2>
        <button className="btn" onClick={handleAddDay}>
          + Add Shoot Day
        </button>
      </div>
      {error && <div className="error-banner">{error}</div>}

      <div className="day-list">
        {days.map((day) => (
          <DayCard
            key={day.id}
            day={day}
            locations={locations}
            allScenes={scenes}
            onChange={load}
            onDelete={() => setDayToDelete(day)}
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
