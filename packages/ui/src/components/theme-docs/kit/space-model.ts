import { base, type Tokens } from '@jfrader/tokens';
import { customProperty, tokenPath } from './model';

const SIZE_DESCRIPTIONS = {
  personAvatarLg: 'Large PersonAvatar artwork size.',
  emblemSm: 'Small emblem plate side.',
  emblemMd: 'Medium emblem plate side.',
  emblemLg: 'Large emblem plate side.',
  emblemXl: 'Extra-large emblem plate side.',
  gameCardSm: 'Small game card width.',
  gameCardMd: 'Medium game card width.',
  gameCardLg: 'Large game card width.',
  gameCardXl: 'Extra-large game card width.',
  gameCardPerspective: 'Perspective distance for game card transforms.',
  dialogStackBreakpoint: 'DialogStack switch point from sheet to centered dialog.',
  dialogStackSheetPeek: 'Parent sheet peek reveal in DialogStack.',
  dialogStackDialogPeek: 'Parent dialog peek reveal in DialogStack.',
} satisfies Record<keyof Tokens['size'], string>;

export const SPACE_STEPS = Object.entries(base.space).map(([key, value]) => ({
  key,
  value,
  name: `${tokenPath('space')}[${key}]`,
  variable: customProperty('space', key),
}));

export const RADII = Object.entries(base.radius).map(([key, value]) => ({
  key,
  value,
  name: tokenPath('radius', key),
  variable: customProperty('radius', key),
}));

export const FIXED_SIZES = Object.entries(base.size).map(([key, value]) => ({
  key,
  value,
  description: SIZE_DESCRIPTIONS[key as keyof Tokens['size']],
  name: tokenPath('size', key),
  variable: customProperty('size', key),
}));
