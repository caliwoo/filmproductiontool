import { useRef, useState } from 'react';
import api from '../api.js';
import ScriptSceneReviewTable from './ScriptSceneReviewTable.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';

export default function ScriptImportDialog({ projectId, onClose, onImported }) {
  const { t } = useLanguage();
  const fileInputRef = useRef(null);
  const [fileName, setFileName] = useState('');
  const [scenes, setScenes] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
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
    } catch (err) {
      setError(err.message);
    } finally {
      setParsing(false);
    }
  }

  function updateScene(index, field, value) {
    setScenes((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  }

  function toggleAllScenes(include) {
    setScenes((prev) => prev.map((s) => ({ ...s, include })));
  }

  async function handleImport() {
    const toImport = scenes.filter((s) => s.include);
    if (toImport.length === 0) return;
    setImporting(true);
    setError('');
    try {
      await api.post('/scripts/import', {
        project_id: projectId,
        scenes: toImport.map(({ include, ...s }) => s),
      });
      onImported();
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  const includedCount = scenes ? scenes.filter((s) => s.include).length : 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{t('scriptImportDialog.title')}</h3>
          <button className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          {!scenes && (
            <div className="upload-drop">
              <p className="muted">
                {t('scriptImportDialog.uploadInstructionsPre')} <code>INT. HOUSE - DAY</code>{' '}
                {t('scriptImportDialog.uploadInstructionsPost')}
              </p>
              <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFileChange} />
              {parsing && <p className="muted">{t('scriptImportDialog.parsing', { fileName })}</p>}
            </div>
          )}

          {scenes && (
            <>
              <p className="muted">{t('scriptImportDialog.detectedScenes', { count: scenes.length, fileName })}</p>
              <ScriptSceneReviewTable scenes={scenes} onUpdateScene={updateScene} onToggleAll={toggleAllScenes} />
            </>
          )}
        </div>

        <div className="modal-footer">
          {/* Rendered in the footer, not the scrollable body, so an error from a
              long scene list stays visible without scrolling back up to see it. */}
          {error && <div className="error-banner" style={{ marginRight: 'auto' }}>{error}</div>}
          <button className="btn btn-secondary" onClick={onClose}>
            {t('scriptImportDialog.cancel')}
          </button>
          {scenes && (
            <button className="btn" disabled={importing || includedCount === 0} onClick={handleImport}>
              {importing ? t('scriptImportDialog.importing') : t('scriptImportDialog.importScenes', { count: includedCount })}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
