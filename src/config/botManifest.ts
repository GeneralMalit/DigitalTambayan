export const BOT_NAME = 'Berto' as const;

function createPlaceholderResponses(): readonly string[] {
  return [
    `${BOT_NAME} is currently away on vacation...`,
    `${BOT_NAME} is busy reading...`,
    `${BOT_NAME} is sleeping...`,
    `${BOT_NAME} is taking a coffee break...`,
    `${BOT_NAME} is out for a walk...`,
    `${BOT_NAME} is currently unavailable...`,
    `${BOT_NAME} is in a meeting...`,
    `${BOT_NAME} is working on something important...`
  ] as const;
}

export const BOT_CONFIG = {
  name: BOT_NAME,
  mentionTrigger: `@${BOT_NAME}`,
  placeholderResponses: createPlaceholderResponses(),
  botUserId: '00000000-0000-0000-0000-000000000000',
  // AI Configuration
  contextLength: 10, // Number of recent messages to include as context
  cooldownSeconds: 10, // Session-based rate limit for AI calls
  ignoreBotMessages: false, // Whether to ignore previous bot responses in the context
  modelName: 'gemma-3-27b-it', // The model to use for AI generation
  logApiRequests: false, // Whether to log the request sent to Gemini API
  logApiResponses: false, // Whether to log the response received from Gemini API
  get systemPrompt() {
    return `You are ${BOT_NAME}, an observant friend in a group chat. Keep your responses natural, concise, and context-aware. You are participating in a group conversation. Your name is ${BOT_NAME}. Refer to yourself as ${BOT_NAME} when needed.`;
  },
} as const;

export type BotConfig = typeof BOT_CONFIG;
