import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../api.js';
import SceneShotPanel from '../components/SceneShotPanel.jsx';

export default function ShotListPage() {
  const { projectId, project } = useOutletContext();
  const [tab, setTab] = useState('scenes');
  const [scenes, setScenes] = useState([]);
  const [rows, setRows] = useState(null);
  const [groupBySetup, setGroupBySetup] = useState(false);
  const [error, setError] = useState('');
  const [sceneIdsWithShots, setSceneIdsWithShots] = useState(new Set());

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

  return (
    <div>
      <div className="page-header">
        <h2>Shot List</h2>
        {tab === 'report' && (
          <div className="flex-row">
            <label
              className="flex-row"
              style={{ gap: 6, fontSize: 13 }}
              title="Group shots by location, angle, and lens instead of script order, so the 1st AD can call setups without unnecessary re-lighting or camera moves"
            >
              <input type="checkbox" checked={groupBySetup} onChange={(e) => setGroupBySetup(e.target.checked)} />
              Batch by setup
            </label>
            <a className="btn" href={pdfHref}>
              Download PDF
            </a>
          </div>
        )}
      </div>

      <div className="tabs">
        <button className={tab === 'scenes' ? 'active' : ''} onClick={() => setTab('scenes')}>
          By Scene
        </button>
        <button className={tab === 'report' ? 'active' : ''} onClick={() => setTab('report')}>
          Report
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {tab === 'scenes' && (
        <>
          <p className="muted" style={{ marginBottom: 12 }}>
            Select a scene to see its screenplay text and build its shot list, manually or with{' '}
            <strong>Create Shot List (AI)</strong>.
          </p>
          {scenes.map((scene) => (
            <SceneShotPanel
              key={scene.id}
              scene={scene}
              hasShots={sceneIdsWithShots.has(scene.id)}
              onShotsChange={handleSceneShotsChange}
            />
          ))}
          {scenes.length === 0 && <p className="empty-state">No scenes yet. Add scenes in Script Breakdown first.</p>}
        </>
      )}

      {tab === 'report' && (
        <div className="shotlist-sheet">
          <h1 className="shotlist-title">SHOT LIST</h1>
          <div className="shotlist-subtitle">&quot;{project ? project.name : ''}&quot;</div>
          {groupBySetup && (
            <p className="muted" style={{ textAlign: 'center', marginTop: -8 }}>
              Ordered by location, angle, and lens to minimize re-lighting and camera moves — not script order.
            </p>
          )}

          <div className="table-scroll">
            <table className="shotlist-table">
              <thead>
                <tr>
                  <th>Shot No.</th>
                  <th>Scene #</th>
                  <th>Scene / Description</th>
                  <th>Subject</th>
                  <th>Camera Angle / Movement</th>
                  <th>Lens</th>
                  <th>Location</th>
                  <th>Time of Day</th>
                  <th>Equipment</th>
                  <th>Talent / Props</th>
                  <th>Composition / Setup Notes</th>
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
                      No shots yet. Add shots in the By Scene tab, or generate some with Create Shot List (AI).
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
