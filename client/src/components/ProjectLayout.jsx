import { useEffect, useState } from 'react';
import { NavLink, Outlet, useParams, Link } from 'react-router-dom';
import api from '../api.js';

export default function ProjectLayout() {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get(`/projects/${projectId}`)
      .then(setProject)
      .catch((err) => setError(err.message));
  }, [projectId]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link to="/" className="brand">
          Reelboard
        </Link>
        <div className="project-name">{project ? project.name : '...'}</div>
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
