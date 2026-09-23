import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useParams, Link } from 'react-router-dom';
import api from '../api.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

export default function ProjectLayout() {
  const { projectId } = useParams();
  const { t } = useLanguage();
  const [project, setProject] = useState(null);
  const [error, setError] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const nameInputRef = useRef(null);

  useEffect(() => {
    api
      .get(`/projects/${projectId}`)
      .then(setProject)
      .catch((err) => setError(err.message));
  }, [projectId]);

  useEffect(() => {
    if (editingName) nameInputRef.current?.focus();
  }, [editingName]);

  function startEditingName() {
    setNameInput(project.name);
    setEditingName(true);
  }

  async function saveName() {
    const trimmed = nameInput.trim();
    setEditingName(false);
    if (!trimmed || trimmed === project.name) return;
    try {
      const updated = await api.put(`/projects/${projectId}`, { name: trimmed });
      setProject(updated);
    } catch (err) {
      setError(err.message);
    }
  }

  const navLinks = [
    { to: 'breakdown', label: t('nav.breakdown'), short: t('nav.shortBreakdown') },
    { to: 'shot-list', label: t('nav.shotList'), short: t('nav.shortShotList') },
    { to: 'schedule', label: t('nav.schedule'), short: t('nav.shortSchedule') },
    { to: 'contacts', label: t('nav.castCrew'), short: t('nav.shortCastCrew') },
    { to: 'locations', label: t('nav.locations'), short: t('nav.shortLocations') },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link to="/" className="brand">
          <span className="brand-mark" />
          OmniSlate
        </Link>
        {editingName ? (
          <input
            ref={nameInputRef}
            className="project-name-input"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.target.blur();
              if (e.key === 'Escape') setEditingName(false);
            }}
          />
        ) : (
          <Link to="/" className="project-switcher">
            <span className="project-switcher-label">
              <span className="mono-label">{t('nav.projectLabel')}</span>
              <span className="project-switcher-name">{project ? project.name : '...'}</span>
            </span>
            {project && (
              <button
                className="icon-btn project-name-edit-btn"
                title={t('nav.renameProjectTooltip')}
                onClick={(e) => {
                  e.preventDefault();
                  startEditingName();
                }}
              >
                ✎
              </button>
            )}
          </Link>
        )}
        <nav className="nav">
          {navLinks.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? 'active' : '')}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <Link to="/" className="all-projects-link">
          {t('nav.allProjects')}
        </Link>
        <SidebarLanguageToggle />
      </aside>

      <div className="mobile-topbar">
        <Link to="/" className="mobile-topbar-back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <div className="mobile-topbar-title">
          <span className="mono-label">{t('nav.projectLabel')}</span>
          <span className="project-switcher-name">{project ? project.name : '...'}</span>
        </div>
        <span className="brand-mark" />
      </div>

      <main className="content">
        <div className="content-inner">
          {error && <div className="error-banner">{error}</div>}
          <Outlet context={{ projectId, project }} />
        </div>
      </main>

      <nav className="mobile-bottomnav">
        {navLinks.map((n) => (
          <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="mobile-bottomnav-pill" />
            {n.short}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function SidebarLanguageToggle() {
  const { lang, setLang, t } = useLanguage();
  return (
    <div className="sidebar-lang">
      <button type="button" className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>
        {t('languageToggle.english')}
      </button>
      <button type="button" className={lang === 'es' ? 'active' : ''} onClick={() => setLang('es')}>
        {t('languageToggle.spanish')}
      </button>
    </div>
  );
}
