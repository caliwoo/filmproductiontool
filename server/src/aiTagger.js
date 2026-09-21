const { client, MODEL } = require('./anthropicClient');

const CATEGORIES = ['cast', 'stunts', 'extras', 'props', 'wardrobe', 'vehicles', 'sfx', 'sound', 'makeup', 'animals', 'notes'];

const TAG_TOOL = {
  name: 'tag_scene_elements',
  description:
    'Record the breakdown elements (cast, stunts, background extras, props, wardrobe, vehicles, special effects, sound, hair/makeup, animals) that are explicitly present or clearly implied in the given scene.',
  input_schema: {
    type: 'object',
    properties: {
      elements: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            category: { type: 'string', enum: CATEGORIES },
            value: {
              type: 'string',
              description: 'Short breakdown-sheet name for the element, e.g. "Coffee Mug" or "Revolver".',
            },
            quote: {
              type: 'string',
              description:
                'A short run of 2-6 words copied VERBATIM (exact characters, same case and punctuation) from the scene text above where this element actually appears or is described -- e.g. for a value of "Colorful Butterfly", a quote like "the butterfly" or "tree with the butterfly" pulled from the actual text. Empty string only if this element is a mood/tone/style note with no literal textual anchor (e.g. "Ominous tonal shift").',
            },
          },
          required: ['category', 'value', 'quote'],
          additionalProperties: false,
        },
      },
    },
    required: ['elements'],
    additionalProperties: false,
  },
  strict: true,
};

const SYSTEM_PROMPT = `You are a script supervisor doing a breakdown pass on a screenplay scene for a film production.
Given a scene heading and its text, list every distinct element a production would need to prepare: speaking or
named characters (cast), physical stunts/falls/fights/car chases requiring a stunt performer (stunts), background/
crowd performers (extras), physical props characters interact with (props), notable clothing/costume items
(wardrobe), vehicles (vehicles), practical or visual effects (sfx), notable sounds/music cues (sound),
hair/makeup/prosthetics needs (makeup), and animals (animals).
Only tag what is explicitly present or unambiguously implied by the text — never invent items. Do not tag the
scene heading's location, INT/EXT, or time of day as an element. Keep each value short, like a breakdown sheet
entry (2-4 words), not a full sentence. Skip anything already listed under "Already tagged" for this scene. If
nothing qualifies for a category, omit it. If the scene has no usable text, return an empty list rather than guessing.

Tag someone under cast only if they're physically present and performing in the scene. Do not tag a character
who is merely referenced indirectly — mentioned in dialogue or narration, seen in a photo, appearing in a text
message thread on a phone screen, or heard on the other end of a phone call — without actually being there in
person; no actor is needed on set for that. In those cases, tag the physical object that carries the reference
instead, as a prop (e.g. a photo someone is looking at, not the person pictured in it).

For every element, also set quote to a short verbatim excerpt from the scene text marking where it actually appears
or is described, so the element can be highlighted at its real position in the text later — see the quote field's
own description for exactly what counts as verbatim.`;

function normalize(s) {
  return String(s).trim().toLowerCase();
}

function isDuplicate(existing, category, value) {
  return existing.some((e) => normalize(e.category) === normalize(category) && normalize(e.value) === normalize(value));
}

async function suggestSceneElements(scene, existingElements) {
  if (!client) {
    const err = new Error('AI Select is not configured. Set the ANTHROPIC_API_KEY environment variable to enable it.');
    err.notConfigured = true;
    throw err;
  }

  const existingList = existingElements.length
    ? existingElements.map((e) => `- ${e.category}: ${e.value}`).join('\n')
    : '(none yet)';

  const sceneText = `SCENE ${scene.scene_number}. ${scene.int_ext} ${scene.heading} - ${scene.day_night}\n\n${
    scene.synopsis && scene.synopsis.trim() ? scene.synopsis : '(no scene text captured — use the heading only)'
  }\n\nAlready tagged for this scene:\n${existingList}`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    output_config: { effort: 'low' },
    tools: [TAG_TOOL],
    tool_choice: { type: 'tool', name: 'tag_scene_elements' },
    messages: [{ role: 'user', content: sceneText }],
  });

  const toolUse = response.content.find((b) => b.type === 'tool_use');
  const elements = (toolUse && toolUse.input && toolUse.input.elements) || [];

  // Defensively re-verify the quote actually appears in the scene's own
  // text rather than trusting it outright -- a hallucinated or paraphrased
  // "verbatim" quote just becomes no quote, falling back to matching on
  // value alone (same as a manually-tagged element) rather than showing a
  // wrong highlight.
  const haystack = (scene.synopsis || '').toLowerCase();
  return elements
    .filter((e) => e && e.category && e.value && e.value.trim() && !isDuplicate(existingElements, e.category, e.value))
    .map((e) => {
      const quote = typeof e.quote === 'string' ? e.quote.trim() : '';
      return { ...e, quote: quote && haystack.includes(quote.toLowerCase()) ? quote : null };
    });
}

module.exports = { suggestSceneElements };
