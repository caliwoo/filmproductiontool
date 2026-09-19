import { useEffect, useState } from 'react';
import api from '../api.js';
import AiShotDialog from './AiShotDialog.jsx';

const SIZES = ['WS', 'MS', 'CU', 'ECU', 'OTS', 'POV', '2-Shot', 'Insert'];

const EMPTY_FORM = {
  shot_number: '',
  size: 'MS',
  angle: '',
  movement: '',
  subject: '',
  lens: '',
  spatial_composition: '',
  setup_notes: '',
  description: '',
  equipment: '',
};

export default function ShotList({ sceneId }) {
  const [shots, setShots] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
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
      setForm({ ...EMPTY_FORM, shot_number: String(shots.length + 2) });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function updateShotField(shot, field, value) {
    await api.put(`/shots/${shot.id}`, { [field]: value });
    load();
  }

  async function toggleStatus(shot) {
    await updateShotField(shot, 'status', shot.status === 'shot' ? 'not_shot' : 'shot');
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
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Size</th>
                <th>Angle</th>
                <th>Movement</th>
                <th>Subject</th>
                <th>Lens</th>
                <th>Description</th>
                <th>Composition</th>
                <th>Equipment</th>
                <th>Setup Notes</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {shots.map((shot) => (
                <tr key={shot.id}>
                  <td>
                    <input
                      defaultValue={shot.shot_number}
                      onBlur={(e) => e.target.value !== shot.shot_number && updateShotField(shot, 'shot_number', e.target.value)}
                    />
                  </td>
                  <td>
                    <select defaultValue={shot.size} onChange={(e) => updateShotField(shot, 'size', e.target.value)}>
                      {SIZES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      defaultValue={shot.angle}
                      onBlur={(e) => e.target.value !== shot.angle && updateShotField(shot, 'angle', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      defaultValue={shot.movement}
                      onBlur={(e) => e.target.value !== shot.movement && updateShotField(shot, 'movement', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      placeholder="e.g. JANE"
                      defaultValue={shot.subject}
                      onBlur={(e) => e.target.value !== shot.subject && updateShotField(shot, 'subject', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      placeholder="e.g. 35mm"
                      defaultValue={shot.lens}
                      onBlur={(e) => e.target.value !== shot.lens && updateShotField(shot, 'lens', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      style={{ minWidth: 160 }}
                      defaultValue={shot.description}
                      onBlur={(e) => e.target.value !== shot.description && updateShotField(shot, 'description', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      placeholder="FG/MG/BG"
                      style={{ minWidth: 140 }}
                      defaultValue={shot.spatial_composition}
                      onBlur={(e) =>
                        e.target.value !== shot.spatial_composition && updateShotField(shot, 'spatial_composition', e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      defaultValue={shot.equipment}
                      onBlur={(e) => e.target.value !== shot.equipment && updateShotField(shot, 'equipment', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      placeholder="Gear / lighting / blocking"
                      style={{ minWidth: 140 }}
                      defaultValue={shot.setup_notes}
                      onBlur={(e) => e.target.value !== shot.setup_notes && updateShotField(shot, 'setup_notes', e.target.value)}
                    />
                  </td>
                  <td>
                    <button
                      className={`badge ${shot.status}`}
                      style={{ border: 'none', cursor: 'pointer' }}
                      onClick={() => toggleStatus(shot)}
                    >
                      {shot.status === 'shot' ? 'Shot' : 'Not shot'}
                    </button>
                  </td>
                  <td>
                    <button className="icon-btn" onClick={() => handleDelete(shot.id)} title="Delete">
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form className="inline-form" onSubmit={handleAdd}>
        <input
          placeholder="Shot #"
          title="Inserting a shot between existing ones? Use a letter suffix (e.g. 3A) instead of renumbering."
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
          placeholder="Subject"
          value={form.subject}
          onChange={(e) => setForm({ ...form, subject: e.target.value })}
        />
        <input placeholder="Lens" value={form.lens} onChange={(e) => setForm({ ...form, lens: e.target.value })} />
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
        <input
          placeholder="Setup notes"
          value={form.setup_notes}
          onChange={(e) => setForm({ ...form, setup_notes: e.target.value })}
        />
        <button type="submit" className="btn">
          Add Shot
        </button>
      </form>
    </div>
  );
}
