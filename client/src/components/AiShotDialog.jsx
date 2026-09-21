import { useEffect, useState } from 'react';
import api from '../api.js';

const SIZES = ['WS', 'MS', 'CU', 'ECU', 'OTS', 'POV', '2-Shot', 'Insert'];

export default function AiShotDialog({ sceneId, onClose, onCommitted }) {
  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState(null);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState('');
  const [notConfigured, setNotConfigured] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError('');
    setNotConfigured(false);
    api
      .post(`/scenes/${sceneId}/ai-shots`, {})
      .then((result) =>
        setCandidates(
          result.candidates.map((c, i) => ({
            ...c,
            shot_number: String(result.nextShotNumber + i),
            include: true,
          }))
        )
      )
      .catch((err) => {
        setError(err.message);
        setNotConfigured(/not configured/i.test(err.message));
      })
      .finally(() => setLoading(false));
  }, [sceneId]);

  function updateCandidate(index, field, value) {
    setCandidates((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  }

  async function handleCommit() {
    const toAdd = candidates.filter((c) => c.include);
    if (toAdd.length === 0) return;
    setCommitting(true);
    setError('');
    try {
      await api.post('/shots/bulk', {
        scene_id: sceneId,
        shots: toAdd.map(({ include, ...s }) => s),
      });
      onCommitted();
    } catch (err) {
      setError(err.message);
    } finally {
      setCommitting(false);
    }
  }

  const includedCount = candidates ? candidates.filter((c) => c.include).length : 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 1000 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>AI Suggest Shot List</h3>
          <button className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          {loading && <p className="muted">Reading the scene and drafting a shot list...</p>}

          {error && (
            <div className="error-banner">
              {error}
              {notConfigured && (
                <div style={{ marginTop: 6 }}>
                  Add an <code>ANTHROPIC_API_KEY</code> environment variable to the server to enable this feature.
                </div>
              )}
            </div>
          )}

          {!loading && !error && candidates && candidates.length === 0 && (
            <p className="empty-state">Claude couldn't suggest any shots for this scene — try adding a synopsis.</p>
          )}

          {!loading && candidates && candidates.length > 0 && (
            <>
              <p className="muted">
                Claude suggested {candidates.length} shot{candidates.length === 1 ? '' : 's'} to cover this scene.
                Review and edit before adding &mdash; uncheck anything that doesn&apos;t fit.
              </p>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th></th>
                      <th>#</th>
                      <th>Size</th>
                      <th>Angle</th>
                      <th>Movement</th>
                      <th>Subject</th>
                      <th>Lens</th>
                      <th>Description</th>
                      <th>Composition</th>
                      <th>Equipment</th>
                      <th>Setup Notes</th>
                      <th>Lines</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map((c, i) => (
                      <tr key={i}>
                        <td>
                          <input
                            type="checkbox"
                            checked={c.include}
                            onChange={(e) => updateCandidate(i, 'include', e.target.checked)}
                          />
                        </td>
                        <td>
                          <input
                            style={{ width: 40 }}
                            value={c.shot_number}
                            onChange={(e) => updateCandidate(i, 'shot_number', e.target.value)}
                          />
                        </td>
                        <td>
                          <select value={c.size} onChange={(e) => updateCandidate(i, 'size', e.target.value)}>
                            {SIZES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            style={{ width: 100 }}
                            value={c.angle}
                            onChange={(e) => updateCandidate(i, 'angle', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            style={{ width: 100 }}
                            value={c.movement}
                            onChange={(e) => updateCandidate(i, 'movement', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            style={{ width: 90 }}
                            value={c.subject}
                            onChange={(e) => updateCandidate(i, 'subject', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            style={{ width: 70 }}
                            value={c.lens}
                            onChange={(e) => updateCandidate(i, 'lens', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            style={{ width: 200 }}
                            value={c.description}
                            onChange={(e) => updateCandidate(i, 'description', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            style={{ width: 160 }}
                            value={c.spatial_composition}
                            onChange={(e) => updateCandidate(i, 'spatial_composition', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            style={{ width: 100 }}
                            value={c.equipment}
                            onChange={(e) => updateCandidate(i, 'equipment', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            style={{ width: 160 }}
                            value={c.setup_notes}
                            onChange={(e) => updateCandidate(i, 'setup_notes', e.target.value)}
                          />
                        </td>
                        <td className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                          {Number.isInteger(c.marker_line) ? `line ${c.marker_line}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          {candidates && candidates.length > 0 && (
            <button className="btn" disabled={committing || includedCount === 0} onClick={handleCommit}>
              {committing ? 'Adding...' : `Add ${includedCount} Shot${includedCount === 1 ? '' : 's'}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
