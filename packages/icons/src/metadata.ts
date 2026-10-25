import type { IconMetadata } from './types';

export const metadata: Record<string, Omit<IconMetadata, 'variants' | 'category'> & { category?: IconMetadata['category'] }> = {
  chart: { name: 'chart', category: 'money', tags: ['analytics', 'bars', 'statistics'], aliases: [], expressive: false, since: '0.1.0' },
  home: { name: 'home', category: 'navigation', tags: ['house', 'start'], aliases: [], expressive: false, since: '0.1.0' },
  lock: { name: 'lock', category: 'security', tags: ['private', 'secure', 'password'], aliases: [], expressive: false, since: '0.1.0' },
  play: { name: 'play', category: 'media', tags: ['start', 'video', 'audio'], aliases: [], expressive: false, since: '0.1.0' },
  search: { name: 'search', tags: ['find', 'magnifier', 'lookup'], aliases: [], expressive: false, since: '0.1.0' },
  send: { name: 'send', category: 'communication', tags: ['message', 'plane', 'transfer'], aliases: ['send-money'], expressive: false, since: '0.1.0' },
  settings: { name: 'settings', tags: ['gear', 'preferences', 'configuration'], aliases: [], expressive: false, since: '0.1.0' },
  wallet: { name: 'wallet', category: 'money', tags: ['balance', 'payment', 'funds'], aliases: [], expressive: false, since: '0.1.0' },
};
