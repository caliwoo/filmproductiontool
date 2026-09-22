import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api.js';
import PageLengthInput from './PageLengthInput.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';

export default function DayCard({
  day,
  dayNumber,
  dayIndex,
  assigned,
  allScenes,
  castNumberByName,
  onChange,
  onReloadDay,
  onDelete,
  draggingDayId,
  draggingScene,
  onStartDayDrag,
  onStartSceneDrag,
}) {
  const { t } = useLanguage();
  const [sceneToAdd, setSceneToAdd] = useState('');
  const [error, setError] = useState('');

  const assignedIds = new Set(assigned.map((s) => s.id));
  const available = allScenes.filter((s) => !assignedIds.has(s.id));

  async function updateField(field, value) {
    try {
      await api.put(`/shoot-days/${day.id}`, { [field]: value });
      onChange();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAssign(e) {
    e.preventDefault();
    if (!sceneToAdd) return;
    try {
      await api.post(`/shoot-days/${day.id}/scenes`, { scene_id: Number(sceneToAdd) });
      setSceneToAdd('');
      onReloadDay();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleUnassign(assignmentId) {
    await api.del(`/shoot-days/scenes/${assignmentId}`);
    onReloadDay();
  }

  async function updateScenePages(sceneId, decimal) {
    await api.put(`/scenes/${sceneId}`, { page_count: decimal });
    onReloadDay();
  }

  async function updateEstimation(assignmentId, hoursStr) {
    const hours = Number(hoursStr);
    if (Number.isNaN(hours) || hours < 0) return;
    await api.put(`/shoot-days/scenes/${assignmentId}`, { estimated_minutes: Math.round(hours * 60) });
    onReloadDay();
  }

  function castIdsFor(scene) {
    return (scene.cast || [])
      .map((name) => castNumberByName[name.trim().toUpperCase()])
      .filter((n) => n !== undefined)
      .sort((a, b) => a - b);
  }

  return (
    <div
      className={`day-card ${draggingDayId === day.id ? 'dragging' : ''}`}
      data-day-card
      data-day-id={day.id}
      data-day-index={dayIndex}
    >
      <div className="day-card-header">
        <div className="flex-row" style={{ alignItems: 'flex-start', gap: 10 }}>
          <span
            className="drag-handle"
            title={t('dayCard.dragReorderDaysTooltip')}
            onMouseDown={(e) => {
              e.preventDefault();
              onStartDayDrag(e.clientX, e.clientY);
            }}
          >
            ⠿
          </span>
          <div>
            <h3>{t('dayCard.dayLabel', { number: dayNumber })}</h3>
            <div className="day-meta">
              {day.shoot_date || t('dayCard.noDateSet')} &middot; {t('dayCard.call')} {day.general_call_time || '—'}
            </div>
          </div>
        </div>
        <div className="flex-row">
          <Link className="btn btn-secondary" to={`${day.id}/call-sheet`}>
            {t('dayCard.viewCallSheet')}
          </Link>
          <button className="icon-btn" onClick={() => onDelete(day.id)} title={t('dayCard.deleteDayTooltip')}>
            ✕
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="inline-form">
        <input
          type="date"
          defaultValue={day.shoot_date}
          onBlur={(e) => updateField('shoot_date', e.target.value)}
        />
        <input
          type="time"
          defaultValue={day.general_call_time}
          onBlur={(e) => updateField('general_call_time', e.target.value)}
        />
        <input
          placeholder={t('dayCard.weatherPlaceholder')}
          defaultValue={day.weather}
          onBlur={(e) => updateField('weather', e.target.value)}
        />
      </div>

      <div className="section-label">{t('dayCard.scenesOnThisDay')}</div>
      {assigned.length > 0 && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th></th>
                <th>{t('dayCard.columns.number')}</th>
                <th>{t('dayCard.columns.sceneSetting')}</th>
                <th>{t('dayCard.columns.castId')}</th>
                <th>{t('dayCard.columns.pages')}</th>
                <th>{t('dayCard.columns.estimationHours')}</th>
                <th>{t('dayCard.columns.location')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {assigned.map((scene, i) => (
                <tr
                  className={draggingScene && draggingScene.assignmentId === scene.assignment_id ? 'dragging' : ''}
                  key={scene.assignment_id}
                  data-scene-row
                  data-day-id={day.id}
                  data-row-index={i}
                >
                  <td>
                    <span
                      className="drag-handle"
                      title={t('dayCard.dragReorderSceneTooltip')}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        onStartSceneDrag(
                          scene.assignment_id,
                          `${scene.scene_number}. ${scene.heading}`,
                          e.clientX,
                          e.clientY
                        );
                      }}
                    >
                      ⠿
                    </span>
                  </td>
                  <td>{scene.scene_number}</td>
                  <td>
                    <strong>
                      {scene.int_ext}. {scene.heading} &ndash; {scene.day_night}
                    </strong>
                    {scene.synopsis && (
                      <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                        {scene.synopsis.length > 90 ? `${scene.synopsis.slice(0, 90)}...` : scene.synopsis}
                      </div>
                    )}
                    {scene.scheduled_time && <div className="muted" style={{ fontSize: 12 }}>@ {scene.scheduled_time}</div>}
                  </td>
                  <td>{castIdsFor(scene).join(', ') || '—'}</td>
                  <td>
                    <PageLengthInput
                      value={scene.page_count}
                      remountKey={`${scene.id}-${scene.page_count}`}
                      onCommit={(decimal) => updateScenePages(scene.id, decimal)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      style={{ width: 60 }}
                      defaultValue={Number(scene.estimated_minutes || 60) / 60}
                      onBlur={(e) => updateEstimation(scene.assignment_id, e.target.value)}
                    />
                  </td>
                  <td>{scene.location_name || '—'}</td>
                  <td>
                    <button className="icon-btn" onClick={() => handleUnassign(scene.assignment_id)}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {assigned.length === 0 && <p className="muted">{t('dayCard.noScenesAssigned')}</p>}

      <form className="inline-form" onSubmit={handleAssign}>
        <select value={sceneToAdd} onChange={(e) => setSceneToAdd(e.target.value)}>
          <option value="">{t('dayCard.addSceneOption')}</option>
          {available.map((s) => (
            <option key={s.id} value={s.id}>
              {s.scene_number}. {s.heading}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn-secondary">
          {t('dayCard.assign')}
        </button>
      </form>
    </div>
  );
}
