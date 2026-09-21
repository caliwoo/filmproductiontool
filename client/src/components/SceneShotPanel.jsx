import { useEffect, useState } from 'react';
import api from '../api.js';
import ScreenplayView from './ScreenplayView.jsx';
import ShotList from './ShotList.jsx';

export default function SceneShotPanel({ scene }) {
  const [open, setOpen] = useState(false);
  const [shots, setShots] = useState([]);
  const hasFormattedScript = Array.isArray(scene.script_elements) && scene.script_elements.length > 0;

  function loadShots() {
    api.get(`/shots?sceneId=${scene.id}`).then(setShots);
  }

  useEffect(() => {
    if (open) loadShots();
  }, [open, scene.id]);

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
            <ScreenplayView elements={scene.script_elements} tags={scene.elements} shots={shots} />
          ) : (
            <div className="screenplay-view">
              <p className="action">{scene.synopsis || 'No scene text captured yet.'}</p>
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <ShotList sceneId={scene.id} shots={shots} onChange={loadShots} />
          </div>
        </div>
      )}
    </div>
  );
}
