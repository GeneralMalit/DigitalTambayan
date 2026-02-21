export const BOT_CONFIG = {
  name: 'Berto',
  mentionTrigger: '@Berto',
  placeholderResponses: [
    'Berto is currently away on vacation...',
    'Berto is busy reading...',
    'Berto is sleeping...',
    'Berto is taking a coffee break...',
    'Berto is out for a walk...',
    'Berto is currently unavailable...',
    'Berto is in a meeting....',
    'Berto is working on something important...'
  ],
  botUserId: '00000000-0000-0000-0000-000000000000',
} as const;

export type BotConfig = typeof BOT_CONFIG;
