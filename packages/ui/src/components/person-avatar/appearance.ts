import { PERSON_SKIN_TONES, PERSON_HAIR_COLORS, PERSON_EYE_COLORS } from '@jfrader/tokens';
export { PERSON_SKIN_TONES, PERSON_HAIR_COLORS, PERSON_EYE_COLORS, PERSON_ART_COLORS } from '@jfrader/tokens';
import { hashSeed } from '../../utils/seeded';

export const PERSON_APPEARANCE_VERSION = 3 as const;

export const PERSON_HAIR_STYLES = [
  'bald',
  'buzz',
  'cropped',
  'crewCut',
  'sidePart',
  'slickBack',
  'curls',
  'afro',
  'highTop',
  'fade',
  'undercut',
  'quiff',
  'curtains',
  'mohawk',
  'mullet',
  'ponytail',
  'topKnot',
  'braids',
  'dreadlocks',
  'long',
  'receding',
  'messy',
  'spiky',
  'flatTop',
] as const;
export const PERSON_FACIAL_HAIR_STYLES = [
  'clean',
  'moustache',
  'handlebar',
  'stubble',
  'goatee',
  'circleBeard',
  'shortBeard',
  'fullBeard',
  'longBeard',
  'chinstrap',
  'muttonChops',
  'sideburns',
] as const;
export const PERSON_FACE_SHAPES = ['oval', 'square', 'round', 'long', 'diamond', 'heart'] as const;
export const PERSON_BROW_STYLES = ['straight', 'arched', 'thick', 'soft', 'angled', 'unibrow'] as const;
export const PERSON_EYE_STYLES = ['round', 'narrow', 'wide', 'hooded', 'downturned'] as const;
export const PERSON_NOSE_STYLES = ['straight', 'broad', 'short', 'angular', 'hooked'] as const;
export const PERSON_MOUTH_STYLES = ['neutral', 'smile', 'wide', 'serious', 'grin', 'smirk'] as const;

/** Small optional flourishes; most people wear none of them. */
export const PERSON_ACCESSORIES = ['none', 'headband', 'earring', 'glasses', 'taped'] as const;
export const PERSON_MARKINGS = ['none', 'freckles', 'cheekScar', 'browScar', 'beautySpot', 'dimples'] as const;

export const PERSON_SKIN_TONE_IDS = Object.freeze(Object.keys(PERSON_SKIN_TONES) as PersonSkinTone[]);
export const PERSON_HAIR_COLOR_IDS = Object.freeze(Object.keys(PERSON_HAIR_COLORS) as PersonHairColor[]);
export const PERSON_EYE_COLOR_IDS = Object.freeze(Object.keys(PERSON_EYE_COLORS) as PersonEyeColor[]);

export type PersonSkinTone = keyof typeof PERSON_SKIN_TONES;
export type PersonHairColor = keyof typeof PERSON_HAIR_COLORS;
export type PersonEyeColor = keyof typeof PERSON_EYE_COLORS;
export type PersonHairStyle = (typeof PERSON_HAIR_STYLES)[number];
export type PersonFacialHairStyle = (typeof PERSON_FACIAL_HAIR_STYLES)[number];
export type PersonFaceShape = (typeof PERSON_FACE_SHAPES)[number];
export type PersonBrowStyle = (typeof PERSON_BROW_STYLES)[number];
export type PersonEyeStyle = (typeof PERSON_EYE_STYLES)[number];
export type PersonNoseStyle = (typeof PERSON_NOSE_STYLES)[number];
export type PersonMouthStyle = (typeof PERSON_MOUTH_STYLES)[number];
export type PersonAccessory = (typeof PERSON_ACCESSORIES)[number];
export type PersonMarking = (typeof PERSON_MARKINGS)[number];

