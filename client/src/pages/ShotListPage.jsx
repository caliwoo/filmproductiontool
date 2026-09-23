import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../api.js';
import SceneShotPanel from '../components/SceneShotPanel.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';

export default function ShotListPage() {
  const { t } = useLanguage();
  const { projectId, project } = useOutletContext();
  const [tab, setTab] = useState('scenes');
  const [scenes, setScenes] = useState([]);
  const [rows, setRows] = useState(null);
  const [groupBySetup, setGroupBySetup] = useState(false);
  const [error, setError] = useState('');
  const [sceneIdsWithShots, setSceneIdsWithShots] = useState(new Set());
  const [showCreateAll, setShowCreateAll] = useState(false);
  const [createAllProgress, setCreateAllProgress] = useState('');

  useEffect(() => {
    api
      .get(`/scenes?projectId=${projectId}`)
      .then(setScenes)
      .catch((err) => setError(err.message));
  }, [projectId]);

  // Drives the "Shot List" readiness badge on each collapsed scene row below
  // -- fetched once up front (one project-scoped call) rather than lazily
  // per scene, since a scene's own shots normally only load once its panel
  // is opened.
  useEffect(() => {
    api
      .get(`/projects/${projectId}/shot-list`)
      .then((result) => setSceneIdsWithShots(new Set(result.rows.map((r) => r.scene_id))))
      .catch((err) => setError(err.message));
  }, [projectId]);

  function handleSceneShotsChange(sceneId, hasShots) {
    setSceneIdsWithShots((prev) => {
      if (hasShots === prev.has(sceneId)) return prev;
      const next = new Set(prev);
      if (hasShots) next.add(sceneId);
      else next.delete(sceneId);
      return next;
    });
  }

  useEffect(() => {
    if (tab !== 'report') return;
    const query = groupBySetup ? '?group=setup' : '';
    api
      .get(`/projects/${projectId}/shot-list${query}`)
      .then((result) => setRows(result.rows))
      .catch((err) => setError(err.message));
  }, [projectId, groupBySetup, tab]);

  const pdfHref = `/api/projects/${projectId}/shot-list-pdf${groupBySetup ? '?group=setup' : ''}`;
  const scenesNeedingShots = scenes.filter((s) => !sceneIdsWithShots.has(s.id));

  // Runs AI Suggest Shots for every scene with no shots yet, committing
  // whatever it suggests without a per-scene review step, same as
  // Breakdown All Scenes. Scenes with no usable text (AI Suggest Shots
  // returns an empty list for those) are simply skipped rather than
  // erroring. Sequential rather than parallel so the progress message stays
  // meaningful and the AI isn't hit with N simultaneous requests.
  async function handleCreateAllShotLists() {
    for (let i = 0; i < scenesNeedingShots.length; i++) {
      const scene = scenesNeedingShots[i];
      setCreateAllProgress(
        t('shotListPage.createAllProgress', {
          index: i + 1,
          total: scenesNeedingShots.length,
          sceneNumber: scene.scene_number,
          heading: scene.heading || t('breakdownPage.untitled'),
        })
      );
      const { candidates, nextShotNumber } = await api.post(`/scenes/${scene.id}/ai-shots`, {});
      if (candidates && candidates.length > 0) {
        await api.post('/shots/bulk', {
          scene_id: scene.id,
          shots: candidates.map((c, idx) => ({ ...c, shot_number: String(nextShotNumber + idx) })),
        });
        handleSceneShotsChange(scene.id, true);
      }
    }
    setCreateAllProgress('');
    setShowCreateAll(false);
  }

  return (
    <div>
      <div className="page-header">
        <h2>{t('shotListPage.title')}</h2>
        {tab === 'scenes' && (
          <button
            className="btn btn-secondary"
            disabled={scenesNeedingShots.length === 0}
            title={
              scenesNeedingShots.length === 0
                ? t('shotListPage.createAllShotListsReady')
                : t('shotListPage.createAllShotListsTooltip', { count: scenesNeedingShots.length })
            }
            onClick={() => setShowCreateAll(true)}
          >
            {t('shotListPage.createAllShotLists')}
          </button>
        )}
        {tab === 'report' && (
          <div className="flex-row">
            <label
              className="flex-row"
              style={{ gap: 6, fontSize: 13 }}
              title={t('shotListPage.batchBySetupTooltip')}
            >
              <input type="checkbox" checked={groupBySetup} onChange={(e) => setGroupBySetup(e.target.checked)} />
              {t('shotListPage.batchBySetup')}
            </label>
            <a className="btn" href={pdfHref}>
              {t('shotListPage.downloadPdf')}
            </a>
          </div>
        )}
      </div>

      <div className="tabs">
        <button className={tab === 'scenes' ? 'active' : ''} onClick={() => setTab('scenes')}>
          {t('shotListPage.tabByScene')}
        </button>
        <button className={tab === 'report' ? 'active' : ''} onClick={() => setTab('report')}>
          {t('shotListPage.tabReport')}
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {showCreateAll && (
        <ConfirmDialog
          title={t('shotListPage.createAllTitle')}
          message={t('shotListPage.createAllMessage', { count: scenesNeedingShots.length })}
          confirmLabel={t('shotListPage.createAllConfirm')}
          busyLabel={t('shotListPage.creatingAll')}
          progressMessage={createAllProgress}
          danger={false}
          onConfirm={handleCreateAllShotLists}
          onCancel={() => setShowCreateAll(false)}
        />
      )}

      {tab === 'scenes' && (
        <>
          <p className="muted" style={{ marginBottom: 12 }}>
            {t('shotListPage.intro')}{' '}
            <strong>{t('shotListPage.introStrong')}</strong>.
          </p>
          {scenes.map((scene) => (
            <SceneShotPanel
              key={scene.id}
              scene={scene}
              hasShots={sceneIdsWithShots.has(scene.id)}
              onShotsChange={handleSceneShotsChange}
            />
          ))}
          {scenes.length === 0 && <p className="empty-state">{t('shotListPage.noScenesYet')}</p>}
        </>
      )}

      {tab === 'report' && (
        <div className="shotlist-sheet">
          <h1 className="shotlist-title">{t('shotListPage.reportTitle')}</h1>
          <div className="shotlist-subtitle">&quot;{project ? project.name : ''}&quot;</div>
          {groupBySetup && (
            <p className="muted" style={{ textAlign: 'center', marginTop: -8 }}>
              {t('shotListPage.groupedNote')}
            </p>
          )}

          <div className="table-scroll">
            <table className="shotlist-table">
              <thead>
                <tr>
                  <th>{t('shotListPage.columns.shotNo')}</th>
                  <th>{t('shotListPage.columns.sceneNo')}</th>
                  <th>{t('shotListPage.columns.sceneDescription')}</th>
                  <th>{t('shotListPage.columns.subject')}</th>
                  <th>{t('shotListPage.columns.cameraAngleMovement')}</th>
                  <th>{t('shotListPage.columns.lens')}</th>
                  <th>{t('shotListPage.columns.location')}</th>
                  <th>{t('shotListPage.columns.timeOfDay')}</th>
                  <th>{t('shotListPage.columns.equipment')}</th>
                  <th>{t('shotListPage.columns.talentProps')}</th>
                  <th>{t('shotListPage.columns.compositionSetupNotes')}</th>
                </tr>
              </thead>
              <tbody>
                {rows &&
                  rows.map((r, i) => (
                    <tr key={r.shot_id} className={i % 2 === 1 ? 'striped' : ''}>
                      <td>{r.shot_number}</td>
                      <td>{r.scene_number}</td>
                      <td>
                        {r.scene_heading && <strong>{r.scene_heading}</strong>}
                        {r.scene_heading && r.description ? ' — ' : ''}
                        {r.description}
                      </td>
                      <td>{r.subject || '—'}</td>
                      <td>{[r.size, r.angle, r.movement].filter(Boolean).join(', ') || '—'}</td>
                      <td>{r.lens || '—'}</td>
                      <td>{r.location || '—'}</td>
                      <td>{r.day_night || '—'}</td>
                      <td>{r.equipment || '—'}</td>
                      <td>{[...r.cast, ...r.props].join(', ') || '—'}</td>
                      <td>{[r.spatial_composition, r.setup_notes].filter(Boolean).join(' — ') || '—'}</td>
                    </tr>
                  ))}
                {rows && rows.length === 0 && (
                  <tr>
                    <td colSpan={11} className="muted" style={{ textAlign: 'center', padding: '24px 0' }}>
                      {t('shotListPage.noShotsYet')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
