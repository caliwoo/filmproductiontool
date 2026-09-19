const { client, MODEL } = require('./anthropicClient');

const SIZES = ['WS', 'MS', 'CU', 'ECU', 'OTS', 'POV', '2-Shot', 'Insert'];

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
            subject: {
              type: 'string',
              description: 'The primary character, object, or focal element the shot is built around (e.g. "JANE", "the ransom note").',
            },
            size: { type: 'string', enum: SIZES },
            angle: {
              type: 'string',
              description: 'Camera angle, e.g. "Eye level", "Low angle", "High angle", "Dutch angle", "Bird\'s eye".',
            },
            movement: {
              type: 'string',
              description: 'Camera movement, e.g. "Static", "Handheld", "Dolly in", "Pan left", "Tracking", "Steadicam".',
            },
            lens: {
              type: 'string',
              description: 'Suggested focal length, e.g. "24mm", "35mm", "50mm", "85mm". Empty string if not notable.',
            },
            spatial_composition: {
              type: 'string',
              description: 'Brief framing note on foreground/midground/background elements, e.g. "FG: coffee cup, MG: Jane, BG: rain-streaked window". Empty string if not notable.',
            },
            description: {
              type: 'string',
              description: 'One short sentence describing what the shot shows or covers, including the action beat that completes it before cutting.',
            },
            equipment: {
              type: 'string',
              description: 'Suggested rig/equipment if notable, e.g. "Steadicam", "Slider", "Drone". Empty string if nothing special.',
            },
            setup_notes: {
              type: 'string',
              description: 'Special gear, lighting alerts, or blocking directions the crew needs to know for this setup. Empty string if nothing special.',
            },
          },
          required: [
            'subject',
            'size',
            'angle',
            'movement',
            'lens',
            'spatial_composition',
            'description',
            'equipment',
            'setup_notes',
          ],
          additionalProperties: false,
        },
      },
    },
    required: ['shots'],
    additionalProperties: false,
  },
  strict: true,
};

const SYSTEM_PROMPT = `You are an experienced DP/1st AD breaking a scene down into a shot list for an indie
production. Given a scene heading and its text, propose a practical sequence of shots that would cover it,
following this coverage checklist in priority order:
1. Master shot: a wide shot establishing the space, all characters present, and the scene's complete blocking.
   This is the baseline safety net for the edit — include one unless the scene is a single-subject insert/cutaway
   scene with nothing to establish.
2. Speaking character coverage: medium shots or close-ups for each character with dialogue, matched in framing
   scale across dialogue partners (e.g. if one side of a conversation gets a CU, the other side should too, not a
   wider MS).
3. Reaction shots: dedicated coverage of characters who are present but not speaking, when their reaction matters
   to the scene.
4. Inserts & cutaways: close shots (use the "Insert" size) of critical props, physical actions (turning a key,
   reading a text), or visual details the story needs.
Secure this baseline coverage before adding complex or ambitious camera movement (Steadicam, dolly, drone) —
only reach for those when the scene specifically calls for it. Keep the list realistic for a small crew and modest
schedule — usually 3 to 8 shots depending on scene complexity; do not over-shoot a simple scene or under-cover a
complex one. Do not repeat shots already listed under "Already planned" for this scene. Order the shots the way
they would be listed on a shot list (not necessarily shooting order). If the scene has no usable text, return an
empty list rather than guessing.`;

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

module.exports = { suggestShots, SIZES };
