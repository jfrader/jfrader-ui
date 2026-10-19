import { PERSON_ART_COLORS } from '@jfrader/tokens';

export const PERSON_SHIRT_PATTERNS = ['solid', 'centerStripe', 'split', 'hoops', 'shoulders'] as const;
export const PERSON_SHORTS_PATTERNS = ['solid', 'sideStripe', 'split', 'waistBand'] as const;
export const PERSON_SOCKS_PATTERNS = ['solid', 'turnover'] as const;

export type PersonAvatarAttire = 'kit' | 'staff';
export type PersonShirtPattern = (typeof PERSON_SHIRT_PATTERNS)[number];
export type PersonShortsPattern = (typeof PERSON_SHORTS_PATTERNS)[number];
export type PersonSocksPattern = (typeof PERSON_SOCKS_PATTERNS)[number];

export interface PersonAvatarKit {
  shirt: string;
  shorts: string;
  socks: string;
  accent: string;
  shortsAccent: string;
  socksAccent: string;
  shirtPattern: PersonShirtPattern;
  shortsPattern: PersonShortsPattern;
  socksPattern: PersonSocksPattern;
}

export interface ResolvePersonKitOptions {
  kit?: PersonAvatarKit;
  primary?: string;
  secondary?: string;
}

export function resolvePersonKit({
  kit,
  primary = PERSON_ART_COLORS.staffJacket,
  secondary = PERSON_ART_COLORS.staffShirt,
}: ResolvePersonKitOptions = {}): PersonAvatarKit {
  return kit ?? {
    shirt: primary, shorts: secondary, socks: primary,
    accent: secondary, shortsAccent: primary, socksAccent: secondary,
    shirtPattern: 'solid', shortsPattern: 'solid', socksPattern: 'solid',
  };
}
