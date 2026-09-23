import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../api.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { castNumbersByRole } from '../castId.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

const DEPARTMENTS = ['cast', 'camera', 'grip', 'sound', 'art', 'production'];

function LeadStar({ filled }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill={filled ? 'var(--accent)' : 'none'}
      stroke={filled ? 'var(--accent)' : 'var(--text-muted)'}
      strokeWidth="1.7"
      strokeLinejoin="round"
    >
      <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
    </svg>
  );
}

export default function ContactsPage() {
  const { t } = useLanguage();
  const { projectId } = useOutletContext();
  const [contacts, setContacts] = useState([]);
  const [form, setForm] = useState({ name: '', role: '', department: 'camera', phone: '', email: '' });
  const [filter, setFilter] = useState('all');
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
      setForm({ name: '', role: '', department: form.department, phone: '', email: '' });
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

  const castCount = contacts.filter((c) => c.department === 'cast').length;
  const crewCount = contacts.length - castCount;
  const shown = contacts.filter((c) => filter === 'all' || (filter === 'cast' ? c.department === 'cast' : c.department !== 'cast'));

  const filters = [
    ['all', t('contactsPage.filterAll'), contacts.length],
    ['cast', t('contactsPage.filterCast'), castCount],
    ['crew', t('contactsPage.filterCrew'), crewCount],
  ];

  function departmentSelect(value, onChange, extraProps = {}) {
    return (
      <select value={value} onChange={onChange} {...extraProps}>
        {DEPARTMENTS.map((d) => (
          <option key={d} value={d}>
            {t(`contactsPage.departments.${d}`)}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>{t('contactsPage.title')}</h2>
          <span className="page-header-meta">{t('contactsPage.meta', { cast: castCount, crew: crewCount })}</span>
        </div>
        <div className="segmented">
          {filters.map(([key, label, count]) => (
            <button key={key} type="button" className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>
              {label}
              <span className="count">{count}</span>
            </button>
          ))}
        </div>
      </div>
      {error && <div className="error-banner">{error}</div>}

      <div className="cast-table-wrap">
        <div className="cast-table-row cast-table-header">
          <span>{t('contactsPage.columns.id')}</span>
          <span>{t('contactsPage.columns.role')}</span>
          <span>{t('contactsPage.columns.name')}</span>
          <span>{t('contactsPage.columns.department')}</span>
          <span style={{ textAlign: 'center' }}>{t('contactsPage.columns.lead')}</span>
          <span>{t('contactsPage.columns.phone')}</span>
          <span>{t('contactsPage.columns.email')}</span>
          <span></span>
        </div>
        {shown.map((c) => (
          <div className="cast-table-row cast-table" key={c.id}>
            <span className="cast-id-badge">{c.department === 'cast' ? castNumbers[(c.role || '').trim().toUpperCase()] || '—' : '—'}</span>
            <input
              defaultValue={c.role}
              placeholder={c.department === 'cast' ? t('contactsPage.placeholders.character') : t('contactsPage.placeholders.role')}
              style={{ fontWeight: 600 }}
              onBlur={(e) => e.target.value !== c.role && updateContact(c.id, 'role', e.target.value)}
            />
            <input
              defaultValue={c.name}
              placeholder={c.department === 'cast' ? t('contactsPage.placeholders.actorName') : t('contactsPage.placeholders.name')}
              onBlur={(e) => e.target.value !== c.name && updateContact(c.id, 'name', e.target.value)}
            />
            {departmentSelect(c.department, (e) => updateContact(c.id, 'department', e.target.value))}
            <button
              type="button"
              className="lead-star"
              style={{ justifySelf: 'center' }}
              title={t('contactsPage.leadCheckboxTooltip')}
              onClick={() => updateContact(c.id, 'is_lead', !c.is_lead)}
            >
              <LeadStar filled={!!c.is_lead} />
            </button>
            <input
              defaultValue={c.phone}
              placeholder={t('contactsPage.placeholders.phone')}
              onBlur={(e) => e.target.value !== c.phone && updateContact(c.id, 'phone', e.target.value)}
            />
            <input
              defaultValue={c.email}
              placeholder={t('contactsPage.placeholders.email')}
              onBlur={(e) => e.target.value !== c.email && updateContact(c.id, 'email', e.target.value)}
            />
            <button className="icon-btn" onClick={() => setContactToDelete(c)} title={t('common.delete')}>
              ✕
            </button>
          </div>
        ))}
        {shown.length === 0 && <div className="cast-empty">{t('contactsPage.noContactsYet')}</div>}
      </div>

      <div className="cast-cards">
        {shown.map((c) => (
          <div className="cast-mobile-card" key={c.id}>
            <div className="cast-mobile-card-top">
              <span className="cast-mobile-card-id">{c.department === 'cast' ? castNumbers[(c.role || '').trim().toUpperCase()] || '—' : '—'}</span>
              <input
                defaultValue={c.role}
                placeholder={c.department === 'cast' ? t('contactsPage.placeholders.character') : t('contactsPage.placeholders.role')}
                onBlur={(e) => e.target.value !== c.role && updateContact(c.id, 'role', e.target.value)}
              />
              <button type="button" onClick={() => updateContact(c.id, 'is_lead', !c.is_lead)} title={t('contactsPage.leadCheckboxTooltip')}>
                <LeadStar filled={!!c.is_lead} />
              </button>
              <button type="button" onClick={() => setContactToDelete(c)} title={t('common.delete')}>
                ✕
              </button>
            </div>
            <div className="cast-mobile-card-fields">
              <input
                defaultValue={c.name}
                placeholder={c.department === 'cast' ? t('contactsPage.placeholders.actorName') : t('contactsPage.placeholders.name')}
                onBlur={(e) => e.target.value !== c.name && updateContact(c.id, 'name', e.target.value)}
              />
              <div className="cast-mobile-card-row2">
                <input
                  defaultValue={c.phone}
                  placeholder={t('contactsPage.placeholders.phone')}
                  onBlur={(e) => e.target.value !== c.phone && updateContact(c.id, 'phone', e.target.value)}
                />
                {departmentSelect(c.department, (e) => updateContact(c.id, 'department', e.target.value))}
              </div>
              <input
                defaultValue={c.email}
                placeholder={t('contactsPage.placeholders.email')}
                onBlur={(e) => e.target.value !== c.email && updateContact(c.id, 'email', e.target.value)}
              />
            </div>
          </div>
        ))}
        {shown.length === 0 && <div className="cast-empty" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>{t('contactsPage.noContactsYet')}</div>}
      </div>

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
        {departmentSelect(form.department, (e) => setForm({ ...form, department: e.target.value }))}
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
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          {t('contactsPage.addButton')}
        </button>
      </form>

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
