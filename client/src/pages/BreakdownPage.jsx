import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../api.js';
import SceneCard from '../components/SceneCard.jsx';
import ScriptImportDialog from '../components/ScriptImportDialog.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

export default function BreakdownPage() {
  const { projectId } = useOutletContext();
  const [scenes, setScenes] = useState([]);
  const [locations, setLocations] = useState([]);
  const [newSceneNumber, setNewSceneNumber] = useState('');
  const [error, setError] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [sceneToDelete, setSceneToDelete] = useState(null);

  function load() {
    Promise.all([
      api.get(`/scenes?projectId=${projectId}`),
      api.get(`/locations?projectId=${projectId}`),
    ])
      .then(([sceneRows, locationRows]) => {
        setScenes(sceneRows);
        setLocations(locationRows);
      })
      .catch((err) => setError(err.message));
  }

  useEffect(load, [projectId]);

  async function handleAddScene(e) {
    e.preventDefault();
    const nextNumber = newSceneNumber.trim() || String(scenes.length + 1);
    try {
      await api.post('/scenes', { project_id: projectId, scene_number: nextNumber, heading: 'NEW SCENE' });
      setNewSceneNumber('');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function confirmDeleteScene() {
    await api.del(`/scenes/${sceneToDelete.id}`);
    setSceneToDelete(null);
    load();
  }

  const totalPages = scenes.reduce((sum, s) => sum + Number(s.page_count || 0), 0);

  return (
    <div>
      <div className="page-header">
        <h2>Script Breakdown</h2>
        <div className="flex-row">
          <span className="muted">
            {scenes.length} scenes &middot; {totalPages.toFixed(1)} pages
          </span>
          <button className="btn btn-secondary" onClick={() => setShowImport(true)}>
            Import Script (PDF)
          </button>
        </div>
      </div>
      {error && <div className="error-banner">{error}</div>}

      {showImport && (
        <ScriptImportDialog
          projectId={projectId}
          onClose={() => setShowImport(false)}
          onImported={() => {
            setShowImport(false);
            load();
          }}
        />
      )}

      {scenes.map((scene) => (
        <SceneCard
          key={scene.id}
          scene={scene}
          locations={locations}
          onChange={load}
          onDelete={() => setSceneToDelete(scene)}
        />
      ))}

      {scenes.length === 0 && <p className="empty-state">No scenes yet. Add your first scene below.</p>}

      <form className="inline-form" onSubmit={handleAddScene}>
        <input
          placeholder="Scene # (optional, auto-increments)"
          value={newSceneNumber}
          onChange={(e) => setNewSceneNumber(e.target.value)}
        />
        <button type="submit" className="btn">
          + Add Scene
        </button>
      </form>

      {sceneToDelete && (
        <ConfirmDialog
          title="Delete scene?"
          message={`This will permanently delete Scene ${sceneToDelete.scene_number} (${sceneToDelete.heading || 'untitled'}), along with its tagged elements and shot list. This can't be undone.`}
          confirmLabel="Delete Scene"
          onConfirm={confirmDeleteScene}
          onCancel={() => setSceneToDelete(null)}
        />
      )}
    </div>
  );
}
