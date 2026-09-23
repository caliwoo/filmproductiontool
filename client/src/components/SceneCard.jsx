import { useState } from 'react';
import api from '../api.js';
import AiTagDialog from './AiTagDialog.jsx';
import PageLengthInput from './PageLengthInput.jsx';
import ScreenplayView from './ScreenplayView.jsx';
import { formatPageLength } from '../pageLength.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

const CATEGORIES = ['cast', 'stunts', 'extras', 'props', 'wardrobe', 'vehicles', 'sfx', 'vfx', 'sound', 'makeup', 'animals', 'notes'];

export default function SceneCard({ scene, locations, onChange, onDelete }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [tagCategory, setTagCategory] = useState('cast');
  const [tagValue, setTagValue] = useState('');
  const [error, setError] = useState('');
  const [showAiTag, setShowAiTag] = useState(false);
  const [showNewLocation, setShowNewLocation] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');
  const [editingSynopsis, setEditingSynopsis] = useState(false);
  const [editingLocationName, setEditingLocationName] = useState(false);
  const [locationNameInput, setLocationNameInput] = useState('');

  const hasFormattedScript = Array.isArray(scene.script_elements) && scene.script_elements.length > 0;
  const hasBreakdown = Array.isArray(scene.elements) && scene.elements.length > 0;

  const location = locations.find((l) => l.id === scene.location_id);
  // A location that's merely linked isn't "ready" until it has a real name --
  // the auto-created placeholder from script import is just a bucket for the
  // scene's set, not an actual scouted/booked location yet.
  const hasLocation = Boolean(location && location.name);

  async function updateField(field, value) {
    try {
      await api.put(`/scenes/${scene.id}`, { [field]: value });
      onChange();
    } catch (err) {
      setError(err.message);
    }
  }

  async function addTag(e) {
    e.preventDefault();
    if (!tagValue.trim()) return;
    try {
      await api.post(`/scenes/${scene.id}/elements`, { category: tagCategory, value: tagValue });
      setTagValue('');
      onChange();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeTag(elementId) {
    await api.del(`/scenes/elements/${elementId}`);
    onChange();
  }

  async function handleAddLocation(e) {
    e.preventDefault();
    const name = newLocationName.trim();
    if (!name) return;
    try {
      // If the scene is already pointed at a placeholder (auto-created from
      // the script heading, no real name yet), name that one in place --
      // same as the pencil next to the heading -- instead of creating a
      // separate location and leaving the placeholder behind, unused.
      if (location && !location.name) {
        await api.put(`/locations/${location.id}`, { name });
      } else {
        const newLoc = await api.post('/locations', { project_id: scene.project_id, name });
        await api.put(`/scenes/${scene.id}`, { location_id: newLoc.id });
      }
      setNewLocationName('');
      setShowNewLocation(false);
      onChange();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEditingLocationName() {
    setLocationNameInput(location.name);
    setEditingLocationName(true);
  }

  async function saveLocationName() {
    const trimmed = locationNameInput.trim();
    setEditingLocationName(false);
    if (trimmed === location.name) return;
    try {
      await api.put(`/locations/${location.id}`, { name: trimmed });
      onChange();
    } catch (err) {
      setError(err.message);
    }
  }

  // Stripboard color band -- a quick, at-a-glance read of a scene's INT/EXT
  // and DAY/NIGHT combination, the same convention an AD's stripboard uses.
  const isNight = scene.day_night === 'NIGHT' || scene.day_night === 'DUSK';
  const stripeColor = isNight
    ? scene.int_ext === 'EXT'
      ? 'var(--success)'
      : 'var(--text-muted)'
    : scene.int_ext === 'EXT'
    ? 'var(--warning)'
    : '#ffffff';
  const okIcon = 'M5 12.5l4.5 4.5L19 7.5';
  const pendingIcon = 'M12 7v5l3 2';

  return (
    <div className="scene-card">
      <div className="scene-number-block" style={{ '--stripe-color': stripeColor }}>
        {scene.scene_number}
      </div>
      <div className="scene-card-inner">
        <div className="scene-header" onClick={() => setOpen(!open)}>
          <div className="scene-meta-row">
            <span className="scene-heading-text">
              {scene.int_ext}. {scene.heading} - {scene.day_night}
            </span>
            <div className="scene-meta-line">
              {location ? (
                editingLocationName ? (
                  <input
                    autoFocus
                    className="scene-slug-input"
                    value={locationNameInput}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setLocationNameInput(e.target.value)}
                    onBlur={saveLocationName}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.target.blur();
                      if (e.key === 'Escape') setEditingLocationName(false);
                    }}
                  />
                ) : (
                  <span className="scene-slug">
                    {location.name || t('sceneCard.unnamed')}
                    <button
                      className="icon-btn scene-slug-edit-btn"
                      title={t('sceneCard.renameLocationTooltip')}
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditingLocationName();
                      }}
                    >
                      ✎
                    </button>
                  </span>
                )
              ) : (
                <span className="scene-slug">{t('sceneCard.noSetAssigned')}</span>
              )}
              <span className="scene-pages">
                {formatPageLength(scene.page_count)} {t('sceneCard.pagesSuffix')}
              </span>
            </div>
          </div>
          <div className="scene-actions">
            <span
              className={`readiness-badge ${hasLocation ? 'ready' : 'pending'}`}
              title={
                hasLocation
                  ? t('sceneCard.locationReadyTooltip', { name: location.name })
                  : location
                  ? t('sceneCard.locationUnnamedTooltip')
                  : t('sceneCard.locationNoneTooltip')
              }
            >
              <svg className="pill-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d={hasLocation ? okIcon : pendingIcon} />
              </svg>
              {t('sceneCard.locationBadge')}
            </span>
            <span
              className={`readiness-badge ${hasBreakdown ? 'ready' : 'pending'}`}
              title={
                hasBreakdown
                  ? t('sceneCard.breakdownReadyTooltip', { count: scene.elements.length })
                  : t('sceneCard.breakdownPendingTooltip')
              }
            >
              <svg className="pill-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d={hasBreakdown ? okIcon : pendingIcon} />
              </svg>
              {t('sceneCard.breakdownBadge')}
            </span>
            <button
              type="button"
              className={`pill shot-toggle ${scene.status === 'shot' ? 'is-shot' : 'is-pending'}`}
              onClick={(e) => {
                e.stopPropagation();
                updateField('status', scene.status === 'shot' ? 'not_shot' : 'shot');
              }}
            >
              <span className="shot-toggle-dot" />
              {scene.status === 'shot' ? t('sceneCard.shot') : t('sceneCard.notShot')}
            </button>
            <a
              className="pdf-pill"
              style={{
                opacity: hasBreakdown ? 1 : 0.6,
                pointerEvents: hasBreakdown ? 'auto' : 'none',
              }}
              href={hasBreakdown ? `/api/scenes/${scene.id}/breakdown-pdf` : undefined}
              onClick={(e) => e.stopPropagation()}
              title={hasBreakdown ? t('sceneCard.pdfBreakdownReadyTooltip') : t('sceneCard.pdfBreakdownPendingTooltip')}
              aria-disabled={!hasBreakdown}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 3h7l5 5v13H7zM14 3v5h5" />
              </svg>
              {t('sceneCard.pdfBreakdown')}
            </a>
            <button
              className="icon-btn"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(scene.id);
              }}
              title={t('sceneCard.deleteSceneTooltip')}
            >
              ✕
            </button>
          </div>
        </div>

        {open && (
        <div className="scene-body">
          {error && <div className="error-banner">{error}</div>}

          <div className="inline-form">
            <input
              placeholder={t('sceneCard.scenePlaceholder')}
              style={{ flex: '0 0 70px' }}
              defaultValue={scene.scene_number}
              onBlur={(e) => updateField('scene_number', e.target.value)}
            />
            <select defaultValue={scene.int_ext} onChange={(e) => updateField('int_ext', e.target.value)}>
              <option value="INT">INT</option>
              <option value="EXT">EXT</option>
              <option value="INT/EXT">INT/EXT</option>
            </select>
            <input
              placeholder={t('sceneCard.headingPlaceholder')}
              style={{ flex: 2 }}
              defaultValue={scene.heading}
              onBlur={(e) => updateField('heading', e.target.value)}
            />
            <select defaultValue={scene.day_night} onChange={(e) => updateField('day_night', e.target.value)}>
              <option value="DAY">DAY</option>
              <option value="NIGHT">NIGHT</option>
              <option value="DAWN">DAWN</option>
              <option value="DUSK">DUSK</option>
            </select>
            <select
              key={scene.location_id || 'none'}
              defaultValue={location && location.name ? scene.location_id : ''}
              onChange={(e) => updateField('location_id', e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">{t('sceneCard.noLocationOption')}</option>
              {locations
                .filter((l) => l.name)
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
            </select>
            {!showNewLocation ? (
              <button
                type="button"
                className="icon-btn"
                title={t('sceneCard.addLocationTooltip')}
                onClick={() => setShowNewLocation(true)}
                style={{ fontSize: 18, fontWeight: 700, flex: '0 0 auto' }}
              >
                +
              </button>
            ) : (
              <>
                <input
                  autoFocus
                  placeholder={t('sceneCard.newLocationPlaceholder')}
                  style={{ flex: 1 }}
                  value={newLocationName}
                  onChange={(e) => setNewLocationName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddLocation(e);
                    if (e.key === 'Escape') {
                      setShowNewLocation(false);
                      setNewLocationName('');
                    }
                  }}
                />
                <button type="button" className="btn btn-secondary" onClick={handleAddLocation}>
                  {t('sceneCard.add')}
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  title={t('sceneCard.cancelTooltip')}
                  onClick={() => {
                    setShowNewLocation(false);
                    setNewLocationName('');
                  }}
                >
                  ✕
                </button>
              </>
            )}
            <select defaultValue={scene.status} onChange={(e) => updateField('status', e.target.value)}>
              <option value="not_shot">{t('sceneCard.notShot')}</option>
              <option value="shot">{t('sceneCard.shot')}</option>
            </select>
            <PageLengthInput
              value={scene.page_count}
              remountKey={`${scene.id}-${scene.page_count}`}
              onCommit={(decimal) => updateField('page_count', decimal)}
            />
          </div>

          {!scene.location_id && (
            <p className="muted" style={{ marginTop: 4 }}>
              {t('sceneCard.noLocationHelp')}
            </p>
          )}
          {scene.location_id && !hasLocation && (
            <p className="muted" style={{ marginTop: 4 }}>
              {t('sceneCard.unnamedLocationHelp')}
            </p>
          )}

          {hasFormattedScript && !editingSynopsis ? (
            <div style={{ marginTop: 10 }}>
              <ScreenplayView elements={scene.script_elements} tags={scene.elements} />
              <button
                type="button"
                className="btn btn-secondary"
                style={{ marginTop: 8, fontSize: 12, padding: '5px 10px' }}
                onClick={() => setEditingSynopsis(true)}
              >
                {t('sceneCard.editText')}
              </button>
            </div>
          ) : (
            <textarea
              placeholder={t('sceneCard.synopsisPlaceholder')}
              style={{ width: '100%', marginTop: 10, minHeight: 50 }}
              defaultValue={scene.synopsis}
              onBlur={(e) => {
                updateField('synopsis', e.target.value);
                setEditingSynopsis(false);
              }}
            />
          )}

          <div className="section-label flex-row" style={{ justifyContent: 'space-between' }}>
            <span>{t('sceneCard.breakdownElementsLabel')}</span>
            <button
              className="btn btn-secondary"
              onClick={() => setShowAiTag(true)}
              style={{ fontWeight: 600, textTransform: 'none', letterSpacing: 'normal', fontSize: 13 }}
            >
              ✨ {t('sceneCard.aiSelect')}
            </button>
          </div>

          {showAiTag && (
            <AiTagDialog
              sceneId={scene.id}
              onClose={() => setShowAiTag(false)}
              onCommitted={() => {
                setShowAiTag(false);
                onChange();
              }}
            />
          )}

          <div className="element-tags">
            {scene.elements.map((el) => (
              <span className={`tag ${el.category}`} key={el.id}>
                {el.value}
                <button onClick={() => removeTag(el.id)}>✕</button>
              </span>
            ))}
            {scene.elements.length === 0 && <span className="muted">{t('sceneCard.noElementsTagged')}</span>}
          </div>
          <form className="inline-form" onSubmit={addTag}>
            <select value={tagCategory} onChange={(e) => setTagCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              placeholder={t('sceneCard.elementPlaceholder')}
              style={{ flex: 2 }}
              value={tagValue}
              onChange={(e) => setTagValue(e.target.value)}
            />
            <button type="submit" className="btn btn-secondary">
              {t('sceneCard.tagElement')}
            </button>
          </form>
        </div>
        )}
      </div>
    </div>
  );
}
