import { Fragment, useEffect, useState } from 'react';
import { useOutletContext, useParams, Link } from 'react-router-dom';
import api from '../api.js';
import { locationLabel } from '../locationLabel.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

export default function CallSheetPage() {
  const { t } = useLanguage();
  const { projectId } = useOutletContext();
  const { dayId } = useParams();
  const [data, setData] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [contactToAdd, setContactToAdd] = useState('');
  const [error, setError] = useState('');

  function load() {
    Promise.all([api.get(`/shoot-days/${dayId}/call-sheet`), api.get(`/contacts?projectId=${projectId}`)])
      .then(([sheet, contactRows]) => {
        setData(sheet);
        setContacts(contactRows);
      })
      .catch((err) => setError(err.message));
  }

  useEffect(load, [dayId, projectId]);

  async function handleAddCall(e) {
    e.preventDefault();
    if (!contactToAdd) return;
    await api.put(`/shoot-days/${dayId}/calls/${contactToAdd}`, { call_time: data.day.general_call_time || '' });
    setContactToAdd('');
    load();
  }

  async function updateCallTime(contactId, call_time) {
    await api.put(`/shoot-days/${dayId}/calls/${contactId}`, { call_time });
    load();
  }

  async function removeCall(contactId) {
    await api.del(`/shoot-days/${dayId}/calls/${contactId}`);
    load();
  }

  if (error) return <div className="error-banner">{error}</div>;
  if (!data) return <p className="muted">Loading...</p>;

  const { project, day, location, scenes, calls } = data;
  const calledContactIds = new Set(calls.map((c) => c.id));
  const availableContacts = contacts.filter((c) => !calledContactIds.has(c.id));

  return (
    <div>
      <div className="flex-row print-btn no-print">
        <Link to=".." className="btn btn-secondary">
          {t('callSheetPage.backToSchedule')}
        </Link>
        <button className="btn" onClick={() => window.print()}>
          {t('callSheetPage.printSavePdf')}
        </button>
      </div>

      <div className="call-sheet">
        <div className="call-sheet-header">
          <div>
            <h1>{project.name}</h1>
            <div className="muted">{t('callSheetPage.callSheetDayLabel', { number: day.day_number })}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div>
              <strong>{day.shoot_date || t('callSheetPage.dateTBD')}</strong>
            </div>
            <div className="muted">{t('callSheetPage.generalCall', { time: day.general_call_time || t('callSheetPage.tbd') })}</div>
          </div>
        </div>

        <div className="call-sheet-grid">
          <div className="field">
            <label>{t('callSheetPage.location')}</label>
            {location ? locationLabel(location) : t('callSheetPage.tbd')}
          </div>
          <div className="field">
            <label>{t('callSheetPage.address')}</label>
            {location ? location.address || '—' : '—'}
          </div>
          <div className="field">
            <label>{t('callSheetPage.weather')}</label>
            {day.weather || '—'}
          </div>
        </div>

        <div className="section-label">{t('callSheetPage.scenesSectionLabel')}</div>
        <table>
          <thead>
            <tr>
              <th>{t('callSheetPage.columns.time')}</th>
              <th>{t('callSheetPage.columns.scene')}</th>
              <th>{t('callSheetPage.columns.description')}</th>
              <th>{t('callSheetPage.columns.cast')}</th>
              <th>{t('callSheetPage.columns.location')}</th>
            </tr>
          </thead>
          <tbody>
            {scenes.map((s, i) => {
              // The Location/Address box above already covers the day's first
              // scene(s) -- a day can now span more than one location, so a
              // fresh Location/Address row is inserted right above the first
              // scene shot at each *subsequent* location, ahead of where the
              // company actually moves, rather than only ever showing one
              // location for the whole day.
              const prevLocationId = i > 0 ? scenes[i - 1].location_id : day.location_id;
              const locationChanged = s.location_id !== prevLocationId;
              return (
                <Fragment key={s.id}>
                  {locationChanged && s.location && (
                    <tr className="call-sheet-location-change">
                      <td colSpan={5}>
                        <strong>{t('callSheetPage.locationLabel')}</strong> {locationLabel(s.location)}
                        {s.location.address && (
                          <>
                            {' '}
                            &middot; <strong>{t('callSheetPage.addressLabel')}</strong> {s.location.address}
                          </>
                        )}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td>{s.scheduled_time || '—'}</td>
                    <td>
                      {s.scene_number}. {s.int_ext}/{s.day_night}
                    </td>
                    <td>{s.heading}</td>
                    <td>{s.elements.filter((e) => e.category === 'cast').map((e) => e.value).join(', ') || '—'}</td>
                    <td>{s.location ? locationLabel(s.location) : '—'}</td>
                  </tr>
                </Fragment>
              );
            })}
            {scenes.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  {t('callSheetPage.noScenesScheduled')}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="section-label">{t('callSheetPage.castCrewCallTimesLabel')}</div>
        <table>
          <thead>
            <tr>
              <th>{t('callSheetPage.columns2.name')}</th>
              <th>{t('callSheetPage.columns2.role')}</th>
              <th>{t('callSheetPage.columns2.department')}</th>
              <th>{t('callSheetPage.columns2.phone')}</th>
              <th>{t('callSheetPage.columns2.callTime')}</th>
              <th className="no-print"></th>
            </tr>
          </thead>
          <tbody>
            {calls.map((c) => (
              <tr key={c.id}>
                <td>
                  {c.name || <span className="muted">{c.role ? t('callSheetPage.uncast', { role: c.role }) : t('callSheetPage.unnamed')}</span>}
                  {c.department === 'cast' && (
                    <span className="badge" style={{ marginLeft: 6 }}>
                      cast
                    </span>
                  )}
                </td>
                <td>{c.role}</td>
                <td>{c.department}</td>
                <td>{c.phone}</td>
                <td>
                  <input
                    type="time"
                    defaultValue={c.call_time}
                    onBlur={(e) => updateCallTime(c.id, e.target.value)}
                    style={{ width: 110 }}
                  />
                </td>
                <td className="no-print">
                  <button className="icon-btn" onClick={() => removeCall(c.id)}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            {calls.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  {t('callSheetPage.noOneCalledYet')}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <form className="inline-form no-print" onSubmit={handleAddCall}>
          <select value={contactToAdd} onChange={(e) => setContactToAdd(e.target.value)}>
            <option value="">{t('callSheetPage.addCallPlaceholderOption')}</option>
            {availableContacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name || c.role || t('callSheetPage.unnamed')} ({c.department})
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn-secondary">
            {t('callSheetPage.addButton')}
          </button>
        </form>
      </div>
    </div>
  );
}
