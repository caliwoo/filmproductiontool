import { useEffect, useState } from 'react';
import api from '../api.js';
import ScreenplayView from './ScreenplayView.jsx';
import ShotList from './ShotList.jsx';

export default function SceneShotPanel({ scene, hasShots, onShotsChange }) {
  const [open, setOpen] = useState(false);
  const [shots, setShots] = useState([]);
  const hasFormattedScript = Array.isArray(scene.script_elements) && scene.script_elements.length > 0;

  function loadShots() {
    api.get(`/shots?sceneId=${scene.id}`).then(setShots);
  }

  useEffect(() => {
    if (open) loadShots();
  }, [open, scene.id]);

  // Keeps the page-level "Shot List" readiness badge (shown on this panel's
  // own collapsed header, via the hasShots prop) in sync once the panel has
  // actually loaded its shots -- guarded on `open` so the empty initial
  // `shots` state before that first load never overwrites a true badge with
  // a false one.
  useEffect(() => {
    if (open) onShotsChange?.(scene.id, shots.length > 0);
  }, [open, shots, scene.id, onShotsChange]);

  // Jumps to and briefly flashes an element -- used both ways, so a shot's
  // mark in the screenplay text and its row in the table below are a real
  // two-way reference to each other, not just a static annotation.
  function scrollToAndFlash(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('flash-highlight');
    window.setTimeout(() => el.classList.remove('flash-highlight'), 1200);
  }

  return (
    <div className="scene-card">
      <div className="scene-header" onClick={() => setOpen(!open)}>
        <span className="scene-heading-text">
          {scene.scene_number}. {scene.int_ext} {scene.heading} - {scene.day_night}
        </span>
        <span
          className={`readiness-badge ${hasShots ? 'ready' : 'pending'}`}
          title={hasShots ? 'Shot list started' : 'No shots added yet'}
        >
          Shot List
        </span>
      </div>

      {open && (
        <div className="scene-body">
          {hasFormattedScript ? (
            <ScreenplayView
              elements={scene.script_elements}
              tags={scene.elements}
              shots={shots}
              onMarkClick={(shotId) => scrollToAndFlash(`shot-row-${shotId}`)}
            />
          ) : (
            <div className="screenplay-view">
              <p className="action">{scene.synopsis || 'No scene text captured yet.'}</p>
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <ShotList
              sceneId={scene.id}
              shots={shots}
              onChange={loadShots}
              onMarkClick={(shotId) => scrollToAndFlash(`shot-mark-${shotId}`)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
