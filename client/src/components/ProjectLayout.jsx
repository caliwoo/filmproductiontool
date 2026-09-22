import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useParams, Link } from 'react-router-dom';
import api from '../api.js';

export default function ProjectLayout() {
  const { projectId } = useParams();
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

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link to="/" className="brand">
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
          <div className="project-name">
            {project ? project.name : '...'}
            {project && (
              <button className="icon-btn project-name-edit-btn" title="Rename project" onClick={startEditingName}>
                ✎
              </button>
            )}
          </div>
        )}
        <nav className="nav">
          <NavLink to="breakdown" className={({ isActive }) => (isActive ? 'active' : '')}>
            Script Breakdown
          </NavLink>
          <NavLink to="shot-list" className={({ isActive }) => (isActive ? 'active' : '')}>
            Shot List
          </NavLink>
          <NavLink to="schedule" className={({ isActive }) => (isActive ? 'active' : '')}>
            Schedule
          </NavLink>
          <NavLink to="contacts" className={({ isActive }) => (isActive ? 'active' : '')}>
            Cast &amp; Crew
          </NavLink>
          <NavLink to="locations" className={({ isActive }) => (isActive ? 'active' : '')}>
            Locations
          </NavLink>
        </nav>
        <Link to="/" className="all-projects-link">
          &larr; All Projects
        </Link>
      </aside>
      <main className="content">
        {error && <div className="error-banner">{error}</div>}
        <Outlet context={{ projectId, project }} />
      </main>
    </div>
  );
}
