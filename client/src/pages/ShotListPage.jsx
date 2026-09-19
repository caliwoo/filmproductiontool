import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../api.js';

export default function ShotListPage() {
  const { projectId, project } = useOutletContext();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get(`/projects/${projectId}/shot-list`)
      .then((result) => setRows(result.rows))
      .catch((err) => setError(err.message));
  }, [projectId]);

  return (
    <div>
      <div className="page-header">
        <h2>Shot List</h2>
        <a className="btn" href={`/api/projects/${projectId}/shot-list-pdf`}>
          Download PDF
        </a>
      </div>
      {error && <div className="error-banner">{error}</div>}

      <div className="shotlist-sheet">
        <h1 className="shotlist-title">SHOT LIST</h1>
        <div className="shotlist-subtitle">&quot;{project ? project.name : ''}&quot;</div>

        <table className="shotlist-table">
          <thead>
            <tr>
              <th>Shot No.</th>
              <th>Scene / Description</th>
              <th>Camera Angle / Movement</th>
              <th>Location</th>
              <th>Time of Day</th>
              <th>Equipment / Lens</th>
              <th>Talent / Props</th>
              <th>Duration / Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows &&
              rows.map((r, i) => (
                <tr key={r.shot_id} className={i % 2 === 1 ? 'striped' : ''}>
                  <td>{r.shot_number}</td>
                  <td>
                    {r.scene_heading && <strong>{r.scene_heading}</strong>}
                    {r.scene_heading && r.description ? ' — ' : ''}
                    {r.description}
                  </td>
                  <td>{[r.size, r.angle, r.movement].filter(Boolean).join(', ') || '—'}</td>
                  <td>{r.location || '—'}</td>
                  <td>{r.day_night || '—'}</td>
                  <td>{r.equipment || '—'}</td>
                  <td>{[...r.cast, ...r.props].join(', ') || '—'}</td>
                  <td>&mdash;</td>
                </tr>
              ))}
            {rows && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="muted" style={{ textAlign: 'center', padding: '24px 0' }}>
                  No shots yet. Add shots in Script Breakdown, or generate some with AI Suggest Shots.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
