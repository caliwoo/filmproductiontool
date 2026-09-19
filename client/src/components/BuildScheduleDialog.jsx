import { useState } from 'react';
import api from '../api.js';

export default function BuildScheduleDialog({ projectId, onClose, onApplied }) {
  const [pagesPerDay, setPagesPerDay] = useState(5);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [preview, setPreview] = useState(null);
  const [existingDaysCount, setExistingDaysCount] = useState(0);
  const [error, setError] = useState('');

  async function handleGenerate() {
    setLoading(true);
    setError('');
    try {
      const result = await api.post(`/projects/${projectId}/build-schedule/preview`, { pagesPerDay });
      setPreview(result.days);
      setExistingDaysCount(result.existingDaysCount);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleApply() {
    setApplying(true);
    setError('');
    try {
      await api.post(`/projects/${projectId}/build-schedule/commit`, { days: preview });
      onApplied();
    } catch (err) {
      setError(err.message);
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 760 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Build Shooting Schedule</h3>
          <button className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <p className="muted">
            Automatically groups your scenes by location (exterior locations first, for weather buffer), orders them
            by complexity, keeps DAY and NIGHT scenes on separate days, and caps each day at a target page count.
            It doesn&apos;t know actor availability, legal minor hours, or weather forecasts &mdash; review the
            result before locking it in.
          </p>

          {error && <div className="error-banner">{error}</div>}

          {!preview && (
            <div className="inline-form">
              <label className="flex-row" style={{ gap: 6 }}>
                Pages per day:
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  style={{ width: 70 }}
                  value={pagesPerDay}
                  onChange={(e) => setPagesPerDay(Number(e.target.value))}
                />
              </label>
              <button className="btn" onClick={handleGenerate} disabled={loading}>
                {loading ? 'Generating...' : 'Generate Schedule'}
              </button>
            </div>
          )}

          {preview && (
            <>
              {existingDaysCount > 0 && (
                <div className="error-banner" style={{ background: '#fef3c7', color: '#92400e' }}>
                  Applying this will replace your current schedule ({existingDaysCount} existing shoot day
                  {existingDaysCount === 1 ? '' : 's'}).
                </div>
              )}
              <p className="muted">{preview.length} shoot day(s) proposed.</p>
              {preview.map((day) => (
                <div className="card" key={day.day_number} style={{ marginBottom: 10 }}>
                  <div className="flex-row" style={{ justifyContent: 'space-between' }}>
                    <strong>
                      Day {day.day_number} &middot; {day.day_night === 'night' ? 'NIGHT' : 'DAY'} &middot; Call{' '}
                      {day.general_call_time}
                    </strong>
                    <span className="muted">
                      {day.location_name || 'No location'} &middot; {day.total_pages} pages
                    </span>
                  </div>
                  <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                    {day.scenes.map((s) => (
                      <li key={s.scene_id} style={{ fontSize: 13 }}>
                        {s.scheduled_time} &mdash; Scene {s.scene_number}. {s.int_ext} {s.heading} - {s.day_night} (
                        {s.page_count}p)
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <button className="btn btn-secondary" onClick={() => setPreview(null)}>
                &larr; Adjust and regenerate
              </button>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          {preview && (
            <button className="btn btn-danger" onClick={handleApply} disabled={applying}>
              {applying ? 'Applying...' : `Apply Schedule${existingDaysCount > 0 ? ' (replaces existing)' : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
