import { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';

export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  busyLabel,
  progressMessage,
  danger = true,
  onConfirm,
  onCancel,
}) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const resolvedTitle = title ?? t('confirmDialog.defaultTitle');
  const resolvedConfirmLabel = confirmLabel ?? t('confirmDialog.defaultConfirmLabel');
  const resolvedBusyLabel = busyLabel ?? t('confirmDialog.defaultBusyLabel');

  async function handleConfirm() {
    setBusy(true);
    setError('');
    try {
      await onConfirm();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{resolvedTitle}</h3>
          <button className="icon-btn" onClick={onCancel}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          {error && <div className="error-banner">{error}</div>}
          <p>{message}</p>
          {busy && progressMessage && (
            <p className="muted" style={{ marginTop: 8 }}>
              {progressMessage}
            </p>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel} disabled={busy}>
            {t('confirmDialog.cancel')}
          </button>
          <button className={`btn ${danger ? 'btn-danger' : ''}`} onClick={handleConfirm} disabled={busy}>
            {busy ? resolvedBusyLabel : resolvedConfirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
