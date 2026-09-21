import { useEffect, useState } from 'react';
import api from '../api.js';

const CATEGORIES = ['cast', 'stunts', 'extras', 'props', 'wardrobe', 'vehicles', 'sfx', 'sound', 'makeup', 'animals', 'notes'];

export default function AiTagDialog({ sceneId, onClose, onCommitted }) {
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
      .post(`/scenes/${sceneId}/ai-tag`, {})
      .then((result) => setCandidates(result.candidates.map((c) => ({ ...c, include: true }))))
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
      await api.post(`/scenes/${sceneId}/elements/bulk`, {
        elements: toAdd.map(({ category, value, quote }) => ({ category, value, quote })),
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
      <div className="modal-card" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>AI Select</h3>
          <button className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          {loading && <p className="muted">Reading the scene and suggesting elements...</p>}

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
            <p className="empty-state">No new elements found in this scene's text.</p>
          )}

          {!loading && candidates && candidates.length > 0 && (
            <>
              <p className="muted">
                Claude suggested {candidates.length} element{candidates.length === 1 ? '' : 's'} from this scene's
                text and heading. Review and edit before adding &mdash; uncheck anything that&apos;s wrong.
              </p>
              <table>
                <thead>
                  <tr>
                    <th></th>
                    <th>Category</th>
                    <th>Element</th>
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
                        <select value={c.category} onChange={(e) => updateCandidate(i, 'category', e.target.value)}>
                          {CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          style={{ width: '100%' }}
                          value={c.value}
                          onChange={(e) => updateCandidate(i, 'value', e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          {candidates && candidates.length > 0 && (
            <button className="btn" disabled={committing || includedCount === 0} onClick={handleCommit}>
              {committing ? 'Adding...' : `Add ${includedCount} Element${includedCount === 1 ? '' : 's'}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
