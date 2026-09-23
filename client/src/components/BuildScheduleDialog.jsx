import { useState } from 'react';
import api from '../api.js';
import { SCHEDULE_RULES } from '../scheduleRules.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

export default function BuildScheduleDialog({ projectId, onClose, onApplied }) {
  const { t } = useLanguage();
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
          <h3>{t('buildScheduleDialog.title')}</h3>
          <button className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <p className="muted">{t('buildScheduleDialog.description')}</p>

          {error && <div className="error-banner">{error}</div>}

          {excludedScenes.length > 0 && (
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="section-label" style={{ margin: '0 0 6px' }}>
                {t('buildScheduleDialog.scenesSkipped', { count: excludedScenes.length })}
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
                  {t('buildScheduleDialog.pagesPerDay')}
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
                  {t('buildScheduleDialog.startDateOptional')}
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </label>
              </div>

              <div className="inline-form">
                <label className="flex-row" style={{ gap: 6 }}>
                  {t('buildScheduleDialog.workweek')}
                  <select value={workDaysPerWeek} onChange={(e) => setWorkDaysPerWeek(Number(e.target.value))}>
                    <option value={5}>{t('buildScheduleDialog.week5')}</option>
                    <option value={6}>{t('buildScheduleDialog.week6')}</option>
                  </select>
                </label>
                <label className="flex-row" style={{ gap: 6, flex: 1 }}>
                  {t('buildScheduleDialog.restPeriodRules')}
                  <select style={{ flex: 1 }} value={ruleKey} onChange={(e) => setRuleKey(e.target.value)}>
                    <option value="">{t('buildScheduleDialog.noneGeneralReference')}</option>
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
                    <strong>{t('buildScheduleDialog.dailyRestLabel')}</strong> {selectedRule.dailyRest}
                  </div>
                  <div style={{ marginBottom: 4 }}>
                    <strong>{t('buildScheduleDialog.weeklyRestLabel', { week: workDaysPerWeek })}</strong>{' '}
                    {selectedRule.weeklyRest[workDaysPerWeek]}
                  </div>
                  <div className="muted">{t('buildScheduleDialog.source', { source: selectedRule.source })}</div>
                </div>
              )}

              {startDate ? null : (
                <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                  {t('buildScheduleDialog.leaveStartDateBlank')}
                </p>
              )}

              <div className="inline-form">
                <button className="btn" onClick={handleGenerate} disabled={loading}>
                  {loading ? t('buildScheduleDialog.generating') : t('buildScheduleDialog.generateSchedule')}
                </button>
              </div>
            </>
          )}

          {preview && (
            <>
              {existingDaysCount > 0 && (
                <div className="error-banner" style={{ background: 'rgba(255,209,64,.14)', color: 'var(--warning)' }}>
                  {t('buildScheduleDialog.existingDaysWarning', { count: existingDaysCount })}
                </div>
              )}
              <p className="muted">{t('buildScheduleDialog.daysProposed', { count: preview.length })}</p>
              {selectedRule && (
                <div className="card" style={{ marginBottom: 10, fontSize: 13 }}>
                  <strong>{t('buildScheduleDialog.reminderLabel', { rule: selectedRule.label })}</strong>{' '}
                  {t('buildScheduleDialog.reminderBody', {
                    dailyRest: selectedRule.dailyRest,
                    week: workDaysPerWeek,
                    weeklyRest: selectedRule.weeklyRest[workDaysPerWeek],
                  })}
                </div>
              )}
              {preview.map((day) => (
                <div className="card" key={day.day_number} style={{ marginBottom: 10 }}>
                  <div className="flex-row" style={{ justifyContent: 'space-between' }}>
                    <strong>
                      {t('dayCard.dayLabel', { number: day.day_number })}
                      {day.shoot_date ? ` · ${day.shoot_date}` : ''} &middot;{' '}
                      {day.day_night === 'night' ? t('buildScheduleDialog.night') : t('buildScheduleDialog.day')}{' '}
                      &middot; {t('buildScheduleDialog.call')} {day.general_call_time}
                    </strong>
                    <span className="muted">
                      {day.location_name || t('buildScheduleDialog.noLocation')} &middot; {day.total_pages}{' '}
                      {t('buildScheduleDialog.pagesSuffix')}
                    </span>
                  </div>
                  {day.lead_cast && day.lead_cast.length > 0 && (
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      {t('buildScheduleDialog.leadCast', { names: day.lead_cast.join(', ') })}
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
                {t('buildScheduleDialog.adjustRegenerate')}
              </button>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            {t('buildScheduleDialog.cancel')}
          </button>
          {preview && (
            <button className="btn btn-danger" onClick={handleApply} disabled={applying}>
              {applying
                ? t('buildScheduleDialog.applying')
                : existingDaysCount > 0
                ? t('buildScheduleDialog.applyScheduleReplaces')
                : t('buildScheduleDialog.applySchedule')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
