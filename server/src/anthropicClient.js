const Anthropic = require('@anthropic-ai/sdk');

const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5';

module.exports = { client, MODEL };
