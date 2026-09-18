import { useEffect, useState } from 'react';
import { useOutletContext, useParams, Link } from 'react-router-dom';
import api from '../api.js';

export default function CallSheetPage() {
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
  const castNames = new Set();
  scenes.forEach((s) => s.elements.filter((e) => e.category === 'cast').forEach((e) => castNames.add(e.value)));

  return (
    <div>
      <div className="flex-row print-btn no-print">
        <Link to=".." className="btn btn-secondary">
          &larr; Back to Schedule
        </Link>
        <button className="btn" onClick={() => window.print()}>
          Print / Save PDF
        </button>
      </div>

      <div className="call-sheet">
        <div className="call-sheet-header">
          <div>
            <h1>{project.name}</h1>
            <div className="muted">Call Sheet &mdash; Day {day.day_number}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div>
              <strong>{day.shoot_date || 'Date TBD'}</strong>
            </div>
            <div className="muted">General Call: {day.general_call_time || 'TBD'}</div>
          </div>
        </div>

        <div className="call-sheet-grid">
          <div className="field">
            <label>Location</label>
            {location ? location.name : 'TBD'}
          </div>
          <div className="field">
            <label>Address</label>
            {location ? location.address || '—' : '—'}
          </div>
          <div className="field">
            <label>Weather</label>
            {day.weather || '—'}
          </div>
        </div>

        <div className="section-label">Scenes</div>
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Scene</th>
              <th>Description</th>
              <th>Cast</th>
              <th>Location</th>
            </tr>
          </thead>
          <tbody>
            {scenes.map((s) => (
              <tr key={s.id}>
                <td>{s.scheduled_time || '—'}</td>
                <td>
                  {s.scene_number}. {s.int_ext}/{s.day_night}
                </td>
                <td>{s.heading}</td>
                <td>{s.elements.filter((e) => e.category === 'cast').map((e) => e.value).join(', ') || '—'}</td>
                <td>{s.location ? s.location.name : '—'}</td>
              </tr>
            ))}
            {scenes.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  No scenes scheduled for this day.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="section-label">Cast &amp; Crew Call Times</div>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Department</th>
              <th>Phone</th>
              <th>Call Time</th>
              <th className="no-print"></th>
            </tr>
          </thead>
          <tbody>
            {calls.map((c) => (
              <tr key={c.id}>
                <td>
                  {c.name}
                  {castNames.has(c.name) && <span className="badge" style={{ marginLeft: 6 }}>cast</span>}
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
                  No one called yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <form className="inline-form no-print" onSubmit={handleAddCall}>
          <select value={contactToAdd} onChange={(e) => setContactToAdd(e.target.value)}>
            <option value="">Add cast/crew to this call sheet...</option>
            {availableContacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.department})
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn-secondary">
            Add
          </button>
        </form>
      </div>
    </div>
  );
}
