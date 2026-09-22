import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../api.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { castNumbersByRole } from '../castId.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

const DEPARTMENTS = ['cast', 'crew', 'production', 'vendor'];

export default function ContactsPage() {
  const { t } = useLanguage();
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

  // Same Cast ID# shown on Schedule stripboard rows and call sheets, so a
  // character's number here matches everywhere else it appears.
  const castNumbers = castNumbersByRole(contacts);

  return (
    <div>
      <div className="page-header">
        <h2>{t('contactsPage.title')}</h2>
      </div>
      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>{t('contactsPage.columns.name')}</th>
              <th title={t('contactsPage.columns.castIdTooltip')}>{t('contactsPage.columns.castId')}</th>
              <th>{t('contactsPage.columns.roleCharacter')}</th>
              <th>{t('contactsPage.columns.department')}</th>
              <th title={t('contactsPage.columns.leadTooltip')}>{t('contactsPage.columns.lead')}</th>
              <th>{t('contactsPage.columns.phone')}</th>
              <th>{t('contactsPage.columns.email')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => (
              <tr key={c.id}>
                <td>
                  <input
                    defaultValue={c.name}
                    placeholder={c.department === 'cast' ? t('contactsPage.placeholders.actorName') : t('contactsPage.placeholders.name')}
                    onBlur={(e) => e.target.value !== c.name && updateContact(c.id, 'name', e.target.value)}
                  />
                </td>
                <td className="muted" style={{ textAlign: 'center' }}>
                  {c.department === 'cast' ? castNumbers[(c.role || '').trim().toUpperCase()] || '—' : '—'}
                </td>
                <td>
                  <input
                    defaultValue={c.role}
                    placeholder={c.department === 'cast' ? t('contactsPage.placeholders.character') : t('contactsPage.placeholders.role')}
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
                <td style={{ textAlign: 'center' }}>
                  {c.department === 'cast' ? (
                    <input
                      type="checkbox"
                      checked={!!c.is_lead}
                      title={t('contactsPage.leadCheckboxTooltip')}
                      onChange={(e) => updateContact(c.id, 'is_lead', e.target.checked)}
                    />
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>
                  <input
                    defaultValue={c.phone}
                    placeholder={t('contactsPage.placeholders.phone')}
                    onBlur={(e) => e.target.value !== c.phone && updateContact(c.id, 'phone', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    defaultValue={c.email}
                    placeholder={t('contactsPage.placeholders.email')}
                    onBlur={(e) => e.target.value !== c.email && updateContact(c.id, 'email', e.target.value)}
                  />
                </td>
                <td>
                  <button className="icon-btn" onClick={() => setContactToDelete(c)} title={t('common.delete')}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            {contacts.length === 0 && (
              <tr>
                <td colSpan={8} className="muted">
                  {t('contactsPage.noContactsYet')}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <form className="inline-form" onSubmit={handleAdd}>
          <input
            placeholder={t('contactsPage.placeholders.name')}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            placeholder={t('contactsPage.placeholders.rolePrompt')}
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
            placeholder={t('contactsPage.placeholders.phone')}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <input
            placeholder={t('contactsPage.placeholders.email')}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <button type="submit" className="btn">
            {t('contactsPage.addButton')}
          </button>
        </form>
      </div>

      {contactToDelete && (
        <ConfirmDialog
          title={t('contactsPage.deleteContactTitle')}
          message={t('contactsPage.deleteContactMessage', {
            label: contactToDelete.name || contactToDelete.role || 'this entry',
          })}
          confirmLabel={t('contactsPage.deleteContactConfirm')}
          onConfirm={confirmDelete}
          onCancel={() => setContactToDelete(null)}
        />
      )}
    </div>
  );
}
