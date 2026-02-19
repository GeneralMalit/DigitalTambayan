export const BOT_CONFIG = {
  name: 'Berto',
  mentionTrigger: '@Berto',
  placeholderResponse: 'Berto is sleeping... (AI integration coming soon)',
  botUserId: '00000000-0000-0000-0000-000000000000',
} as const;

export type BotConfig = typeof BOT_CONFIG;
