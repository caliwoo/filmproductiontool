import { useState } from 'react';
import api from '../api.js';
import { SCHEDULE_RULES } from '../scheduleRules.js';

export default function BuildScheduleDialog({ projectId, onClose, onApplied }) {
  const [pagesPerDay, setPagesPerDay] = useState(5);
  const [startDate, setStartDate] = useState('');
  const [workDaysPerWeek, setWorkDaysPerWeek] = useState(5);
  const [ruleKey, setRuleKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [preview, setPreview] = useState(null);
  const [excludedScenes, setExcludedScenes] = useState([]);
  const [existingDaysCount, setExistingDaysCount] = useState(0);
  const [error, setError] = useState('');

  const selectedRule = SCHEDULE_RULES.find((r) => r.key === ruleKey) || null;

  async function handleGenerate() {
    setLoading(true);
    setError('');
    try {
      const result = await api.post(`/projects/${projectId}/build-schedule/preview`, {
        pagesPerDay,
        startDate: startDate || null,
        workDaysPerWeek,
      });
      setPreview(result.days);
      setExcludedScenes(result.excludedScenes || []);
      setExistingDaysCount(result.existingDaysCount);
    } catch (err) {
      setError(err.message);
      setExcludedScenes((err.data && err.data.excludedScenes) || []);
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
            Automatically groups your scenes by location (exterior locations first, for weather buffer), then, among
            tied locations, clusters ones sharing lead cast (flagged in Cast &amp; Crew) so their days fall close
            together instead of spread out with gaps. Orders by complexity, keeps DAY and NIGHT scenes on separate
            days, and caps each day at a target page count. Only scenes with at least one tagged breakdown element{' '}
            <em>and</em> at least one shot are included. It doesn&apos;t know actor availability, legal minor hours,
            or weather forecasts &mdash; review the result before locking it in.
          </p>

          {error && <div className="error-banner">{error}</div>}

          {excludedScenes.length > 0 && (
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="section-label" style={{ margin: '0 0 6px' }}>
                {excludedScenes.length} scene{excludedScenes.length === 1 ? '' : 's'} skipped (not ready yet)
              </div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {excludedScenes.map((s) => (
                  <li key={s.scene_id} style={{ fontSize: 13 }}>
                    Scene {s.scene_number}. {s.heading} &mdash; <span className="muted">{s.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!preview && (
            <>
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
                <label className="flex-row" style={{ gap: 6 }}>
                  Start date (optional):
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </label>
              </div>

              <div className="inline-form">
                <label className="flex-row" style={{ gap: 6 }}>
                  Workweek:
                  <select value={workDaysPerWeek} onChange={(e) => setWorkDaysPerWeek(Number(e.target.value))}>
                    <option value={5}>5-day week (Mon&ndash;Fri, weekends off)</option>
                    <option value={6}>6-day week (Mon&ndash;Sat, Sunday off)</option>
                  </select>
                </label>
                <label className="flex-row" style={{ gap: 6, flex: 1 }}>
                  Rest-period rules:
                  <select style={{ flex: 1 }} value={ruleKey} onChange={(e) => setRuleKey(e.target.value)}>
                    <option value="">None / general reference only</option>
                    {SCHEDULE_RULES.map((r) => (
                      <option key={r.key} value={r.key}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {selectedRule && (
                <div className="card" style={{ marginTop: 10, fontSize: 13 }}>
                  <div style={{ marginBottom: 4 }}>
                    <strong>Daily rest:</strong> {selectedRule.dailyRest}
                  </div>
                  <div style={{ marginBottom: 4 }}>
                    <strong>Weekly rest ({workDaysPerWeek}-day week):</strong> {selectedRule.weeklyRest[workDaysPerWeek]}
                  </div>
                  <div className="muted">Source: {selectedRule.source}</div>
                </div>
              )}

              {startDate ? null : (
                <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                  Leave the start date blank to schedule without calendar dates &mdash; set them later on each shoot
                  day.
                </p>
              )}

              <div className="inline-form">
                <button className="btn" onClick={handleGenerate} disabled={loading}>
                  {loading ? 'Generating...' : 'Generate Schedule'}
                </button>
              </div>
            </>
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
              {selectedRule && (
                <div className="card" style={{ marginBottom: 10, fontSize: 13 }}>
                  <strong>Reminder &mdash; {selectedRule.label}:</strong> daily rest {selectedRule.dailyRest} Weekly
                  rest ({workDaysPerWeek}-day week): {selectedRule.weeklyRest[workDaysPerWeek]} This isn&apos;t
                  enforced automatically &mdash; the schedule doesn&apos;t track call/wrap times precisely enough to
                  check it, so review actual call times against this before locking the schedule.
                </div>
              )}
              {preview.map((day) => (
                <div className="card" key={day.day_number} style={{ marginBottom: 10 }}>
                  <div className="flex-row" style={{ justifyContent: 'space-between' }}>
                    <strong>
                      Day {day.day_number}
                      {day.shoot_date ? ` · ${day.shoot_date}` : ''} &middot;{' '}
                      {day.day_night === 'night' ? 'NIGHT' : 'DAY'} &middot; Call {day.general_call_time}
                    </strong>
                    <span className="muted">
                      {day.location_name || 'No location'} &middot; {day.total_pages} pages
                    </span>
                  </div>
                  {day.lead_cast && day.lead_cast.length > 0 && (
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      Lead cast: {day.lead_cast.join(', ')}
                    </div>
                  )}
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
