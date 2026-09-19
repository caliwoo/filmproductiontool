import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../api.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

const DEPARTMENTS = ['cast', 'crew', 'production', 'vendor'];

export default function ContactsPage() {
  const { projectId } = useOutletContext();
  const [contacts, setContacts] = useState([]);
  const [form, setForm] = useState({ name: '', role: '', department: 'crew', phone: '', email: '' });
  const [error, setError] = useState('');
  const [contactToDelete, setContactToDelete] = useState(null);

  function load() {
    api.get(`/contacts?projectId=${projectId}`).then(setContacts).catch((err) => setError(err.message));
  }

  useEffect(load, [projectId]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.name.trim() && !form.role.trim()) return;
    try {
      await api.post('/contacts', { ...form, project_id: projectId });
      setForm({ name: '', role: '', department: 'crew', phone: '', email: '' });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function confirmDelete() {
    await api.del(`/contacts/${contactToDelete.id}`);
    setContactToDelete(null);
    load();
  }

  async function updateContact(id, field, value) {
    try {
      await api.put(`/contacts/${id}`, { [field]: value });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2>Cast &amp; Crew</h2>
      </div>
      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>{'Name'}</th>
              <th>{'Role / Character'}</th>
              <th>Department</th>
              <th>Phone</th>
              <th>Email</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => (
              <tr key={c.id}>
                <td>
                  <input
                    defaultValue={c.name}
                    placeholder={c.department === 'cast' ? 'Actor name (once cast)' : 'Name'}
                    onBlur={(e) => e.target.value !== c.name && updateContact(c.id, 'name', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    defaultValue={c.role}
                    placeholder={c.department === 'cast' ? 'Character' : 'Role'}
                    onBlur={(e) => e.target.value !== c.role && updateContact(c.id, 'role', e.target.value)}
                  />
                </td>
                <td>
                  <select value={c.department} onChange={(e) => updateContact(c.id, 'department', e.target.value)}>
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    defaultValue={c.phone}
                    placeholder="Phone"
                    onBlur={(e) => e.target.value !== c.phone && updateContact(c.id, 'phone', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    defaultValue={c.email}
                    placeholder="Email"
                    onBlur={(e) => e.target.value !== c.email && updateContact(c.id, 'email', e.target.value)}
                  />
                </td>
                <td>
                  <button className="icon-btn" onClick={() => setContactToDelete(c)} title="Delete">
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            {contacts.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  No contacts yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <form className="inline-form" onSubmit={handleAdd}>
          <input
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            placeholder="Role (e.g. Gaffer)"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          />
          <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <input
            placeholder="Phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <input
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <button type="submit" className="btn">
            Add
          </button>
        </form>
      </div>

      {contactToDelete && (
        <ConfirmDialog
          title="Delete contact?"
          message={`This will permanently remove "${contactToDelete.name || contactToDelete.role || 'this entry'}" from this project's cast & crew, including any call times set for them.`}
          confirmLabel="Delete Contact"
          onConfirm={confirmDelete}
          onCancel={() => setContactToDelete(null)}
        />
      )}
    </div>
  );
}
