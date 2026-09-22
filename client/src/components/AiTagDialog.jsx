import { useEffect, useState } from 'react';
import api from '../api.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

const CATEGORIES = ['cast', 'stunts', 'extras', 'props', 'wardrobe', 'vehicles', 'sfx', 'vfx', 'sound', 'makeup', 'animals', 'notes'];

export default function AiTagDialog({ sceneId, onClose, onCommitted }) {
  const { t } = useLanguage();
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
          <h3>{t('aiTagDialog.title')}</h3>
          <button className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          {loading && <p className="muted">{t('aiTagDialog.loadingText')}</p>}

          {error && (
            <div className="error-banner">
              {error}
              {notConfigured && (
                <div style={{ marginTop: 6 }}>
                  {t('aiTagDialog.apiKeyHintPre')} <code>ANTHROPIC_API_KEY</code> {t('aiTagDialog.apiKeyHintPost')}
                </div>
              )}
            </div>
          )}

          {!loading && !error && candidates && candidates.length === 0 && (
            <p className="empty-state">{t('aiTagDialog.noElementsFound')}</p>
          )}

          {!loading && candidates && candidates.length > 0 && (
            <>
              <p className="muted">{t('aiTagDialog.suggestedCount', { count: candidates.length })}</p>
              <table>
                <thead>
                  <tr>
                    <th></th>
                    <th>{t('aiTagDialog.columns.category')}</th>
                    <th>{t('aiTagDialog.columns.element')}</th>
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
            {t('aiTagDialog.cancel')}
          </button>
          {candidates && candidates.length > 0 && (
            <button className="btn" disabled={committing || includedCount === 0} onClick={handleCommit}>
              {committing ? t('aiTagDialog.adding') : t('aiTagDialog.addElements', { count: includedCount })}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
