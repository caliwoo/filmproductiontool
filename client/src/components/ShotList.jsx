import { useEffect, useState } from 'react';
import api from '../api.js';
import AiShotDialog from './AiShotDialog.jsx';

const SIZES = ['WS', 'MS', 'CU', 'ECU', 'OTS', 'POV', '2-Shot'];

export default function ShotList({ sceneId }) {
  const [shots, setShots] = useState([]);
  const [form, setForm] = useState({ shot_number: '', size: 'MS', angle: '', movement: '', description: '', equipment: '' });
  const [error, setError] = useState('');
  const [showAiShots, setShowAiShots] = useState(false);

  function load() {
    api.get(`/shots?sceneId=${sceneId}`).then(setShots).catch((err) => setError(err.message));
  }

  useEffect(load, [sceneId]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.shot_number.trim()) return;
    try {
      await api.post('/shots', { ...form, scene_id: sceneId });
      setForm({ shot_number: '', size: 'MS', angle: '', movement: '', description: '', equipment: '' });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleStatus(shot) {
    await api.put(`/shots/${shot.id}`, { status: shot.status === 'shot' ? 'not_shot' : 'shot' });
    load();
  }

  async function handleDelete(id) {
    await api.del(`/shots/${id}`);
    load();
  }

  return (
    <div>
      <div className="section-label flex-row" style={{ justifyContent: 'space-between' }}>
        <span>Shot List</span>
        <button
          className="btn btn-secondary"
          onClick={() => setShowAiShots(true)}
          style={{ fontWeight: 600, textTransform: 'none', letterSpacing: 'normal', fontSize: 13 }}
        >
          ✨ AI Suggest Shots
        </button>
      </div>

      {showAiShots && (
        <AiShotDialog
          sceneId={sceneId}
          onClose={() => setShowAiShots(false)}
          onCommitted={() => {
            setShowAiShots(false);
            load();
          }}
        />
      )}

      {error && <div className="error-banner">{error}</div>}

      {shots.length > 0 && (
        <div>
          <div className="shot-row header">
            <span>#</span>
            <span>Size</span>
            <span>Angle</span>
            <span>Movement</span>
            <span>Description</span>
            <span>Equipment</span>
            <span>Status</span>
            <span></span>
          </div>
          {shots.map((shot) => (
            <div className="shot-row" key={shot.id}>
              <span>{shot.shot_number}</span>
              <span>{shot.size}</span>
              <span>{shot.angle}</span>
              <span>{shot.movement}</span>
              <span>{shot.description}</span>
              <span>{shot.equipment}</span>
              <span>
                <button
                  className={`badge ${shot.status}`}
                  style={{ border: 'none', cursor: 'pointer' }}
                  onClick={() => toggleStatus(shot)}
                >
                  {shot.status === 'shot' ? 'Shot' : 'Not shot'}
                </button>
              </span>
              <button className="icon-btn" onClick={() => handleDelete(shot.id)} title="Delete">
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <form className="inline-form" onSubmit={handleAdd}>
        <input
          placeholder="Shot #"
          style={{ flex: '0 0 70px' }}
          value={form.shot_number}
          onChange={(e) => setForm({ ...form, shot_number: e.target.value })}
        />
        <select value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })}>
          {SIZES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          placeholder="Angle"
          value={form.angle}
          onChange={(e) => setForm({ ...form, angle: e.target.value })}
        />
        <input
          placeholder="Movement"
          value={form.movement}
          onChange={(e) => setForm({ ...form, movement: e.target.value })}
        />
        <input
          placeholder="Description"
          style={{ flex: 2 }}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <input
          placeholder="Equipment"
          value={form.equipment}
          onChange={(e) => setForm({ ...form, equipment: e.target.value })}
        />
        <button type="submit" className="btn">
          Add Shot
        </button>
      </form>
    </div>
  );
}
