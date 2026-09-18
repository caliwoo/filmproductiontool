import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../api.js';
import DayCard from '../components/DayCard.jsx';

export default function SchedulePage() {
  const { projectId } = useOutletContext();
  const [days, setDays] = useState([]);
  const [locations, setLocations] = useState([]);
  const [scenes, setScenes] = useState([]);
  const [error, setError] = useState('');

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

  async function handleDeleteDay(id) {
    if (!confirm('Delete this shoot day?')) return;
    await api.del(`/shoot-days/${id}`);
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
          <DayCard key={day.id} day={day} locations={locations} allScenes={scenes} onChange={load} onDelete={handleDeleteDay} />
        ))}
        {days.length === 0 && <p className="empty-state">No shoot days yet. Add your first one above.</p>}
      </div>
    </div>
  );
}
