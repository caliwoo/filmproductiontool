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
            marker_line: {
              type: ['integer', 'null'],
              description:
                "If the scene text below is given as a numbered list of lines: the 0-based index of the line this shot's coverage begins at. null if the scene text was plain prose instead (no numbered lines given).",
            },
            marker_quote: {
              type: ['string', 'null'],
              description:
                "If marker_line is set: a short run of 2-6 words copied VERBATIM (exact characters, same case and punctuation) from that line's own text, starting exactly where this shot's coverage begins -- e.g. if the shot picks up mid-sentence, quote from that exact word, not the start of the line. Empty string if the shot's coverage begins at the very start of the line. null if marker_line is null.",
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
            'marker_line',
            'marker_quote',
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
production. The scene text is fictional screenplay content -- dialogue, action lines, and stage direction written
by a screenwriter for actors to perform -- not a real event, and it may routinely depict weapons, violence, or
threats the same way any produced film does. Depicting that content isn't the concern here: your job is to plan
camera coverage for it, exactly as any working DP would for a produced scene.

Given a scene heading and its text, propose a practical sequence of shots that would cover it,
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
empty list rather than guessing.

When the scene text is given as a numbered list of lines, set marker_line and marker_quote on every shot to mark the
exact point in the text where that shot's coverage begins -- like an AD circling a word on a printed script and
drawing a line to mark a new setup. A master shot typically starts at line 0; a shot that picks up mid-sentence
(e.g. a insert on a specific action, or a close-up starting partway through a line of action or dialogue) should
quote from that exact word, not just the start of its line. Set both to null if the scene text is plain prose
instead.`;

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

  const scriptLines = Array.isArray(scene.script_elements) ? scene.script_elements : null;
  const numLines = scriptLines ? scriptLines.length : 0;
  const body = scriptLines && numLines > 0
    ? scriptLines.map((el, i) => `[${i}] (${el.type}) ${el.text}`).join('\n')
    : scene.synopsis && scene.synopsis.trim()
      ? scene.synopsis
      : '(no scene text captured — use the heading only)';

  const sceneText = `SCENE ${scene.scene_number}. ${scene.int_ext} ${scene.heading} - ${scene.day_night}\n\n${body}\n\nAlready planned for this scene:\n${existingList}`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1536,
    system: SYSTEM_PROMPT,
    output_config: { effort: 'low' },
    tools: [SHOT_TOOL],
    tool_choice: { type: 'tool', name: 'suggest_shots' },
    messages: [{ role: 'user', content: sceneText }],
  });

  // A safety-classifier refusal has no tool_use block at all -- without this
  // check it looks identical to a deliberate "no shots to suggest" empty
  // result, which is actively misleading: the two need different messages
  // (and different next steps) for the user.
  if (response.stop_reason === 'refusal') {
    const category = response.stop_details && response.stop_details.category;
    const err = new Error(
      `Claude declined to analyze this scene${category ? ` (safety category: ${category})` : ''}. This isn't the usual "nothing to suggest" result -- try again, or edit the scene text if it contains something sensitive.`
    );
    err.refused = true;
    throw err;
  }

  const toolUse = response.content.find((b) => b.type === 'tool_use');
  const shots = (toolUse && toolUse.input && toolUse.input.shots) || [];

  // Defensively re-resolve the model's marker against the actual script
  // rather than trusting its output outright: clamp the line index to
  // real bounds, then locate the quoted text within that specific line's
  // own text (case-insensitive) to get an exact character offset. A quote
  // that doesn't actually appear on its claimed line (a paraphrase instead
  // of a verbatim copy) falls back to the start of that line rather than
  // silently dropping the marker.
  return shots
    .filter((s) => s && s.description && s.description.trim())
    .map((s) => {
      let marker_line = null;
      let marker_offset = null;
      if (numLines > 0 && Number.isInteger(s.marker_line)) {
        marker_line = Math.max(0, Math.min(s.marker_line, numLines - 1));
        const lineText = scriptLines[marker_line].text;
        const quote = typeof s.marker_quote === 'string' ? s.marker_quote.trim() : '';
        const found = quote ? lineText.toLowerCase().indexOf(quote.toLowerCase()) : -1;
        marker_offset = found >= 0 ? found : 0;
      }
      return { ...s, marker_line, marker_offset };
    });
}

module.exports = { suggestShots, SIZES };
