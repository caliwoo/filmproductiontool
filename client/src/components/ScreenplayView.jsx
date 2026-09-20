const TYPE_CLASS = {
  scene_heading: 'scene-heading',
  action: 'action',
  character: 'character',
  parenthetical: 'parenthetical',
  dialogue: 'dialogue',
  transition: 'transition',
};

export default function ScreenplayView({ elements }) {
  return (
    <div className="screenplay-view">
      {elements.map((el, i) => (
        <p key={i} className={TYPE_CLASS[el.type] || 'action'}>
          {el.text}
        </p>
      ))}
    </div>
  );
}
