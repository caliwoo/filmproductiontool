import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [projectToDelete, setProjectToDelete] = useState(null);

  function load() {
    api.get('/projects').then(setProjects).catch((err) => setError(err.message));
  }

  useEffect(load, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await api.post('/projects', { name, description });
      setName('');
      setDescription('');
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

  return (
    <div className="landing">
      <div className="landing-inner">
        <h1>Reelboard</h1>
        <p className="subtitle">Script breakdowns, shot lists, scheduling &amp; call sheets for your production.</p>

        {error && <div className="error-banner">{error}</div>}

        <form className="new-project-form" onSubmit={handleCreate}>
          <input
            placeholder="Project name (e.g. Midnight Runners)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <button type="submit">New Project</button>
        </form>

        <div className="project-grid">
          {projects.map((p) => (
            <div className="project-card" key={p.id}>
              <button
                className="icon-btn project-card-delete"
                onClick={() => setProjectToDelete(p)}
                title="Delete project"
              >
                ✕
              </button>
              <Link to={`/projects/${p.id}`} className="project-card-link">
                <h3>{p.name}</h3>
                <p>{p.description || 'No description'}</p>
              </Link>
            </div>
          ))}
          {projects.length === 0 && <p className="empty-state">No projects yet. Create your first one above.</p>}
        </div>
      </div>

      {projectToDelete && (
        <ConfirmDialog
          title="Delete project?"
          message={`This will permanently delete "${projectToDelete.name}" and everything in it — scenes, shots, schedule, contacts, and locations. This can't be undone.`}
          confirmLabel="Delete Project"
          onConfirm={confirmDelete}
          onCancel={() => setProjectToDelete(null)}
        />
      )}
    </div>
  );
}
