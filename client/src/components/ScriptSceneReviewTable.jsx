import { useEffect, useRef } from 'react';
import PageLengthInput from './PageLengthInput.jsx';

export default function ScriptSceneReviewTable({ scenes, onUpdateScene, onToggleAll }) {
  const selectAllRef = useRef(null);
  const includedCount = scenes.filter((s) => s.include).length;
  const allSelected = includedCount === scenes.length;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = includedCount > 0 && !allSelected;
    }
  }, [includedCount, allSelected]);

  return (
    <table>
      <thead>
        <tr>
          <th>
            <input
              ref={selectAllRef}
              type="checkbox"
              checked={allSelected}
              title={allSelected ? 'Deselect all scenes' : 'Select all scenes'}
              onChange={(e) => onToggleAll(e.target.checked)}
            />
          </th>
          <th>#</th>
          <th>Type</th>
          <th>Time</th>
          <th>Heading</th>
          <th>Length</th>
          <th>Synopsis</th>
        </tr>
      </thead>
      <tbody>
        {scenes.map((s, i) => (
          <tr key={i}>
            <td>
              <input
                type="checkbox"
                checked={s.include}
                onChange={(e) => onUpdateScene(i, 'include', e.target.checked)}
              />
            </td>
            <td>
              <input
                style={{ width: 50 }}
                value={s.scene_number}
                onChange={(e) => onUpdateScene(i, 'scene_number', e.target.value)}
              />
            </td>
            <td>
              <select value={s.int_ext} onChange={(e) => onUpdateScene(i, 'int_ext', e.target.value)}>
                <option value="INT">INT</option>
                <option value="EXT">EXT</option>
                <option value="INT/EXT">INT/EXT</option>
              </select>
            </td>
            <td>
              <input
                style={{ width: 90 }}
                value={s.day_night}
                onChange={(e) => onUpdateScene(i, 'day_night', e.target.value)}
              />
            </td>
            <td>
              <input
                style={{ width: 160 }}
                value={s.heading}
                onChange={(e) => onUpdateScene(i, 'heading', e.target.value)}
              />
            </td>
            <td>
              <PageLengthInput
                value={s.page_count}
                remountKey={`${i}-${s.page_count}`}
                onCommit={(decimal) => onUpdateScene(i, 'page_count', decimal)}
              />
            </td>
            <td className="muted" style={{ fontSize: 12 }}>
              {s.synopsis.slice(0, 90)}
              {s.synopsis.length > 90 ? '...' : ''}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