/** Semantic visual identity shared by portraits and small pitch actors. */
export interface PersonAppearance {
  version: typeof PERSON_APPEARANCE_VERSION;
  skinTone: PersonSkinTone;
  hairColor: PersonHairColor;
  hairStyle: PersonHairStyle;
  facialHair: PersonFacialHairStyle;
  faceShape: PersonFaceShape;
  browStyle: PersonBrowStyle;
  eyeStyle: PersonEyeStyle;
  eyeColor: PersonEyeColor;
  noseStyle: PersonNoseStyle;
  mouthStyle: PersonMouthStyle;
  accessory: PersonAccessory;
  marking: PersonMarking;
}

/** Uses the durable visual seed when present and the entity ID as a fallback. */
export function resolveAppearanceId(entityId: string, appearanceId?: string) {
  const normalizedAppearanceId = appearanceId?.trim();
  if (normalizedAppearanceId) return normalizedAppearanceId;
  return entityId;
}

function appearanceTraitHash(appearanceId: string, trait: string) {
  const value = `mifulbo:person:v3:${trait}\u0000${appearanceId}`;
  let hash = hashSeed(value);
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

function appearanceChoice<const T extends readonly string[]>(appearanceId: string, trait: string, options: T) {
  return options[appearanceTraitHash(appearanceId, trait) % options.length] as T[number];
}

/**
 * Picks a flourish that most people should not have: the first option carries
 * the residual weight, so `none` stays the common case as the list grows.
 */
function appearanceRareChoice<const T extends readonly string[]>(
  appearanceId: string,
  trait: string,
  options: T,
  chanceInSixteen: number,
) {
  const roll = appearanceTraitHash(appearanceId, trait) % 16;
  if (roll >= chanceInSixteen) return options[0] as T[number];
  return options[1 + (appearanceTraitHash(appearanceId, `${trait}:pick`) % (options.length - 1))] as T[number];
}

/**
 * Resolves the current v3 identity.
 *
 * Every color and geometry trait has an independently mixed domain, avoiding
 * correlated hash buckets while keeping one durable identity seed.
 */
export function resolvePersonAppearance(appearanceId: string): PersonAppearance {
  return {
    version: PERSON_APPEARANCE_VERSION,
    skinTone: appearanceChoice(appearanceId, 'skin-tone', PERSON_SKIN_TONE_IDS),
    hairColor: appearanceChoice(appearanceId, 'hair-color', PERSON_HAIR_COLOR_IDS),
    hairStyle: appearanceChoice(appearanceId, 'hair-style', PERSON_HAIR_STYLES),
    facialHair: appearanceChoice(appearanceId, 'facial-hair', PERSON_FACIAL_HAIR_STYLES),
    faceShape: appearanceChoice(appearanceId, 'face-shape', PERSON_FACE_SHAPES),
    browStyle: appearanceChoice(appearanceId, 'brow-style', PERSON_BROW_STYLES),
    eyeStyle: appearanceChoice(appearanceId, 'eye-style', PERSON_EYE_STYLES),
    eyeColor: appearanceChoice(appearanceId, 'eye-color', PERSON_EYE_COLOR_IDS),
    noseStyle: appearanceChoice(appearanceId, 'nose-style', PERSON_NOSE_STYLES),
    mouthStyle: appearanceChoice(appearanceId, 'mouth-style', PERSON_MOUTH_STYLES),
    accessory: appearanceRareChoice(appearanceId, 'accessory', PERSON_ACCESSORIES, 4),
    marking: appearanceRareChoice(appearanceId, 'marking', PERSON_MARKINGS, 5),
  };
}

/** Stable semantic cache key for the current appearance recipe. */
export function personAppearanceSignature(appearance: PersonAppearance) {
  return [
    appearance.version,
    appearance.skinTone,
    appearance.hairColor,
    appearance.hairStyle,
    appearance.facialHair,
    appearance.faceShape,
    appearance.browStyle,
    appearance.eyeStyle,
    appearance.eyeColor,
    appearance.noseStyle,
    appearance.mouthStyle,
    appearance.accessory,
    appearance.marking,
  ].join(':');
}
