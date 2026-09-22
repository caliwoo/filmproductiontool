import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import ImportProjectDialog from '../components/ImportProjectDialog.jsx';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [editingName, setEditingName] = useState('');

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

  return (
    <div className="landing">
      <div className="landing-inner">
        <h1>OmniSlate</h1>
        <p className="subtitle">Script breakdowns, shot lists, scheduling &amp; call sheets for your production.</p>

        {error && <div className="error-banner">{error}</div>}

        <div className="flex-row" style={{ alignItems: 'flex-start', marginBottom: 32 }}>
          <form className="new-project-form" style={{ marginBottom: 0, flex: 1 }} onSubmit={handleCreate}>
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
          <button className="btn btn-secondary" onClick={() => setShowImport(true)}>
            Import from Script
          </button>
        </div>

        {showImport && (
          <ImportProjectDialog
            onClose={() => setShowImport(false)}
            onCreated={(project) => {
              setShowImport(false);
              navigate(`/projects/${project.id}`);
            }}
          />
        )}

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
              {editingProjectId === p.id ? (
                <div className="project-card-link">
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
                  <p>{p.description || 'No description'}</p>
                </div>
              ) : (
                <Link to={`/projects/${p.id}`} className="project-card-link">
                  <h3>
                    {p.name}
                    <button
                      className="icon-btn project-card-edit-btn"
                      title="Rename project"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        startEditingProject(p);
                      }}
                    >
                      ✎
                    </button>
                  </h3>
                  <p>{p.description || 'No description'}</p>
                </Link>
              )}
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
