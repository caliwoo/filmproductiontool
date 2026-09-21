import { useState } from 'react';
import ScreenplayView from './ScreenplayView.jsx';
import ShotList from './ShotList.jsx';

export default function SceneShotPanel({ scene }) {
  const [open, setOpen] = useState(false);
  const hasFormattedScript = Array.isArray(scene.script_elements) && scene.script_elements.length > 0;

  return (
    <div className="scene-card">
      <div className="scene-header" onClick={() => setOpen(!open)}>
        <span className="scene-heading-text">
          {scene.scene_number}. {scene.int_ext} {scene.heading} - {scene.day_night}
        </span>
      </div>

      {open && (
        <div className="scene-body">
          {hasFormattedScript ? (
            <ScreenplayView elements={scene.script_elements} tags={scene.elements} />
          ) : (
            <div className="screenplay-view">
              <p className="action">{scene.synopsis || 'No scene text captured yet.'}</p>
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <ShotList sceneId={scene.id} />
          </div>
        </div>
      )}
    </div>
  );
}
