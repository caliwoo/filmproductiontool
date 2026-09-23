import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../api.js';
import { SCHEDULE_RULES } from '../scheduleRules.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

export default function SettingsPage() {
  const { t } = useLanguage();
  const { projectId, project, refreshProject } = useOutletContext();
  const [workDaysPerWeek, setWorkDaysPerWeek] = useState(5);
  const [ruleKey, setRuleKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!project) return;
    setWorkDaysPerWeek(project.work_days_per_week === 6 ? 6 : 5);
    setRuleKey(project.schedule_rule_key || '');
  }, [project]);

  const selectedRule = SCHEDULE_RULES.find((r) => r.key === ruleKey) || null;

  async function save(next) {
    setError('');
    setSaved(false);
    try {
      await api.put(`/projects/${projectId}`, {
        work_days_per_week: next.workDaysPerWeek,
        schedule_rule_key: next.ruleKey || '',
      });
      await refreshProject();
      setSaved(true);
    } catch (err) {
      setError(err.message);
    }
  }

  function handleWorkweekChange(days) {
    setWorkDaysPerWeek(days);
    save({ workDaysPerWeek: days, ruleKey });
  }

  function handleRuleChange(e) {
    const key = e.target.value;
    setRuleKey(key);
    save({ workDaysPerWeek, ruleKey: key });
  }

  return (
    <div>
      <div className="page-header">
        <h2>{t('settingsPage.title')}</h2>
      </div>
      {error && <div className="error-banner">{error}</div>}

      <div className="section-label">{t('settingsPage.schedulingSection')}</div>
      <div className="card">
        <p className="muted" style={{ marginTop: 0 }}>{t('settingsPage.schedulingDescription')}</p>

        <label className="section-label" style={{ margin: '16px 0 8px' }}>
          {t('buildScheduleDialog.workweek')}
        </label>
        <div className="segmented">
          <button
            type="button"
            className={workDaysPerWeek === 5 ? 'active' : ''}
            onClick={() => handleWorkweekChange(5)}
          >
            {t('buildScheduleDialog.week5')}
          </button>
          <button
            type="button"
            className={workDaysPerWeek === 6 ? 'active' : ''}
            onClick={() => handleWorkweekChange(6)}
          >
            {t('buildScheduleDialog.week6')}
          </button>
        </div>

        <label className="section-label" style={{ margin: '20px 0 8px' }}>
          {t('buildScheduleDialog.restPeriodRules')}
        </label>
        <select value={ruleKey} onChange={handleRuleChange} style={{ maxWidth: 420, width: '100%' }}>
          <option value="">{t('buildScheduleDialog.noneGeneralReference')}</option>
          {SCHEDULE_RULES.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
        </select>

        {selectedRule && (
          <div className="card" style={{ marginTop: 12, fontSize: 13 }}>
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

        <p className="muted" style={{ fontSize: 12, marginTop: 16, marginBottom: 0 }}>
          {saved ? t('settingsPage.savedNote') : t('settingsPage.appliesNote')}
        </p>
      </div>
    </div>
  );
}
