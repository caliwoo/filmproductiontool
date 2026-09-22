import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../api.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { locationLabel } from '../locationLabel.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

export default function LocationsPage() {
  const { t } = useLanguage();
  const { projectId } = useOutletContext();
  const [locations, setLocations] = useState([]);
  const [scenes, setScenes] = useState([]);
  const [form, setForm] = useState({ name: '', address: '', notes: '' });
  const [error, setError] = useState('');
  const [locationToDelete, setLocationToDelete] = useState(null);

  function load() {
    Promise.all([api.get(`/locations?projectId=${projectId}`), api.get(`/scenes?projectId=${projectId}`)])
      .then(([locationRows, sceneRows]) => {
        setLocations(locationRows);
        setScenes(sceneRows);
      })
      .catch((err) => setError(err.message));
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

  // Scenes already come back in script order (order_index, id), so grouping
  // preserves that order rather than sorting scene_number as text.
  const sceneNumbersByLocation = new Map();
  scenes.forEach((s) => {
    if (!s.location_id) return;
    const list = sceneNumbersByLocation.get(s.location_id) || [];
    list.push(s.scene_number);
    sceneNumbersByLocation.set(s.location_id, list);
  });

  return (
    <div>
      <div className="page-header">
        <h2>{t('locationsPage.title')}</h2>
      </div>
      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>{t('locationsPage.columns.name')}</th>
              <th title={t('locationsPage.columns.sceneHeadingTooltip')}>
                {t('locationsPage.columns.sceneHeading')}
              </th>
              <th>{t('locationsPage.columns.address')}</th>
              <th>{t('locationsPage.columns.notes')}</th>
              <th title={t('locationsPage.columns.scenesTooltip')}>{t('locationsPage.columns.scenes')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {locations.map((l) => (
              <tr key={l.id}>
                <td>
                  <input
                    defaultValue={l.name}
                    placeholder={t('locationsPage.namePlaceholder')}
                    onBlur={(e) => e.target.value !== l.name && updateLocation(l.id, 'name', e.target.value)}
                  />
                </td>
                <td className="muted">{l.scene_heading || '—'}</td>
                <td>
                  <input
                    defaultValue={l.address}
                    placeholder={t('locationsPage.addressPlaceholder')}
                    onBlur={(e) => e.target.value !== l.address && updateLocation(l.id, 'address', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    defaultValue={l.notes}
                    placeholder={t('locationsPage.notesPlaceholder')}
                    onBlur={(e) => e.target.value !== l.notes && updateLocation(l.id, 'notes', e.target.value)}
                  />
                </td>
                <td className="muted" style={{ fontSize: 13 }}>
                  {(sceneNumbersByLocation.get(l.id) || []).join(', ') || '—'}
                </td>
                <td>
                  <button className="icon-btn" onClick={() => setLocationToDelete(l)} title={t('common.delete')}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            {locations.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  {t('locationsPage.noLocationsYet')}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <form className="inline-form" onSubmit={handleAdd}>
          <input
            placeholder={t('locationsPage.addNamePlaceholder')}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            placeholder={t('locationsPage.addressPlaceholder')}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
          <input
            placeholder={t('locationsPage.notesPlaceholder')}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          <button type="submit" className="btn">
            {t('locationsPage.addButton')}
          </button>
        </form>
      </div>

      {locationToDelete && (
        <ConfirmDialog
          title={t('locationsPage.deleteLocationTitle')}
          message={t('locationsPage.deleteLocationMessage', { label: locationLabel(locationToDelete) })}
          confirmLabel={t('locationsPage.deleteLocationConfirm')}
          onConfirm={confirmDelete}
          onCancel={() => setLocationToDelete(null)}
        />
      )}
    </div>
  );
}
