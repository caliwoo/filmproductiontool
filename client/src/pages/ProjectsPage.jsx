import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import ImportProjectDialog from '../components/ImportProjectDialog.jsx';
import LanguageToggle from '../components/LanguageToggle.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { formatRelativeTime } from '../relativeTime.js';

function ScheduleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h16v14H4zM4 10h16M8 3v5M16 3v5" />
    </svg>
  );
}

function CastIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.5c1.8.9 3 2.9 3 5.5" />
    </svg>
  );
}

function ClapperIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8.5l1.3-4h3.6l-1.3 4M8.6 8.5l1.3-4h3.6l-1.3 4M14.2 8.5l1.3-4h3.6l-1.3 4M3 8.5h18V19a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19V8.5z" />
    </svg>
  );
}

// Real per-project stats for the featured card, other-project status pills,
// and quick links -- the design reference used placeholder values here, but
// every number below is fetched from each project's own data.
function useStatsByProject(projects) {
  const [statsById, setStatsById] = useState({});

  useEffect(() => {
    if (projects.length === 0) return;
    Promise.all(
      projects.map((p) =>
        Promise.all([
          api.get(`/scenes?projectId=${p.id}`),
          api.get(`/contacts?projectId=${p.id}`),
          api.get(`/shoot-days?projectId=${p.id}`),
        ]).then(([scenes, contacts, days]) => {
          const castCount = contacts.filter((c) => c.department === 'cast').length;
          const crewCount = contacts.length - castCount;
          const shotCount = scenes.filter((s) => s.status === 'shot').length;
          const bdCount = scenes.filter((s) => s.elements && s.elements.length > 0).length;
          const totalPages = scenes.reduce((sum, s) => sum + Number(s.page_count || 0), 0);
          return [
            p.id,
            { sceneCount: scenes.length, totalPages, castCount, crewCount, shotCount, bdCount, dayCount: days.length },
          ];
        })
      )
    ).then((entries) => setStatsById(Object.fromEntries(entries)));
  }, [projects]);

  return statsById;
}

function computeStatus(stats, t) {
  if (!stats || stats.sceneCount === 0) return { label: t('projects.statusNew'), tone: 'new' };
  if (stats.shotCount === stats.sceneCount) return { label: t('projects.statusWrapped'), tone: 'done' };
  if (stats.bdCount > 0 || stats.shotCount > 0) return { label: t('projects.statusInProduction'), tone: 'active' };
  return { label: t('projects.statusPreProduction'), tone: 'pre' };
}

