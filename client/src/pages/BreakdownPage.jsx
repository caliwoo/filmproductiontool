import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../api.js';
import SceneCard from '../components/SceneCard.jsx';
import ScriptImportDialog from '../components/ScriptImportDialog.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';

export default function BreakdownPage() {
  const { t } = useLanguage();
  const { projectId } = useOutletContext();
  const [scenes, setScenes] = useState([]);
  const [locations, setLocations] = useState([]);
  const [newSceneNumber, setNewSceneNumber] = useState('');
  const [error, setError] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [sceneToDelete, setSceneToDelete] = useState(null);
  const [showBreakdownAll, setShowBreakdownAll] = useState(false);
  const [breakdownAllProgress, setBreakdownAllProgress] = useState('');

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
  const scenesNeedingBreakdown = scenes.filter((s) => !s.elements || s.elements.length === 0);

  // Runs AI Select for every scene with no breakdown elements yet, committing
  // whatever it suggests without a per-scene review step -- the point of a
  // bulk action is not reviewing each one individually. Scenes with no
  // usable text (AI Select returns an empty list for those) are simply
  // skipped rather than erroring. Sequential rather than parallel so the
  // progress message stays meaningful and the AI isn't hit with N
  // simultaneous requests.
  async function handleBreakdownAll() {
    for (let i = 0; i < scenesNeedingBreakdown.length; i++) {
      const scene = scenesNeedingBreakdown[i];
      setBreakdownAllProgress(
        t('breakdownPage.breakdownAllProgress', {
          index: i + 1,
          total: scenesNeedingBreakdown.length,
          sceneNumber: scene.scene_number,
          heading: scene.heading || t('breakdownPage.untitled'),
        })
      );
      const { candidates } = await api.post(`/scenes/${scene.id}/ai-tag`, {});
      if (candidates && candidates.length > 0) {
        await api.post(`/scenes/${scene.id}/elements/bulk`, {
          elements: candidates.map(({ category, value, quote }) => ({ category, value, quote })),
        });
      }
    }
    setBreakdownAllProgress('');
    setShowBreakdownAll(false);
    load();
  }

  return (
    <div>
      <div className="page-header">
        <h2>{t('breakdownPage.title')}</h2>
        <div className="flex-row">
          <span className="muted">
            {t('breakdownPage.scenesCount', { count: scenes.length, pages: totalPages.toFixed(1) })}
          </span>
          <button
            className="btn btn-secondary"
            disabled={scenesNeedingBreakdown.length === 0}
            title={
              scenesNeedingBreakdown.length === 0
                ? t('breakdownPage.breakdownAllScenesReady')
                : t('breakdownPage.breakdownAllScenesTooltip', { count: scenesNeedingBreakdown.length })
            }
            onClick={() => setShowBreakdownAll(true)}
          >
            {t('breakdownPage.breakdownAllScenes')}
          </button>
          <button className="btn btn-secondary" onClick={() => setShowImport(true)}>
            {t('breakdownPage.importScript')}
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

      {showBreakdownAll && (
        <ConfirmDialog
          title={t('breakdownPage.breakdownAllTitle')}
          message={t('breakdownPage.breakdownAllMessage', { count: scenesNeedingBreakdown.length })}
          confirmLabel={t('breakdownPage.breakdownAllConfirm')}
          busyLabel={t('breakdownPage.breakingDown')}
          progressMessage={breakdownAllProgress}
          danger={false}
          onConfirm={handleBreakdownAll}
          onCancel={() => setShowBreakdownAll(false)}
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

      {scenes.length === 0 && <p className="empty-state">{t('breakdownPage.noScenesYet')}</p>}

      <form className="inline-form" onSubmit={handleAddScene}>
        <input
          placeholder={t('breakdownPage.addScenePlaceholder')}
          value={newSceneNumber}
          onChange={(e) => setNewSceneNumber(e.target.value)}
        />
        <button type="submit" className="btn">
          {t('breakdownPage.addSceneButton')}
        </button>
      </form>

      {sceneToDelete && (
        <ConfirmDialog
          title={t('breakdownPage.deleteSceneTitle')}
          message={t('breakdownPage.deleteSceneMessage', {
            number: sceneToDelete.scene_number,
            heading: sceneToDelete.heading || t('breakdownPage.untitledLower'),
          })}
          confirmLabel={t('breakdownPage.deleteSceneConfirm')}
          onConfirm={confirmDeleteScene}
          onCancel={() => setSceneToDelete(null)}
        />
      )}
    </div>
  );
}
