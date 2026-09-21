import { useRef, useState } from 'react';
import api from '../api.js';
import ScriptSceneReviewTable from './ScriptSceneReviewTable.jsx';

export default function ScriptImportDialog({ projectId, onClose, onImported }) {
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
          <h3>Import Scenes from Script (PDF)</h3>
          <button className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          {!scenes && (
            <div className="upload-drop">
              <p className="muted">
                Upload a screenplay PDF. We&apos;ll scan it for scene headings (e.g. <code>INT. HOUSE - DAY</code>)
                and detect each scene, numbering any that don&apos;t already have one.
              </p>
              <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFileChange} />
              {parsing && <p className="muted">Parsing {fileName}...</p>}
            </div>
          )}

          {scenes && (
            <>
              <p className="muted">
                Detected {scenes.length} scene{scenes.length === 1 ? '' : 's'} in {fileName}. Review and edit before
                importing &mdash; uncheck any that were misdetected. Page lengths are estimated from where each scene
                falls in the PDF; adjust any that look off.
              </p>
              <ScriptSceneReviewTable scenes={scenes} onUpdateScene={updateScene} />
            </>
          )}
        </div>

        <div className="modal-footer">
          {/* Rendered in the footer, not the scrollable body, so an error from a
              long scene list stays visible without scrolling back up to see it. */}
          {error && <div className="error-banner" style={{ marginRight: 'auto' }}>{error}</div>}
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          {scenes && (
            <button className="btn" disabled={importing || includedCount === 0} onClick={handleImport}>
              {importing ? 'Importing...' : `Import ${includedCount} Scene${includedCount === 1 ? '' : 's'}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
