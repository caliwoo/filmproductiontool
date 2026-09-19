const { client, MODEL } = require('./anthropicClient');

const SIZES = ['WS', 'MS', 'CU', 'ECU', 'OTS', 'POV', '2-Shot'];

const SHOT_TOOL = {
  name: 'suggest_shots',
  description: 'Propose a practical shot list (camera setups) that would cover the given scene.',
  input_schema: {
    type: 'object',
    properties: {
      shots: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            size: { type: 'string', enum: SIZES },
            angle: {
              type: 'string',
              description: 'Camera angle, e.g. "Eye level", "Low angle", "High angle", "Dutch angle".',
            },
            movement: {
              type: 'string',
              description: 'Camera movement, e.g. "Static", "Handheld", "Dolly in", "Pan left", "Tracking".',
            },
            description: {
              type: 'string',
              description: 'One short sentence describing what the shot shows or covers.',
            },
            equipment: {
              type: 'string',
              description: 'Suggested rig/equipment if notable, e.g. "Steadicam", "Slider", "Drone". Empty string if nothing special.',
            },
          },
          required: ['size', 'angle', 'movement', 'description', 'equipment'],
          additionalProperties: false,
        },
      },
    },
    required: ['shots'],
    additionalProperties: false,
  },
  strict: true,
};

const SYSTEM_PROMPT = `You are an experienced director/DP breaking a scene down into a shot list for an indie
production. Given a scene heading and its text, propose a practical sequence of shots that would cover it:
establish the space where useful, cover the key action and dialogue with appropriate coverage (masters, singles,
over-the-shoulders, inserts/cutaways for important props or reactions), and keep pacing in mind. Keep the list
realistic for a small crew and modest schedule — usually 3 to 8 shots depending on scene complexity; do not
over-shoot a simple scene or under-cover a complex one. Do not repeat shots already listed under "Already planned"
for this scene. Order the shots the way they would be listed on a shot list (not necessarily shooting order). If
the scene has no usable text, return an empty list rather than guessing.`;

async function suggestShots(scene, existingShots) {
  if (!client) {
    const err = new Error('AI Suggest is not configured. Set the ANTHROPIC_API_KEY environment variable to enable it.');
    err.notConfigured = true;
    throw err;
  }

  const existingList = existingShots.length
    ? existingShots
        .map((s) => `- ${s.shot_number}: ${s.size || ''} ${s.angle || ''} — ${s.description || ''}`.trim())
        .join('\n')
    : '(none yet)';

  const sceneText = `SCENE ${scene.scene_number}. ${scene.int_ext} ${scene.heading} - ${scene.day_night}\n\n${
    scene.synopsis && scene.synopsis.trim() ? scene.synopsis : '(no scene text captured — use the heading only)'
  }\n\nAlready planned for this scene:\n${existingList}`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1536,
    system: SYSTEM_PROMPT,
    output_config: { effort: 'low' },
    tools: [SHOT_TOOL],
    tool_choice: { type: 'tool', name: 'suggest_shots' },
    messages: [{ role: 'user', content: sceneText }],
  });

  const toolUse = response.content.find((b) => b.type === 'tool_use');
  const shots = (toolUse && toolUse.input && toolUse.input.shots) || [];

  return shots.filter((s) => s && s.description && s.description.trim());
}

module.exports = { suggestShots };
