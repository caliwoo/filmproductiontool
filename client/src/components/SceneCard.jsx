import { useState } from 'react';
import api from '../api.js';
import ShotList from './ShotList.jsx';
import AiTagDialog from './AiTagDialog.jsx';

const CATEGORIES = ['cast', 'stunts', 'extras', 'props', 'wardrobe', 'vehicles', 'sfx', 'sound', 'makeup', 'animals', 'notes'];

export default function SceneCard({ scene, locations, onChange, onDelete }) {
  const [open, setOpen] = useState(false);
  const [tagCategory, setTagCategory] = useState('cast');
  const [tagValue, setTagValue] = useState('');
  const [error, setError] = useState('');
  const [showAiTag, setShowAiTag] = useState(false);

  const location = locations.find((l) => l.id === scene.location_id);

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

  return (
    <div className="scene-card">
      <div className="scene-header" onClick={() => setOpen(!open)}>
        <div>
          <span className="scene-heading-text">
            {scene.scene_number}. {scene.int_ext} {scene.heading} - {scene.day_night}
          </span>
          {location && <span className="scene-slug">{location.name}</span>}
        </div>
        <div className="flex-row">
          <span className={`badge ${scene.status}`}>{scene.status === 'shot' ? 'Shot' : 'Not shot'}</span>
          <a
            className="btn btn-secondary"
            style={{ fontSize: 12, padding: '5px 10px' }}
            href={`/api/scenes/${scene.id}/breakdown-pdf`}
            onClick={(e) => e.stopPropagation()}
            title="Download PDF breakdown sheet"
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
              defaultValue={scene.location_id || ''}
              onChange={(e) => updateField('location_id', e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">No location</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <select defaultValue={scene.status} onChange={(e) => updateField('status', e.target.value)}>
              <option value="not_shot">Not shot</option>
              <option value="shot">Shot</option>
            </select>
          </div>

          {!scene.location_id && (
            <p className="muted" style={{ marginTop: 4 }}>
              No location selected — pick one above and it will automatically fill in on the call sheet and PDF
              breakdown sheet for this scene.
            </p>
          )}

          <textarea
            placeholder="Synopsis"
            style={{ width: '100%', marginTop: 10, minHeight: 50 }}
            defaultValue={scene.synopsis}
            onBlur={(e) => updateField('synopsis', e.target.value)}
          />

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

          <ShotList sceneId={scene.id} />
        </div>
      )}
    </div>
  );
}
