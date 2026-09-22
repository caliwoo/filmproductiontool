import { useState } from 'react';
import api from '../api.js';
import AiTagDialog from './AiTagDialog.jsx';
import PageLengthInput from './PageLengthInput.jsx';
import ScreenplayView from './ScreenplayView.jsx';
import { formatPageLength } from '../pageLength.js';

const CATEGORIES = ['cast', 'stunts', 'extras', 'props', 'wardrobe', 'vehicles', 'sfx', 'vfx', 'sound', 'makeup', 'animals', 'notes'];

export default function SceneCard({ scene, locations, onChange, onDelete }) {
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
      const newLoc = await api.post('/locations', { project_id: scene.project_id, name });
      await api.put(`/scenes/${scene.id}`, { location_id: newLoc.id });
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

  return (
    <div className="scene-card">
      <div className="scene-header" onClick={() => setOpen(!open)}>
        <div>
          <span className="scene-heading-text">
            {scene.scene_number}. {scene.int_ext} {scene.heading} - {scene.day_night}
          </span>
          {location &&
            (editingLocationName ? (
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
                {location.name || '(unnamed)'}
                <button
                  className="icon-btn scene-slug-edit-btn"
                  title="Rename this location"
                  onClick={(e) => {
                    e.stopPropagation();
                    startEditingLocationName();
                  }}
                >
                  ✎
                </button>
              </span>
            ))}
        </div>
        <div className="flex-row">
          <span
            className={`readiness-badge ${hasLocation ? 'ready' : 'pending'}`}
            title={
              hasLocation
                ? `Location: ${location.name}`
                : location
                ? 'Location not named yet — click the pencil next to it above'
                : 'No location selected yet'
            }
          >
            Location
          </span>
          <span
            className={`readiness-badge ${hasBreakdown ? 'ready' : 'pending'}`}
            title={hasBreakdown ? `${scene.elements.length} breakdown element${scene.elements.length === 1 ? '' : 's'} tagged` : 'No breakdown elements tagged yet'}
          >
            Breakdown
          </span>
          <span className="muted" style={{ fontSize: 12 }} title="Script length">
            {formatPageLength(scene.page_count)} pgs
          </span>
          <span className={`badge ${scene.status}`}>{scene.status === 'shot' ? 'Shot' : 'Not shot'}</span>
          <a
            className="btn btn-secondary"
            style={{
              fontSize: 12,
              padding: '5px 10px',
              opacity: hasBreakdown ? 1 : 0.6,
              pointerEvents: hasBreakdown ? 'auto' : 'none',
            }}
            href={hasBreakdown ? `/api/scenes/${scene.id}/breakdown-pdf` : undefined}
            onClick={(e) => e.stopPropagation()}
            title={hasBreakdown ? 'Download PDF breakdown sheet' : 'Tag at least one breakdown element first'}
            aria-disabled={!hasBreakdown}
          >
            PDF Breakdown
          </a>
          <button
            className="icon-btn"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(scene.id);
            }}
            title="Delete scene"
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
              placeholder="Scene #"
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
              placeholder="Heading / slugline"
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
              defaultValue={scene.location_id || ''}
              onChange={(e) => updateField('location_id', e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">No location</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name || `(unnamed — ${l.scene_heading || 'no heading'})`}
                </option>
              ))}
            </select>
            {!showNewLocation ? (
              <button
                type="button"
                className="icon-btn"
                title="Add a new location"
                onClick={() => setShowNewLocation(true)}
                style={{ fontSize: 18, fontWeight: 700, flex: '0 0 auto' }}
              >
                +
              </button>
            ) : (
              <>
                <input
                  autoFocus
                  placeholder="New location name"
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
                  Add
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  title="Cancel"
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
              <option value="not_shot">Not shot</option>
              <option value="shot">Shot</option>
            </select>
            <PageLengthInput
              value={scene.page_count}
              remountKey={`${scene.id}-${scene.page_count}`}
              onCommit={(decimal) => updateField('page_count', decimal)}
            />
          </div>

          {!scene.location_id && (
            <p className="muted" style={{ marginTop: 4 }}>
              No location selected — pick one above and it will automatically fill in on the call sheet and PDF
              breakdown sheet for this scene.
            </p>
          )}
          {scene.location_id && !hasLocation && (
            <p className="muted" style={{ marginTop: 4 }}>
              This location doesn't have a real name yet — click the pencil next to it above to name it.
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
                Edit text
              </button>
            </div>
          ) : (
            <textarea
              placeholder="Synopsis"
              style={{ width: '100%', marginTop: 10, minHeight: 50 }}
              defaultValue={scene.synopsis}
              onBlur={(e) => {
                updateField('synopsis', e.target.value);
                setEditingSynopsis(false);
              }}
            />
          )}

          <div className="section-label flex-row" style={{ justifyContent: 'space-between' }}>
            <span>Breakdown Elements</span>
            <button
              className="btn btn-secondary"
              onClick={() => setShowAiTag(true)}
              style={{ fontWeight: 600, textTransform: 'none', letterSpacing: 'normal', fontSize: 13 }}
            >
              ✨ AI Select
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
            {scene.elements.length === 0 && <span className="muted">No elements tagged yet.</span>}
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
              placeholder="Element name (e.g. JANE, Coffee Mug)"
              style={{ flex: 2 }}
              value={tagValue}
              onChange={(e) => setTagValue(e.target.value)}
            />
            <button type="submit" className="btn btn-secondary">
              Tag Element
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
