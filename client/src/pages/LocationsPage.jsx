import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../api.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

export default function LocationsPage() {
  const { projectId } = useOutletContext();
  const [locations, setLocations] = useState([]);
  const [form, setForm] = useState({ name: '', address: '', notes: '' });
  const [error, setError] = useState('');
  const [locationToDelete, setLocationToDelete] = useState(null);

  function load() {
    api.get(`/locations?projectId=${projectId}`).then(setLocations).catch((err) => setError(err.message));
  }

  useEffect(load, [projectId]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      await api.post('/locations', { ...form, project_id: projectId });
      setForm({ name: '', address: '', notes: '' });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function confirmDelete() {
    await api.del(`/locations/${locationToDelete.id}`);
    setLocationToDelete(null);
    load();
  }

  async function updateLocation(id, field, value) {
    try {
      await api.put(`/locations/${id}`, { [field]: value });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2>Locations</h2>
      </div>
      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Address</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {locations.map((l) => (
              <tr key={l.id}>
                <td>
                  <input
                    defaultValue={l.name}
                    placeholder="Name"
                    onBlur={(e) => e.target.value !== l.name && updateLocation(l.id, 'name', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    defaultValue={l.address}
                    placeholder="Address"
                    onBlur={(e) => e.target.value !== l.address && updateLocation(l.id, 'address', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    defaultValue={l.notes}
                    placeholder="Notes"
                    onBlur={(e) => e.target.value !== l.notes && updateLocation(l.id, 'notes', e.target.value)}
                  />
                </td>
                <td>
                  <button className="icon-btn" onClick={() => setLocationToDelete(l)} title="Delete">
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            {locations.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  No locations yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <form className="inline-form" onSubmit={handleAdd}>
          <input
            placeholder="Name (e.g. Main St Diner)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            placeholder="Address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
          <input
            placeholder="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          <button type="submit" className="btn">
            Add
          </button>
        </form>
      </div>

      {locationToDelete && (
        <ConfirmDialog
          title="Delete location?"
          message={`This will permanently remove "${locationToDelete.name}" from this project. Any scenes or shoot days using it will be left with no location set.`}
          confirmLabel="Delete Location"
          onConfirm={confirmDelete}
          onCancel={() => setLocationToDelete(null)}
        />
      )}
    </div>
  );
}
