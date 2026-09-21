import { useRef, useState } from 'react';
import api from '../api.js';
import ScriptSceneReviewTable from './ScriptSceneReviewTable.jsx';

function nameFromFileName(fileName) {
  return fileName.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim();
}

export default function ImportProjectDialog({ onClose, onCreated }) {
  const fileInputRef = useRef(null);
  const [fileName, setFileName] = useState('');
  const [scenes, setScenes] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parsing, setParsing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  async function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setError('');
    setScenes(null);
    setParsing(true);
    try {
      const formData = new FormData();
      formData.append('script', file);
      const result = await api.upload('/scripts/parse', formData);
      setScenes(result.scenes.map((s) => ({ ...s, include: true })));
      setName(result.suggestedName || nameFromFileName(file.name));
      setDescription(result.suggestedDescription || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setParsing(false);
    }
  }

  function updateScene(index, field, value) {
    setScenes((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  }

  async function handleCreate() {
    const toImport = scenes.filter((s) => s.include);
    if (!name.trim() || toImport.length === 0) return;
    setCreating(true);
    setError('');
    let project = null;
    try {
      project = await api.post('/projects', { name: name.trim(), description });
      await api.post('/scripts/import', {
        project_id: project.id,
        scenes: toImport.map(({ include, ...s }) => s),
      });
      onCreated(project);
    } catch (err) {
      if (project) {
        // The project was created but importing its scenes failed -- delete
        // it rather than leaving an empty, script-less project behind for
        // every failed attempt.
        await api.del(`/projects/${project.id}`).catch(() => {});
      }
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  const includedCount = scenes ? scenes.filter((s) => s.include).length : 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>New Project from Script (PDF)</h3>
          <button className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          {error && <div className="error-banner">{error}</div>}

          {!scenes && (
            <div className="upload-drop">
              <p className="muted">
                Upload a screenplay PDF to create a new project from it. We&apos;ll prefill the project&apos;s name
                and description from its title page where we can, and scan it for scenes the same way importing into
                an existing project does.
              </p>
              <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFileChange} />
              {parsing && <p className="muted">Parsing {fileName}...</p>}
            </div>
          )}

          {scenes && (
            <>
              <div className="new-project-form" style={{ marginBottom: 16 }}>
                <input placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} />
                <input
                  placeholder="Description (optional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <p className="muted">
                Detected {scenes.length} scene{scenes.length === 1 ? '' : 's'} in {fileName}. Review and edit before
                creating the project &mdash; uncheck any that were misdetected. Page lengths are estimated from where
                each scene falls in the PDF; adjust any that look off.
              </p>
              <ScriptSceneReviewTable scenes={scenes} onUpdateScene={updateScene} />
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          {scenes && (
            <button className="btn" disabled={creating || includedCount === 0 || !name.trim()} onClick={handleCreate}>
              {creating ? 'Creating...' : `Create Project with ${includedCount} Scene${includedCount === 1 ? '' : 's'}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