export default function ProjectsPage() {
  const navigate = useNavigate();
  const { t, lang } = useLanguage();
  const [projects, setProjects] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState('');
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [editingName, setEditingName] = useState('');

  function load() {
    api.get('/projects').then(setProjects).catch((err) => setError(err.message));
  }

  useEffect(load, []);

  const featured = projects[0] || null;
  const others = projects.slice(1);
  const statsById = useStatsByProject(projects);
  const stats = featured ? statsById[featured.id] : null;

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await api.post('/projects', { name, description });
      setName('');
      setDescription('');
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function confirmDelete() {
    await api.del(`/projects/${projectToDelete.id}`);
    setProjectToDelete(null);
    load();
  }

  function startEditingProject(p) {
    setEditingProjectId(p.id);
    setEditingName(p.name);
  }

  async function saveProjectName(project) {
    const trimmed = editingName.trim();
    setEditingProjectId(null);
    if (!trimmed || trimmed === project.name) return;
    try {
      const updated = await api.put(`/projects/${project.id}`, { name: trimmed });
      setProjects((prev) => prev.map((p) => (p.id === project.id ? updated : p)));
    } catch (err) {
      setError(err.message);
    }
  }

  const todayLabel = new Date()
    .toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    .toUpperCase();

  const bdPct = stats && stats.sceneCount ? Math.round((stats.bdCount / stats.sceneCount) * 100) : 0;
  const featuredStatus = computeStatus(stats, t);

  return (
    <div className="landing">
      <div className="landing-inner">
        <div className="landing-topbar">
          <span className="landing-brand">
            <img src="/omnislate-logo.png" alt="OmniSlate" className="brand-logo" />
          </span>
          <LanguageToggle />
        </div>

        {error && <div className="error-banner">{error}</div>}

        <div className="landing-hero">
          <div>
            <span className="subtitle">{todayLabel}</span>
            <h1>{t('projects.welcomeBack')}</h1>
          </div>
          <div className="landing-actions">
            <button className="btn" onClick={() => setShowCreate((v) => !v)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              {t('projects.newProject')}
            </button>
            <button className="btn-secondary" onClick={() => setShowImport(true)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 15V3M7 8l5-5 5 5M4 15v5h16v-5" />
              </svg>
              {t('projects.importFromScript')}
            </button>
          </div>
        </div>

        {showCreate && (
          <form className="create-project-panel" onSubmit={handleCreate}>
            <input
              autoFocus
              placeholder={t('projects.namePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              placeholder={t('projects.descriptionPlaceholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className="flex-row" style={{ flex: '1 1 auto' }}>
              <button type="submit" className="btn" style={{ flex: 1 }}>
                {t('projects.create')}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>
                {t('projects.cancel')}
              </button>
            </div>
          </form>
        )}

        {showImport && (
          <ImportProjectDialog
            onClose={() => setShowImport(false)}
            onCreated={(project) => {
              setShowImport(false);
              navigate(`/projects/${project.id}`);
            }}
          />
        )}

        <div className="landing-columns">
          <div className="landing-main">
            {featured && (
              <div className="featured-card">
                <div className="featured-card-stripe" />
                <div className="featured-card-body">
                  <div className="flex-row" style={{ alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div className="flex-row" style={{ flexWrap: 'wrap' }}>
                        <span className={`status-pill tone-${featuredStatus.tone}`}>
                          <span className="status-pill-dot" />
                          {featuredStatus.label}
                        </span>
                        <span className="muted">{t('projects.edited', { time: formatRelativeTime(featured.updated_at, t) })}</span>
                      </div>
                      <h2 className="featured-title">{featured.name}</h2>
                      <span className="featured-desc">{featured.description || t('projects.noDescriptionYet')}</span>
                    </div>
                    <button
                      className="icon-btn"
                      title={t('projects.deleteProjectTooltip')}
                      onClick={() => setProjectToDelete(featured)}
                    >
                      ✕
                    </button>
                  </div>

                  <div className="stat-strip">
                    {[
                      [t('projects.statScenes'), stats ? stats.sceneCount : '—'],
                      [t('projects.statPages'), stats ? stats.totalPages.toFixed(1) : '—'],
                      [t('projects.statCast'), stats ? stats.castCount : '—'],
                      [t('projects.statShot'), stats ? `${stats.shotCount}/${stats.sceneCount}` : '—'],
                    ].map(([label, value]) => (
                      <div className="stat-cell" key={label}>
                        <span className="mono-label">{label}</span>
                        <span className="stat-cell-value">{value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="progress-row">
                    <div className="progress-row-labels">
                      <span>{t('projects.breakdownProgress')}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{bdPct}%</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${bdPct}%` }} />
                    </div>
                  </div>

                  <div className="featured-footer">
                    <div className="flex-row">
                      <span
                        title={t('projects.you')}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          border: '2px solid var(--surface)',
                          background: 'var(--accent)',
                          color: 'var(--accent-text)',
                          fontSize: 12,
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {t('projects.you').slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="featured-footer-actions">
                      <button className="btn-secondary" onClick={() => navigate(`/projects/${featured.id}/contacts`)}>
                        {t('projects.castCrewButton')}
                      </button>
                      <button className="btn" onClick={() => navigate(`/projects/${featured.id}/breakdown`)}>
                        {t('projects.openProject')}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14M13 6l6 6-6 6" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {others.length > 0 && (
              <>
                <span className="mono-label other-projects-label">{t('projects.otherProjects')}</span>
                <div className="other-projects-grid">
                  {others.map((p) => {
                    const pStatus = computeStatus(statsById[p.id], t);
                    const hasDescription = Boolean(p.description);
                    return (
                      <div className="project-card" key={p.id}>
                        <div className="project-card-top">
                          <span className="project-card-icon">
                            <ClapperIcon />
                          </span>
                          <div className="project-card-title-row">
                            {editingProjectId === p.id ? (
                              <input
                                className="project-card-name-input"
                                autoFocus
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onBlur={() => saveProjectName(p)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') e.target.blur();
                                  if (e.key === 'Escape') setEditingProjectId(null);
                                }}
                              />
                            ) : (
                              <h3 title={p.name}>{p.name}</h3>
                            )}
                            <div className="project-card-actions">
                              <button
                                className="icon-btn"
                                title={t('projects.renameProjectTooltip')}
                                onClick={() => startEditingProject(p)}
                              >
                                ✎
                              </button>
                              <button
                                className="icon-btn"
                                title={t('projects.deleteProjectTooltip')}
                                onClick={() => setProjectToDelete(p)}
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        </div>
                        <span className="project-card-edited">
                          {t('projects.edited', { time: formatRelativeTime(p.updated_at, t) })}
                        </span>
                        <p className={`project-card-desc${hasDescription ? '' : ' empty'}`}>
                          {p.description || t('projects.noDescription')}
                        </p>
                        <div className="project-card-footer">
                          <span className={`status-pill tone-${pStatus.tone}`} style={{ height: 22, fontSize: 11.5 }}>
                            {pStatus.label}
                          </span>
                          <Link to={`/projects/${p.id}`} className="project-card-switch">
                            {t('projects.switchToProject')}
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M9 6l6 6-6 6" />
                            </svg>
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {projects.length === 0 && <p className="empty-state">{t('projects.noProjectsDashed')}</p>}
          </div>

          {featured && (
            <div className="landing-side">
              <div className="quick-links">
                <span className="mono-label side-panel-label">{t('projects.quickLinksLabel')}</span>
                <Link to={`/projects/${featured.id}/schedule`} className="quick-link">
                  <span className="quick-link-icon" style={{ background: 'rgba(255,209,64,.14)', color: 'var(--warning)' }}>
                    <ScheduleIcon />
                  </span>
                  <span className="quick-link-text">
                    <span className="quick-link-text-label">{t('projects.quickShootingSchedule')}</span>
                    <span className="quick-link-text-sub">
                      {t('projects.quickShootDaysSet', { count: stats ? stats.dayCount : 0 })}
                    </span>
                  </span>
                </Link>
                <Link to={`/projects/${featured.id}/contacts`} className="quick-link">
                  <span className="quick-link-icon" style={{ background: 'rgba(239,168,202,.14)', color: 'var(--danger)' }}>
                    <CastIcon />
                  </span>
                  <span className="quick-link-text">
                    <span className="quick-link-text-label">{t('projects.quickCastCrew')}</span>
                    <span className="quick-link-text-sub">
                      {t('projects.quickCastCrewSub', {
                        cast: stats ? stats.castCount : 0,
                        crew: stats ? stats.crewCount : 0,
                      })}
                    </span>
                  </span>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {projectToDelete && (
        <ConfirmDialog
          title={t('projects.deleteProjectTitle')}
          message={t('projects.deleteProjectMessage', { name: projectToDelete.name })}
          confirmLabel={t('projects.deleteProjectConfirm')}
          onConfirm={confirmDelete}
          onCancel={() => setProjectToDelete(null)}
        />
      )}
    </div>
  );
}
