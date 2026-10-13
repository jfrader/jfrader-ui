/**
 * Procedural scene generator.
 *
 * Deterministic generation model:
 * 1. The seed string is hashed to a 32-bit unsigned integer with FNV-1a.
 * 2. The hash seeds a Mulberry32 PRNG producing floats in [0, 1).
 * 3. `SCENE_FRAME` (shared geometry and finish) and `SCENE_PARAMETERS` (per variant palettes,
 *    light, sky, ground, grain and vignette) hold every tunable number.
 * 4. Colours are mixed in OKLCH and gamut-mapped to sRGB hex by reducing chroma, without
 *    dependencies or theme tokens.
 * 5. Artwork is authored on a 1200x800 viewBox. The light source stays inside the central
 *    square, so circular avatar crops, portrait tiles and wide tiles keep the focal point.
 *
 * Paint order: sky gradient and bloom, stars, clouds, sun or moon, ground (depth layers with
 * atmospheric perspective, or a coast with water), light wash, vignette, film grain.
 */

export type SceneVariant = 'landscape' | 'dunes' | 'dusk' | 'tide';

export interface Range {
  readonly min: number;
  readonly max: number;
}

/** Lightness and chroma ranges of one OKLCH tone. */
export interface Tone {
  readonly light: Range;
  readonly chroma: Range;
}

/** One colour family of a variant. Hues are OKLCH degrees. */
export interface ScenePalette {
  readonly zenithHue: Range;
  readonly horizonHue: Range;
  readonly lightHue: Range;
  readonly terrainHue: Range;
}

export interface LightParameters {
  readonly kind: 'sun' | 'moon';
  readonly radius: Range;
  /** Height of the light centre above the horizon, in viewBox px. */
  readonly elevation: Range;
  readonly chroma: number;
  readonly haloScale: number;
  readonly bloomRadius: Range;
  readonly bloomOpacity: Range;
  readonly bloomChroma: number;
  readonly washRadius: number;
  readonly washOpacity: Range;
  /** Moon shadow offset (fraction of the radius) and the opacity of the unlit disc. */
  readonly crescent: { readonly phase: Range; readonly earthshine: number } | null;
}

export interface CloudParameters {
  readonly count: Range;
  readonly top: number;
  readonly horizonGap: number;
  readonly width: Range;
  readonly height: Range;
  readonly puffs: Range;
  /** Puff radii as fractions of the cloud width and height. */
  readonly puffWidth: Range;
  readonly puffHeight: Range;
  /** Upward spread of puffs as a fraction of the cloud height. */
  readonly billow: number;
  readonly opacity: Range;
  /** Lightness added to the sky colour behind each cloud. */
  readonly lift: number;
  readonly chroma: number;
  /** Maximum mix toward the bloom colour for clouds near the light, and its reach in px. */
  readonly lightTint: number;
  readonly lightReach: number;
  readonly blur: number;
}

export interface StarParameters {
  readonly count: Range;
  readonly horizonGap: number;
  readonly radius: Range;
  readonly opacity: Range;
  /** Exponent of the fade toward the horizon. */
  readonly fade: number;
  readonly bright: Range;
  readonly brightRadius: Range;
  readonly glowScale: number;
  readonly glowOpacity: number;
}

export interface HazeParameters {
  /** Share of the zenith colour in the atmosphere colour; the rest is the horizon colour. */
  readonly zenithMix: number;
  readonly opacity: Range;
  /** Band extent above and below the horizon, in viewBox px. */
  readonly above: number;
  readonly below: number;
}

export interface NoiseParameters {
  /** Lattice cells across the profile for the first octave. */
  readonly cells: Range;
  readonly octaves: number;
  readonly gain: number;
}

export interface PeakParameters extends NoiseParameters {
  readonly massifs: Range;
  /** Massif width as a fraction of the frame width. */
  readonly massifWidth: Range;
  /** Relief kept away from massifs, as a fraction of the full relief. */
  readonly massifFloor: number;
  readonly sharpness: number;
  /** Layers deeper than this fraction of the stack become rolling foothills. */
  readonly foothillDepth: number;
}

export interface DuneParameters {
  readonly crests: Range;
  /** Random shift of each crest inside its slot, as a fraction of the slot. */
  readonly crestJitter: number;
  readonly windward: Range;
  readonly lee: Range;
  readonly leeCurve: number;
  readonly height: Range;
  readonly undulation: number;
  readonly leeShadow: number;
  /** Shadow opacity on the farthest layer as a fraction of `leeShadow`. */
  readonly farShadow: number;
  readonly shadowLight: number;
  readonly shadowSkyMix: number;
  /** Horizontal reach of the shadow edge from the crest, in px. */
  readonly shadowSkew: number;
}

export interface LayeredGround {
  readonly kind: 'layers';
  readonly layerCount: Range;
  /** Exponent spacing layer bases from the horizon to `foregroundY`. */
  readonly spacing: number;
  readonly foregroundY: number;
  readonly relief: { readonly far: Range; readonly near: Range };
  readonly peaks: PeakParameters | null;
  readonly rolling: NoiseParameters;
  readonly dunes: DuneParameters | null;
  readonly near: Tone;
  /** Share of the near colour in the farthest layer; the rest is atmosphere. */
  readonly farMix: number;
  readonly depthCurve: number;
  /** Mist pooled at the base of the farthest layer. */
  readonly baseHaze: number;
  readonly rimOpacity: number;
}

export interface CoastGround {
  readonly kind: 'coast';
  readonly headlands: Range;
  /** Headland reach as a fraction of the frame width. */
  readonly headlandSpan: { readonly far: Range; readonly near: Range };
  readonly headlandRelief: { readonly far: Range; readonly near: Range };
  readonly headlandFloor: number;
  readonly headlandTaper: number;
  readonly headlandNoise: NoiseParameters;
  readonly land: Tone;
  readonly farMix: number;
  readonly reflectionOpacity: number;
  readonly reflectionSquash: number;
  /** Water lightness at the horizon as a fraction of the atmosphere lightness. */
  readonly surfaceLight: number;
  readonly deep: Tone;
  readonly glowOpacity: number;
  readonly glintRows: number;
  /** Exponent spacing glint rows and swells toward the viewer. */
  readonly glintSpacing: number;
  readonly glintHeight: Range;
  /** Half width of the glint path at the horizon (min) and at the shore (max). */
  readonly glintWidth: Range;
  readonly glintJitter: number;
  readonly glintScatter: number;
  readonly glintBreaks: Range;
  /** Glint piece half width as a fraction of the row half width. */
  readonly glintPiece: Range;
  readonly glintOpacity: Range;
  readonly glintFade: number;
  readonly swells: Range;
  readonly swellThickness: Range;
  readonly swellLength: Range;
  readonly swellOpacity: Range;
  readonly shoreY: Range;
  readonly shoreTilt: Range;
  readonly shoreWobble: number;
  readonly shoreNoise: NoiseParameters;
  readonly sandHue: Range;
  readonly sand: Tone;
  /** Share of the horizon colour reflected by wet sand. */
  readonly wetMix: number;
  /** Gradient offset where wet sand turns dry. */
  readonly wetBand: number;
  readonly foregroundShade: number;
  readonly sheenWidth: number;
  readonly sheenOpacity: number;
  readonly foamWidth: number;
  readonly foamOpacity: number;
  readonly laceOffset: number;
  readonly laceWidth: number;
  readonly laceStrength: number;
  readonly laceSegments: number;
  readonly laceDash: Range;
  readonly laceGap: Range;
}

export interface VariantParameters {
  readonly palettes: readonly ScenePalette[];
  readonly zenith: Tone;
  readonly horizon: Tone;
  readonly horizonY: Range;
  readonly light: LightParameters;
  readonly clouds: CloudParameters | null;
  readonly stars: StarParameters | null;
  readonly haze: HazeParameters;
  readonly ground: LayeredGround | CoastGround;
  readonly grainOpacity: Range;
  readonly vignetteOpacity: Range;
}

/** Shared frame geometry and finishing values for every variant. */
export const SCENE_FRAME = {
  width: 1200,
  height: 800,
  /** Light-source x range; keeps the focal point inside 2:3 portrait and circular crops. */
  lightX: { min: 480, max: 720 },
  /** Horizontal distance between profile samples, in viewBox px. */
  sampleStep: 10,
  minRidgeY: 120,
  sky: { stops: [0, 0.35, 0.65, 0.88, 1], curve: 1.5, chromaDip: 0.4 },
  light: { lightness: 0.97 },
  bloom: {
    lightness: 0.9,
    falloff: [
      { offset: 0, strength: 1 },
      { offset: 0.35, strength: 0.4 },
      { offset: 1, strength: 0 },
    ],
  },
  halo: [
    { offset: 0, strength: 0.9 },
    { offset: 0.18, strength: 0.5 },
    { offset: 0.5, strength: 0.14 },
    { offset: 1, strength: 0 },
  ],
  fade: [
    { offset: 0, strength: 1 },
    { offset: 1, strength: 0 },
  ],
  /** Vertical lift of the moon shadow as a fraction of its sideways offset. */
  moonTilt: 0.35,
  rim: { width: 1.6, lightMix: 0.5 },
  vignette: { inner: 0.42, radius: 0.78, lightness: 0.1, chroma: 0.02 },
  grain: { frequency: 0.85, octaves: 2, contrast: 2.6, seeds: 997 },
} as const;

export const SCENE_VIEW_BOX = `0 0 ${SCENE_FRAME.width} ${SCENE_FRAME.height}`;

/**
 * Named parameter table for procedural scene variants.
 * Centralizes all numeric ranges to avoid scattered magic numbers.
 */
export const SCENE_PARAMETERS: Record<SceneVariant, VariantParameters> = {
  landscape: {
    palettes: [
      // Clear alpine morning: blue zenith, pale gold horizon, blue ranges
      { zenithHue: { min: 236, max: 250 }, horizonHue: { min: 78, max: 95 }, lightHue: { min: 85, max: 95 }, terrainHue: { min: 245, max: 262 } },
      // Golden hour: indigo zenith, amber horizon, violet ranges
      { zenithHue: { min: 256, max: 272 }, horizonHue: { min: 50, max: 66 }, lightHue: { min: 60, max: 72 }, terrainHue: { min: 292, max: 318 } },
      // Glacial haze: teal zenith, pale cyan horizon, slate ranges
      { zenithHue: { min: 220, max: 234 }, horizonHue: { min: 192, max: 208 }, lightHue: { min: 95, max: 105 }, terrainHue: { min: 226, max: 242 } },
    ],
    zenith: { light: { min: 0.4, max: 0.5 }, chroma: { min: 0.1, max: 0.14 } },
    horizon: { light: { min: 0.86, max: 0.92 }, chroma: { min: 0.05, max: 0.09 } },
    horizonY: { min: 450, max: 490 },
    light: {
      kind: 'sun',
      radius: { min: 24, max: 32 },
      elevation: { min: 130, max: 220 },
      chroma: 0.05,
      haloScale: 3.4,
      bloomRadius: { min: 420, max: 560 },
      bloomOpacity: { min: 0.35, max: 0.5 },
      bloomChroma: 0.1,
      washRadius: 720,
      washOpacity: { min: 0.1, max: 0.18 },
      crescent: null,
    },
    clouds: {
      count: { min: 3, max: 6 },
      top: 60,
      horizonGap: 150,
      width: { min: 200, max: 440 },
      height: { min: 22, max: 48 },
      puffs: { min: 4, max: 7 },
      puffWidth: { min: 0.22, max: 0.45 },
      puffHeight: { min: 0.5, max: 1 },
      billow: 0.35,
      opacity: { min: 0.3, max: 0.55 },
      lift: 0.1,
      chroma: 0.5,
      lightTint: 0.5,
      lightReach: 600,
      blur: 12,
    },
    stars: null,
    haze: { zenithMix: 0.18, opacity: { min: 0.55, max: 0.75 }, above: 140, below: 60 },
    ground: {
      kind: 'layers',
      layerCount: { min: 5, max: 6 },
      spacing: 1.35,
      foregroundY: 760,
      relief: { far: { min: 260, max: 340 }, near: { min: 50, max: 90 } },
      peaks: {
        cells: { min: 3, max: 5 },
        octaves: 5,
        gain: 0.5,
        massifs: { min: 1, max: 2 },
        massifWidth: { min: 0.12, max: 0.22 },
        massifFloor: 0.4,
        sharpness: 1.4,
        foothillDepth: 0.5,
      },
      rolling: { cells: { min: 2, max: 4 }, octaves: 3, gain: 0.4 },
      dunes: null,
      near: { light: { min: 0.16, max: 0.22 }, chroma: { min: 0.03, max: 0.06 } },
      farMix: 0.22,
      depthCurve: 0.9,
      baseHaze: 0.7,
      rimOpacity: 0.25,
    },
    grainOpacity: { min: 0.12, max: 0.17 },
    vignetteOpacity: { min: 0.42, max: 0.55 },
  },
  dunes: {
    palettes: [
      // Midday erg: deep blue sky over orange sand
      { zenithHue: { min: 238, max: 252 }, horizonHue: { min: 78, max: 95 }, lightHue: { min: 85, max: 95 }, terrainHue: { min: 55, max: 68 } },
      // Desert sunset: violet zenith, orange horizon, red sand
      { zenithHue: { min: 268, max: 288 }, horizonHue: { min: 44, max: 58 }, lightHue: { min: 55, max: 66 }, terrainHue: { min: 36, max: 48 } },
      // Rose dawn: blue zenith, peach horizon, apricot sand
      { zenithHue: { min: 250, max: 262 }, horizonHue: { min: 18, max: 34 }, lightHue: { min: 48, max: 60 }, terrainHue: { min: 42, max: 55 } },
    ],
    zenith: { light: { min: 0.44, max: 0.54 }, chroma: { min: 0.1, max: 0.14 } },
    horizon: { light: { min: 0.85, max: 0.91 }, chroma: { min: 0.06, max: 0.1 } },
    horizonY: { min: 470, max: 510 },
    light: {
      kind: 'sun',
      radius: { min: 26, max: 34 },
      elevation: { min: 90, max: 190 },
      chroma: 0.05,
      haloScale: 3.6,
      bloomRadius: { min: 440, max: 580 },
      bloomOpacity: { min: 0.38, max: 0.52 },
      bloomChroma: 0.11,
      washRadius: 760,
      washOpacity: { min: 0.1, max: 0.18 },
      crescent: null,
    },
    clouds: {
      count: { min: 1, max: 3 },
      top: 70,
      horizonGap: 170,
      width: { min: 240, max: 520 },
      height: { min: 16, max: 34 },
      puffs: { min: 3, max: 5 },
      puffWidth: { min: 0.25, max: 0.5 },
      puffHeight: { min: 0.5, max: 1 },
      billow: 0.25,
      opacity: { min: 0.22, max: 0.4 },
      lift: 0.1,
      chroma: 0.5,
      lightTint: 0.55,
      lightReach: 640,
      blur: 14,
    },
    stars: null,
    haze: { zenithMix: 0.12, opacity: { min: 0.5, max: 0.7 }, above: 110, below: 50 },
    ground: {
      kind: 'layers',
      layerCount: { min: 4, max: 5 },
      spacing: 1.25,
      foregroundY: 770,
      relief: { far: { min: 60, max: 100 }, near: { min: 150, max: 220 } },
      peaks: null,
      rolling: { cells: { min: 2, max: 3 }, octaves: 2, gain: 0.35 },
      dunes: {
        crests: { min: 2, max: 3 },
        crestJitter: 0.3,
        windward: { min: 260, max: 480 },
        lee: { min: 80, max: 150 },
        leeCurve: 1.4,
        height: { min: 0.6, max: 1 },
        undulation: 0.25,
        leeShadow: 0.6,
        farShadow: 0.5,
        shadowLight: 0.62,
        shadowSkyMix: 0.3,
        shadowSkew: 60,
      },
      near: { light: { min: 0.5, max: 0.6 }, chroma: { min: 0.11, max: 0.15 } },
      farMix: 0.3,
      depthCurve: 0.85,
      baseHaze: 0.55,
      rimOpacity: 0.45,
    },
    grainOpacity: { min: 0.12, max: 0.17 },
    vignetteOpacity: { min: 0.38, max: 0.5 },
  },
  dusk: {
    palettes: [
      // Indigo blue hour: indigo zenith, orange afterglow, blue-violet hills
      { zenithHue: { min: 262, max: 275 }, horizonHue: { min: 45, max: 65 }, lightHue: { min: 85, max: 95 }, terrainHue: { min: 268, max: 285 } },
      // Violet twilight: violet zenith, rose horizon, violet hills
      { zenithHue: { min: 285, max: 300 }, horizonHue: { min: 0, max: 20 }, lightHue: { min: 70, max: 90 }, terrainHue: { min: 285, max: 302 } },
      // Plum afterglow: plum zenith, apricot horizon, plum hills
      { zenithHue: { min: 298, max: 314 }, horizonHue: { min: 28, max: 44 }, lightHue: { min: 80, max: 92 }, terrainHue: { min: 295, max: 312 } },
    ],
    zenith: { light: { min: 0.16, max: 0.23 }, chroma: { min: 0.06, max: 0.1 } },
    horizon: { light: { min: 0.6, max: 0.7 }, chroma: { min: 0.1, max: 0.15 } },
    horizonY: { min: 480, max: 520 },
    light: {
      kind: 'moon',
      radius: { min: 20, max: 28 },
      elevation: { min: 180, max: 280 },
      chroma: 0.02,
      haloScale: 4,
      bloomRadius: { min: 260, max: 360 },
      bloomOpacity: { min: 0.18, max: 0.28 },
      bloomChroma: 0.04,
      washRadius: 600,
      washOpacity: { min: 0.04, max: 0.08 },
      crescent: { phase: { min: 0.35, max: 0.55 }, earthshine: 0.1 },
    },
    clouds: null,
    stars: {
      count: { min: 90, max: 130 },
      horizonGap: 120,
      radius: { min: 0.8, max: 1.8 },
      opacity: { min: 0.4, max: 0.9 },
      fade: 0.8,
      bright: { min: 5, max: 8 },
      brightRadius: { min: 2, max: 3 },
      glowScale: 4,
      glowOpacity: 0.15,
    },
    haze: { zenithMix: 0.45, opacity: { min: 0.4, max: 0.6 }, above: 120, below: 50 },
    ground: {
      kind: 'layers',
      layerCount: { min: 4, max: 5 },
      spacing: 1.3,
      foregroundY: 770,
      relief: { far: { min: 60, max: 100 }, near: { min: 50, max: 80 } },
      peaks: null,
      rolling: { cells: { min: 2, max: 4 }, octaves: 2, gain: 0.35 },
      dunes: null,
      near: { light: { min: 0.1, max: 0.14 }, chroma: { min: 0.03, max: 0.05 } },
      farMix: 0.2,
      depthCurve: 0.8,
      baseHaze: 0.6,
      rimOpacity: 0.2,
    },
    grainOpacity: { min: 0.13, max: 0.18 },
    vignetteOpacity: { min: 0.5, max: 0.62 },
  },
  tide: {
    palettes: [
      // Coastal morning: blue zenith, pale gold horizon, slate headlands
      { zenithHue: { min: 232, max: 246 }, horizonHue: { min: 75, max: 92 }, lightHue: { min: 82, max: 92 }, terrainHue: { min: 238, max: 255 } },
      // Sunset coast: indigo zenith, amber horizon, violet headlands
      { zenithHue: { min: 262, max: 278 }, horizonHue: { min: 45, max: 60 }, lightHue: { min: 58, max: 68 }, terrainHue: { min: 285, max: 305 } },
      // Sea glass: teal zenith, aqua horizon, blue-grey headlands
      { zenithHue: { min: 214, max: 228 }, horizonHue: { min: 186, max: 200 }, lightHue: { min: 95, max: 105 }, terrainHue: { min: 218, max: 235 } },
    ],
    zenith: { light: { min: 0.42, max: 0.52 }, chroma: { min: 0.09, max: 0.13 } },
    horizon: { light: { min: 0.84, max: 0.9 }, chroma: { min: 0.05, max: 0.09 } },
    horizonY: { min: 440, max: 470 },
    light: {
      kind: 'sun',
      radius: { min: 24, max: 32 },
      elevation: { min: 60, max: 150 },
      chroma: 0.05,
      haloScale: 3.4,
      bloomRadius: { min: 420, max: 540 },
      bloomOpacity: { min: 0.35, max: 0.5 },
      bloomChroma: 0.1,
      washRadius: 700,
      washOpacity: { min: 0.08, max: 0.14 },
      crescent: null,
    },
    clouds: {
      count: { min: 3, max: 5 },
      top: 60,
      horizonGap: 140,
      width: { min: 220, max: 460 },
      height: { min: 20, max: 42 },
      puffs: { min: 4, max: 6 },
      puffWidth: { min: 0.22, max: 0.45 },
      puffHeight: { min: 0.5, max: 1 },
      billow: 0.35,
      opacity: { min: 0.28, max: 0.5 },
      lift: 0.1,
      chroma: 0.5,
      lightTint: 0.5,
      lightReach: 600,
      blur: 12,
    },
    stars: null,
    haze: { zenithMix: 0.15, opacity: { min: 0.45, max: 0.65 }, above: 90, below: 40 },
    ground: {
      kind: 'coast',
      headlands: { min: 1, max: 2 },
      headlandSpan: { far: { min: 0.36, max: 0.46 }, near: { min: 0.22, max: 0.32 } },
      headlandRelief: { far: { min: 50, max: 80 }, near: { min: 90, max: 140 } },
      headlandFloor: 0.35,
      headlandTaper: 1.4,
      headlandNoise: { cells: { min: 2, max: 4 }, octaves: 4, gain: 0.5 },
      land: { light: { min: 0.2, max: 0.28 }, chroma: { min: 0.03, max: 0.05 } },
      farMix: 0.35,
      reflectionOpacity: 0.3,
      reflectionSquash: 0.6,
      surfaceLight: 0.86,
      deep: { light: { min: 0.22, max: 0.3 }, chroma: { min: 0.06, max: 0.09 } },
      glowOpacity: 0.3,
      glintRows: 26,
      glintSpacing: 1.7,
      glintHeight: { min: 1.2, max: 6 },
      glintWidth: { min: 14, max: 150 },
      glintJitter: 0.4,
      glintScatter: 0.5,
      glintBreaks: { min: 1, max: 3 },
      glintPiece: { min: 0.3, max: 0.9 },
      glintOpacity: { min: 0.45, max: 0.8 },
      glintFade: 0.75,
      swells: { min: 12, max: 18 },
      swellThickness: { min: 0.8, max: 3 },
      swellLength: { min: 150, max: 850 },
      swellOpacity: { min: 0.06, max: 0.16 },
      shoreY: { min: 690, max: 730 },
      shoreTilt: { min: 20, max: 45 },
      shoreWobble: 12,
      shoreNoise: { cells: { min: 3, max: 5 }, octaves: 2, gain: 0.4 },
      sandHue: { min: 55, max: 75 },
      sand: { light: { min: 0.36, max: 0.44 }, chroma: { min: 0.04, max: 0.06 } },
      wetMix: 0.35,
      wetBand: 0.25,
      foregroundShade: 0.75,
      sheenWidth: 12,
      sheenOpacity: 0.28,
      foamWidth: 2.4,
      foamOpacity: 0.6,
      laceOffset: 14,
      laceWidth: 1.4,
      laceStrength: 0.5,
      laceSegments: 6,
      laceDash: { min: 20, max: 90 },
      laceGap: { min: 8, max: 30 },
    },
    grainOpacity: { min: 0.12, max: 0.17 },
    vignetteOpacity: { min: 0.4, max: 0.52 },
  },
};

/**
 * 32-bit FNV-1a hash of a seed string.
 * Deterministic across all JavaScript platforms and locales.
 */
export function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Seeded Mulberry32 pseudo-random number generator.
 * Produces uniform floating-point values in [0, 1).
 */
export function createPrng(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rgb = readonly [number, number, number];

/** Linear-light tolerance for gamut checks; bisection steps when reducing chroma. */
const GAMUT_TOLERANCE = 1e-4;
const GAMUT_STEPS = 12;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;

function oklchToLinearRgb(l: number, c: number, h: number): Rgb {
  const hRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const l3 = l_ * l_ * l_;
  const m3 = m_ * m_ * m_;
  const s3 = s_ * s_ * s_;

  return [
    +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
  ];
}

const inGamut = (rgb: Rgb): boolean =>
  rgb.every((channel) => channel >= -GAMUT_TOLERANCE && channel <= 1 + GAMUT_TOLERANCE);

const encodeSrgb = (channel: number): number =>
  channel <= 0.0031308 ? 12.92 * channel : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055;

/**
 * Converts OKLCH (Lightness 0..1, Chroma 0..0.4, Hue 0..360) to standard sRGB hex (#rrggbb).
 * Out-of-gamut colours keep their lightness and hue and lose chroma until they fit.
 */
export function oklchToHex(l: number, c: number, h: number): string {
  const lightness = clamp(l, 0, 1);
  const chroma = clamp(c, 0, 0.4);
  let rgb = oklchToLinearRgb(lightness, chroma, h);
  if (!inGamut(rgb)) {
    let low = 0;
    let high = chroma;
    for (let step = 0; step < GAMUT_STEPS; step++) {
      const middle = (low + high) / 2;
      if (inGamut(oklchToLinearRgb(lightness, middle, h))) low = middle;
      else high = middle;
    }
    rgb = oklchToLinearRgb(lightness, low, h);
  }
  return `#${rgb
    .map((channel) => Math.round(encodeSrgb(clamp(channel, 0, 1)) * 255).toString(16).padStart(2, '0'))
    .join('')}`;
}

const WIDTH = SCENE_FRAME.width;
const HEIGHT = SCENE_FRAME.height;

/** Rounds viewBox coordinates to one decimal for compact, deterministic markup. */
const coord = (n: number): number => Math.round(n * 10) / 10;
/** Rounds opacities and gradient offsets to three decimals. */
const unit = (n: number): number => Math.round(n * 1000) / 1000;

interface Point {
  readonly x: number;
  readonly y: number;
}

interface Oklch {
  readonly l: number;
  readonly c: number;
  readonly h: number;
}

const oklch = (l: number, c: number, h: number): Oklch => ({ l, c, h: ((h % 360) + 360) % 360 });

/** Mixes two OKLCH colours, turning the hue the short way round. */
function mix(from: Oklch, to: Oklch, t: number): Oklch {
  const turn = ((to.h - from.h + 540) % 360) - 180;
  return oklch(lerp(from.l, to.l, t), lerp(from.c, to.c, t), from.h + turn * t);
}

const hex = (color: Oklch): string => oklchToHex(color.l, color.c, color.h);

interface Random {
  readonly next: () => number;
  readonly between: (min: number, max: number) => number;
  readonly range: (range: Range) => number;
  readonly int: (range: Range) => number;
  readonly pick: <T>(items: readonly T[]) => T;
}

function createRandom(seed: number): Random {
  const next = createPrng(seed);
  const between = (min: number, max: number): number => min + next() * (max - min);
  return {
    next,
    between,
    range: (range) => between(range.min, range.max),
    int: (range) => Math.floor(between(range.min, range.max + 1)),
    pick: (items) => {
      const item = items[Math.floor(next() * items.length)];
      if (item === undefined) throw new Error('Cannot pick from an empty list');
      return item;
    },
  };
}

type Curve = (t: number) => number;

/** Smoothly interpolated 1D value noise over [0, 1]. */
function valueNoise(random: Random, cells: number): Curve {
  const lattice = Array.from({ length: cells + 2 }, () => random.next());
  return (t) => {
    const position = clamp(t, 0, 1) * cells;
    const index = Math.floor(position);
    const s = position - index;
    return lerp(lattice[index]!, lattice[index + 1]!, s * s * (3 - 2 * s));
  };
}

/** Fractal value noise in [0, 1]. Ridged octaves fold around their midpoint into sharp crests. */
function fractalNoise(random: Random, noise: NoiseParameters, ridged = false, sharpness = 1): Curve {
  const cells = random.int(noise.cells);
  const octaves = Array.from({ length: noise.octaves }, (_, octave) => ({
    curve: valueNoise(random, cells * 2 ** octave),
    weight: noise.gain ** octave,
  }));
  const total = octaves.reduce((sum, octave) => sum + octave.weight, 0);
  return (t) =>
    octaves.reduce((sum, { curve, weight }) => {
      const value = curve(t);
      return sum + weight * (ridged ? (1 - Math.abs(2 * value - 1)) ** sharpness : value);
    }, 0) / total;
}

type Attributes = Readonly<Record<string, string | number>>;

function tag(name: string, attributes: Attributes, children = ''): string {
  const attrs = Object.entries(attributes)
    .map(([key, value]) => ` ${key}="${value}"`)
    .join('');
  return children ? `<${name}${attrs}>${children}</${name}>` : `<${name}${attrs}/>`;
}

const part = (name: string, children: string, attributes: Attributes = {}): string =>
  tag('g', { 'data-part': name, ...attributes }, children);

const url = (id: string): string => `url(#${id})`;

interface Stop {
  readonly offset: number;
  readonly color: Oklch;
  readonly opacity?: number;
}

function gradientStops(stops: readonly Stop[]): string {
  return stops
    .map(({ offset, color, opacity }) =>
      tag(
        'stop',
        opacity === undefined
          ? { offset: unit(offset), 'stop-color': hex(color) }
          : { offset: unit(offset), 'stop-color': hex(color), 'stop-opacity': unit(opacity) },
      ),
    )
    .join('');
}

interface Falloff {
  readonly offset: number;
  readonly strength: number;
}

const falloffStops = (color: Oklch, opacity: number, falloff: readonly Falloff[]): string =>
  gradientStops(falloff.map(({ offset, strength }) => ({ offset, color, opacity: opacity * strength })));

function sample(from: number, to: number, y: (x: number) => number): Point[] {
  const steps = Math.max(1, Math.round(Math.abs(to - from) / SCENE_FRAME.sampleStep));
  return Array.from({ length: steps + 1 }, (_, index) => {
    const x = lerp(from, to, index / steps);
    return { x, y: y(x) };
  });
}

function linePath(points: readonly Point[]): string {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${coord(point.x)} ${coord(point.y)}`).join('');
}

/** Closes a profile down to `baseY`, producing a filled silhouette. */
function silhouettePath(points: readonly Point[], baseY: number): string {
  const first = points[0]!;
  const last = points[points.length - 1]!;
  return `${linePath(points)}L${coord(last.x)} ${coord(baseY)}L${coord(first.x)} ${coord(baseY)}Z`;
}

interface Light {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly color: Oklch;
  readonly bloom: Oklch;
}

interface SceneContext {
  readonly random: Random;
  readonly id: (name: string) => string;
  readonly params: VariantParameters;
  readonly horizonY: number;
  readonly zenith: Oklch;
  readonly horizon: Oklch;
  /** Atmosphere colour: what distant terrain fades into. */
  readonly haze: Oklch;
  readonly terrainHue: number;
  readonly light: Light;
  readonly defs: string[];
  readonly content: string[];
}

/** Sky colour at `t` (0 zenith, 1 horizon), with a chroma dip so opposed hues do not pass through mud. */
function skyColor(ctx: SceneContext, t: number): Oklch {
  const { curve, chromaDip } = SCENE_FRAME.sky;
  const eased = clamp(t, 0, 1) ** curve;
  const color = mix(ctx.zenith, ctx.horizon, eased);
  return oklch(color.l, color.c * (1 - chromaDip * 4 * eased * (1 - eased)), color.h);
}

function paintSky(ctx: SceneContext): void {
  const { random, light } = ctx;
  const sky = ctx.id('sky');
  const bloom = ctx.id('bloom');
  ctx.defs.push(
    tag(
      'linearGradient',
      { id: sky, gradientUnits: 'userSpaceOnUse', x1: 0, y1: 0, x2: 0, y2: coord(ctx.horizonY) },
      gradientStops(SCENE_FRAME.sky.stops.map((offset) => ({ offset, color: skyColor(ctx, offset) }))),
    ),
    tag(
      'radialGradient',
      { id: bloom },
      falloffStops(light.bloom, random.range(ctx.params.light.bloomOpacity), SCENE_FRAME.bloom.falloff),
    ),
  );
  ctx.content.push(
    part(
      'sky',
      tag('rect', { width: WIDTH, height: HEIGHT, fill: url(sky) }) +
        tag('circle', {
          cx: coord(light.x),
          cy: coord(light.y),
          r: coord(random.range(ctx.params.light.bloomRadius)),
          fill: url(bloom),
        }),
    ),
  );
}

function paintStars(ctx: SceneContext, stars: StarParameters): void {
  const { random } = ctx;
  const ceiling = ctx.horizonY - stars.horizonGap;
  const fill = hex(ctx.light.color);
  const place = () => {
    const y = random.between(0, ceiling);
    return { x: coord(random.between(0, WIDTH)), y: coord(y), fade: (1 - y / ceiling) ** stars.fade };
  };
  const dots = Array.from({ length: random.int(stars.count) }, () => {
    const radius = random.range(stars.radius);
    const { x, y, fade } = place();
    return tag('circle', { cx: x, cy: y, r: coord(radius), fill, opacity: unit(random.range(stars.opacity) * fade) });
  });
  const bright = Array.from({ length: random.int(stars.bright) }, () => {
    const radius = random.range(stars.brightRadius);
    const { x, y, fade } = place();
    return (
      tag('circle', { cx: x, cy: y, r: coord(radius * stars.glowScale), fill, opacity: unit(stars.glowOpacity * fade) }) +
      tag('circle', { cx: x, cy: y, r: coord(radius), fill, opacity: unit(fade) })
    );
  });
  ctx.content.push(part('stars', dots.join('') + bright.join('')));
}

function paintClouds(ctx: SceneContext, clouds: CloudParameters): void {
  const { random, light } = ctx;
  const blur = ctx.id('cloud-blur');
  ctx.defs.push(
    tag('filter', { id: blur, x: '-20%', y: '-60%', width: '140%', height: '220%' }, tag('feGaussianBlur', { stdDeviation: clouds.blur })),
  );
  const shapes = Array.from({ length: random.int(clouds.count) }, () => {
    const x = random.between(0, WIDTH);
    const y = random.between(clouds.top, ctx.horizonY - clouds.horizonGap);
    const width = random.range(clouds.width);
    const height = random.range(clouds.height);
    const sky = skyColor(ctx, y / ctx.horizonY);
    const nearLight = clamp(1 - Math.hypot(x - light.x, y - light.y) / clouds.lightReach, 0, 1);
    const fill = hex(mix(oklch(sky.l + clouds.lift, sky.c * clouds.chroma, sky.h), light.bloom, clouds.lightTint * nearLight));
    const opacity = unit(random.range(clouds.opacity));
    return Array.from({ length: random.int(clouds.puffs) }, () =>
      tag('ellipse', {
        cx: coord(x + random.between(-0.5, 0.5) * width),
        cy: coord(y - random.between(0, clouds.billow) * height),
        rx: coord(width * random.range(clouds.puffWidth)),
        ry: coord(height * random.range(clouds.puffHeight)),
        fill,
        opacity,
      }),
    ).join('');
  });
  ctx.content.push(part('clouds', shapes.join(''), { filter: url(blur) }));
}

function paintLight(ctx: SceneContext): void {
  const { light, params } = ctx;
  const halo = ctx.id('halo');
  ctx.defs.push(tag('radialGradient', { id: halo }, falloffStops(light.color, 1, SCENE_FRAME.halo)));
  const disc = { cx: coord(light.x), cy: coord(light.y), r: coord(light.radius) };
  const fill = hex(light.color);
  const layers = [tag('circle', { ...disc, r: coord(light.radius * params.light.haloScale), fill: url(halo) })];
  const { crescent } = params.light;
  if (crescent) {
    const mask = ctx.id('crescent');
    const offset = ctx.random.range(crescent.phase) * light.radius;
    const away = light.x > WIDTH / 2 ? 1 : -1;
    ctx.defs.push(
      tag(
        'mask',
        { id: mask },
        tag('circle', { ...disc, fill: '#fff' }) +
          tag('circle', {
            ...disc,
            cx: coord(light.x + away * offset),
            cy: coord(light.y - offset * SCENE_FRAME.moonTilt),
            fill: '#000',
          }),
      ),
    );
    layers.push(tag('circle', { ...disc, fill, opacity: crescent.earthshine }), tag('circle', { ...disc, fill, mask: url(mask) }));
  } else {
    layers.push(tag('circle', { ...disc, fill }));
  }
  ctx.content.push(part('light', layers.join('')));
}

/** Horizon haze band in the atmosphere colour. */
function hazeBand(ctx: SceneContext): string {
  const { haze } = ctx.params;
  const gradient = ctx.id('haze');
  const opacity = ctx.random.range(haze.opacity);
  ctx.defs.push(
    tag(
      'linearGradient',
      { id: gradient, x1: 0, y1: 0, x2: 0, y2: 1 },
      gradientStops([
        { offset: 0, color: ctx.haze, opacity: 0 },
        { offset: haze.above / (haze.above + haze.below), color: ctx.haze, opacity },
        { offset: 1, color: ctx.haze, opacity: 0 },
      ]),
    ),
  );
  return part(
    'haze',
    tag('rect', { y: coord(ctx.horizonY - haze.above), width: WIDTH, height: haze.above + haze.below, fill: url(gradient) }),
  );
}

interface Crest {
  readonly x: number;
  readonly height: number;
  readonly windward: number;
  readonly lee: number;
}

interface Profile {
  /** Relief at `t` across the frame, roughly in [0, 1]. */
  readonly lift: Curve;
  readonly crests: readonly Crest[];
}

function peakProfile(random: Random, peaks: PeakParameters): Profile {
  const ridges = fractalNoise(random, peaks, true, peaks.sharpness);
  const massifs = Array.from({ length: random.int(peaks.massifs) }, () => ({
    center: random.next(),
    width: random.range(peaks.massifWidth),
  }));
  return {
    lift: (t) => {
      const envelope = Math.max(0, ...massifs.map(({ center, width }) => Math.exp(-(((t - center) / width) ** 2))));
      return ridges(t) * lerp(peaks.massifFloor, 1, envelope);
    },
    crests: [],
  };
}

/** Sweeping dunes: a gentle windward slope facing the light and a steep lee face behind each crest. */
function duneProfile(random: Random, ground: LayeredGround, dunes: DuneParameters, leeSide: number): Profile {
  const count = random.int(dunes.crests);
  const crests: Crest[] = Array.from({ length: count }, (_, index) => ({
    x: ((index + 0.5 + random.between(-dunes.crestJitter, dunes.crestJitter)) / count) * WIDTH,
    height: random.range(dunes.height),
    windward: random.range(dunes.windward),
    lee: random.range(dunes.lee),
  }));
  const undulation = fractalNoise(random, ground.rolling);
  const bump = (crest: Crest, x: number): number => {
    const offset = (x - crest.x) * leeSide;
    if (offset >= 0) return offset < crest.lee ? crest.height * (1 - offset / crest.lee) ** dunes.leeCurve : 0;
    const u = -offset / crest.windward;
    return u < 1 ? (crest.height * (1 + Math.cos(Math.PI * u))) / 2 : 0;
  };
  return {
    lift: (t) => Math.max(dunes.undulation * undulation(t), ...crests.map((crest) => bump(crest, t * WIDTH))),
    crests,
  };
}

function layerProfile(random: Random, ground: LayeredGround, depth: number, leeSide: number): Profile {
  if (ground.dunes) return duneProfile(random, ground, ground.dunes, leeSide);
  if (ground.peaks && depth <= ground.peaks.foothillDepth) return peakProfile(random, ground.peaks);
  return { lift: fractalNoise(random, ground.rolling), crests: [] };
}

/** Shaded lee faces: from each crest down its lee slope, closed by a curved shadow edge. */
function leeShadows(
  ctx: SceneContext,
  dunes: DuneParameters,
  profile: Profile,
  ridgeY: (x: number) => number,
  color: Oklch,
  depth: number,
  leeSide: number,
  bottom: number,
): string[] {
  const tint = mix(color, ctx.zenith, dunes.shadowSkyMix);
  const fill = hex(oklch(color.l * dunes.shadowLight, tint.c, tint.h));
  const opacity = unit(dunes.leeShadow * lerp(dunes.farShadow, 1, depth));
  return profile.crests.map((crest) => {
    const end = crest.x + leeSide * crest.lee;
    const foot = crest.x + leeSide * dunes.shadowSkew;
    const slope = sample(crest.x, end, ridgeY);
    const d = `${linePath(slope)}L${coord(end)} ${coord(bottom)}Q${coord(foot)} ${coord(bottom)} ${coord(crest.x)} ${coord(ridgeY(crest.x))}Z`;
    return tag('path', { d, fill, opacity });
  });
}

/** Depth layers from the horizon to the foreground, fading into the atmosphere with distance. */
function paintLayers(ctx: SceneContext, ground: LayeredGround): void {
  const { random } = ctx;
  const count = random.int(ground.layerCount);
  const near = oklch(random.range(ground.near.light), random.range(ground.near.chroma), ctx.terrainHue);
  const leeSide = ctx.light.x > WIDTH / 2 ? -1 : 1;
  const depthAt = (index: number) => (count > 1 ? index / (count - 1) : 1);
  const baseAt = (index: number) => lerp(ctx.horizonY, ground.foregroundY, depthAt(index) ** ground.spacing);
  const layers: string[] = [];

  for (let index = 0; index < count; index++) {
    const depth = depthAt(index);
    const baseY = baseAt(index);
    const relief = lerp(random.range(ground.relief.far), random.range(ground.relief.near), depth);
    const profile = layerProfile(random, ground, depth, leeSide);
    const ridgeY = (x: number) => Math.max(SCENE_FRAME.minRidgeY, baseY - relief * profile.lift(x / WIDTH));
    const points = sample(0, WIDTH, ridgeY);
    const color = mix(ctx.haze, near, lerp(ground.farMix, 1, depth ** ground.depthCurve));
    const top = Math.min(...points.map((point) => point.y));
    const bottom = index < count - 1 ? baseAt(index + 1) : HEIGHT;
    const gradient = ctx.id(`layer-${index}`);
    ctx.defs.push(
      tag(
        'linearGradient',
        { id: gradient, gradientUnits: 'userSpaceOnUse', x1: 0, y1: coord(top), x2: 0, y2: coord(bottom) },
        gradientStops([
          { offset: 0, color },
          { offset: 1, color: mix(color, ctx.haze, ground.baseHaze * (1 - depth)) },
        ]),
      ),
    );
    layers.push(tag('path', { d: silhouettePath(points, HEIGHT), fill: url(gradient), 'data-layer': index }));
    if (index < count - 1 && ground.rimOpacity > 0) {
      layers.push(
        tag('path', {
          d: linePath(points),
          fill: 'none',
          stroke: hex(mix(color, ctx.light.color, SCENE_FRAME.rim.lightMix)),
          'stroke-width': SCENE_FRAME.rim.width,
          'stroke-linejoin': 'round',
          opacity: unit(ground.rimOpacity * (1 - depth)),
        }),
      );
    }
    if (ground.dunes) layers.push(...leeShadows(ctx, ground.dunes, profile, ridgeY, color, depth, leeSide, bottom));
    if (index === 0) layers.push(hazeBand(ctx));
  }

  ctx.content.push(part('ground', layers.join('')));
}

function shoreline(random: Random, coast: CoastGround): Point[] {
  const baseY = random.range(coast.shoreY);
  const tilt = random.range(coast.shoreTilt) * (random.next() < 0.5 ? -1 : 1);
  const wobble = fractalNoise(random, coast.shoreNoise);
  return sample(0, WIDTH, (x) => baseY + tilt * ((x / WIDTH) * 2 - 1) + coast.shoreWobble * (wobble(x / WIDTH) * 2 - 1));
}

/** Headlands on the side away from the light, mirrored and squashed into the water. */
function paintHeadlands(ctx: SceneContext, coast: CoastGround): { land: string; reflections: string } {
  const { random, horizonY } = ctx;
  const edge = ctx.light.x > WIDTH / 2 ? 0 : WIDTH;
  const count = random.int(coast.headlands);
  const near = oklch(random.range(coast.land.light), random.range(coast.land.chroma), ctx.terrainHue);
  const squash = coast.reflectionSquash;
  const mirror = `matrix(1 0 0 ${-squash} 0 ${coord((1 + squash) * horizonY)})`;
  const land: string[] = [];
  const reflections: string[] = [];
  for (let index = 0; index < count; index++) {
    const depth = count > 1 ? index / (count - 1) : 1;
    const reach = lerp(random.range(coast.headlandSpan.far), random.range(coast.headlandSpan.near), depth) * WIDTH;
    const relief = lerp(random.range(coast.headlandRelief.far), random.range(coast.headlandRelief.near), depth);
    const ridges = fractalNoise(random, coast.headlandNoise, true);
    const points = sample(edge, edge === 0 ? reach : WIDTH - reach, (x) => {
      const u = Math.abs(x - edge) / reach;
      return horizonY - relief * lerp(coast.headlandFloor, 1, ridges(u)) * (1 - u) ** coast.headlandTaper;
    });
    const d = silhouettePath(points, horizonY);
    const fill = hex(mix(ctx.haze, near, lerp(coast.farMix, 1, depth)));
    reflections.push(tag('path', { d, fill, opacity: coast.reflectionOpacity, transform: mirror }));
    land.push(tag('path', { d, fill, 'data-layer': index }));
  }
  return { land: land.join(''), reflections: reflections.join('') };
}

/** Broken horizontal bands of light under the sun, widening toward the viewer. */
function paintGlint(ctx: SceneContext, coast: CoastGround, shoreTop: number): string {
  const { random, light, horizonY } = ctx;
  const depth = shoreTop - horizonY;
  const glow = ctx.id('glint-glow');
  ctx.defs.push(tag('radialGradient', { id: glow }, falloffStops(light.color, coast.glowOpacity, SCENE_FRAME.fade)));
  const fill = hex(light.color);
  const bands = [
    tag('ellipse', {
      cx: coord(light.x),
      cy: coord(horizonY + depth / 2),
      rx: coord(coast.glintWidth.max),
      ry: coord(depth / 2),
      fill: url(glow),
    }),
  ];
  for (let row = 0; row < coast.glintRows; row++) {
    const u = (row + 1) / coast.glintRows;
    const y = horizonY + depth * u ** coast.glintSpacing;
    const height = lerp(coast.glintHeight.min, coast.glintHeight.max, u);
    const half = lerp(coast.glintWidth.min, coast.glintWidth.max, u) * random.between(1 - coast.glintJitter, 1 + coast.glintJitter);
    const pieces = random.int(coast.glintBreaks);
    for (let piece = 0; piece < pieces; piece++) {
      const center = light.x + random.between(-coast.glintScatter, coast.glintScatter) * half;
      const width = half * random.range(coast.glintPiece);
      bands.push(
        tag('rect', {
          x: coord(center - width),
          y: coord(y - height / 2),
          width: coord(width * 2),
          height: coord(height),
          rx: coord(height / 2),
          fill,
          opacity: unit(random.range(coast.glintOpacity) * (1 - coast.glintFade * u)),
        }),
      );
    }
  }
  return bands.join('');
}

/** Coastline: sea reflecting the sky, headlands, sun glint, swell texture, wet sand and foam. */
function paintCoast(ctx: SceneContext, coast: CoastGround): void {
  const { random, horizonY, light } = ctx;
  const surface = oklch(ctx.haze.l * coast.surfaceLight, ctx.haze.c, ctx.haze.h);
  const deep = oklch(random.range(coast.deep.light), random.range(coast.deep.chroma), ctx.zenith.h);
  const shore = shoreline(random, coast);
  const shoreTop = Math.min(...shore.map((point) => point.y));
  const { land, reflections } = paintHeadlands(ctx, coast);
  const glint = paintGlint(ctx, coast, shoreTop);

  const swells = Array.from({ length: random.int(coast.swells) }, () => {
    const u = random.next();
    const length = lerp(coast.swellLength.min, coast.swellLength.max, u);
    return tag('rect', {
      x: coord(random.between(-length / 2, WIDTH - length / 2)),
      y: coord(horizonY + (shoreTop - horizonY) * u ** coast.glintSpacing),
      width: coord(length),
      height: coord(lerp(coast.swellThickness.min, coast.swellThickness.max, u)),
      fill: hex(random.next() < 0.5 ? surface : deep),
      opacity: unit(random.range(coast.swellOpacity)),
    });
  });

  const sea = ctx.id('sea');
  const sandId = ctx.id('sand');
  const sand = oklch(random.range(coast.sand.light), random.range(coast.sand.chroma), random.range(coast.sandHue));
  const dashes = Array.from({ length: coast.laceSegments }, (_, index) =>
    coord(random.range(index % 2 === 0 ? coast.laceDash : coast.laceGap)),
  ).join(' ');
  ctx.defs.push(
    tag(
      'linearGradient',
      { id: sea, gradientUnits: 'userSpaceOnUse', x1: 0, y1: coord(horizonY), x2: 0, y2: coord(shoreTop) },
      gradientStops([
        { offset: 0, color: surface },
        { offset: 1, color: deep },
      ]),
    ),
    tag(
      'linearGradient',
      { id: sandId, gradientUnits: 'userSpaceOnUse', x1: 0, y1: coord(shoreTop), x2: 0, y2: HEIGHT },
      gradientStops([
        { offset: 0, color: mix(sand, ctx.horizon, coast.wetMix) },
        { offset: coast.wetBand, color: sand },
        { offset: 1, color: oklch(sand.l * coast.foregroundShade, sand.c, sand.h) },
      ]),
    ),
  );

  const edge = linePath(shore);
  const foam = hex(light.color);
  const beach = [
    tag('path', { d: silhouettePath(shore, HEIGHT), fill: url(sandId) }),
    tag('path', {
      d: edge,
      fill: 'none',
      stroke: hex(ctx.horizon),
      'stroke-width': coast.sheenWidth,
      opacity: coast.sheenOpacity,
      transform: `translate(0 ${coord(coast.sheenWidth / 2)})`,
    }),
    tag('path', { d: edge, fill: 'none', stroke: foam, 'stroke-width': coast.foamWidth, opacity: coast.foamOpacity }),
    tag('path', {
      d: edge,
      fill: 'none',
      stroke: foam,
      'stroke-width': coast.laceWidth,
      'stroke-dasharray': dashes,
      opacity: unit(coast.foamOpacity * coast.laceStrength),
      transform: `translate(0 ${-coast.laceOffset})`,
    }),
  ];

  ctx.content.push(
    part(
      'ground',
      part('water', tag('rect', { y: coord(horizonY), width: WIDTH, height: coord(HEIGHT - horizonY), fill: url(sea) }) + swells.join('')) +
        part('reflection', reflections + glint) +
        part('land', land) +
        hazeBand(ctx) +
        part('shore', beach.join('')),
    ),
  );
}

/** Light wash over the whole frame, lens vignette and film grain. */
function paintFinish(ctx: SceneContext, hash: number): void {
  const { random, light, params } = ctx;
  const { vignette, grain } = SCENE_FRAME;
  const wash = ctx.id('wash');
  const vignetteId = ctx.id('vignette');
  const grainId = ctx.id('grain');
  const vignetteColor = oklch(vignette.lightness, vignette.chroma, ctx.zenith.h);
  const channel = (name: string) =>
    tag(name, { type: 'linear', slope: grain.contrast, intercept: unit((1 - grain.contrast) / 2) });
  ctx.defs.push(
    tag('radialGradient', { id: wash }, falloffStops(light.bloom, random.range(params.light.washOpacity), SCENE_FRAME.fade)),
    tag(
      'radialGradient',
      { id: vignetteId, r: vignette.radius },
      gradientStops([
        { offset: vignette.inner, color: vignetteColor, opacity: 0 },
        { offset: 1, color: vignetteColor, opacity: random.range(params.vignetteOpacity) },
      ]),
    ),
    tag(
      'filter',
      { id: grainId, x: 0, y: 0, width: 1, height: 1, 'color-interpolation-filters': 'sRGB' },
      tag('feTurbulence', {
        type: 'fractalNoise',
        baseFrequency: grain.frequency,
        numOctaves: grain.octaves,
        seed: hash % grain.seeds,
        stitchTiles: 'stitch',
      }) +
        tag('feColorMatrix', { type: 'saturate', values: 0 }) +
        tag(
          'feComponentTransfer',
          {},
          channel('feFuncR') + channel('feFuncG') + channel('feFuncB') + tag('feFuncA', { type: 'linear', slope: 0, intercept: 1 }),
        ),
    ),
  );
  ctx.content.push(
    part(
      'wash',
      tag('circle', {
        cx: coord(light.x),
        cy: coord(light.y),
        r: params.light.washRadius,
        fill: url(wash),
        style: 'mix-blend-mode:screen',
      }),
    ),
    part('vignette', tag('rect', { width: WIDTH, height: HEIGHT, fill: url(vignetteId) })),
    part(
      'grain',
      tag('rect', {
        width: WIDTH,
        height: HEIGHT,
        filter: url(grainId),
        opacity: unit(random.range(params.grainOpacity)),
        style: 'mix-blend-mode:overlay',
      }),
    ),
  );
}

export interface GeneratedSceneParts {
  defs: string;
  content: string;
}

/**
 * Generates the SVG defs and content elements for a given seed and variant.
 * Guaranteed to return identical output for identical inputs. Ids carry the variant and the
 * seed hash, so scenes inlined in one document never resolve each other's gradients.
 */
export function generateSceneParts(seed: string, variant: SceneVariant = 'landscape'): GeneratedSceneParts {
  const hash = hashSeed(seed);
  const random = createRandom(hash);
  const params = SCENE_PARAMETERS[variant] ?? SCENE_PARAMETERS.landscape;
  const prefix = `sc-${variant}-${hash.toString(36)}`;

  const palette = random.pick(params.palettes);
  const zenith = oklch(random.range(params.zenith.light), random.range(params.zenith.chroma), random.range(palette.zenithHue));
  const horizon = oklch(random.range(params.horizon.light), random.range(params.horizon.chroma), random.range(palette.horizonHue));
  const lightHue = random.range(palette.lightHue);
  const horizonY = random.range(params.horizonY);

  const ctx: SceneContext = {
    random,
    id: (name) => `${prefix}-${name}`,
    params,
    horizonY,
    zenith,
    horizon,
    haze: mix(horizon, zenith, params.haze.zenithMix),
    terrainHue: random.range(palette.terrainHue),
    light: {
      x: random.range(SCENE_FRAME.lightX),
      y: horizonY - random.range(params.light.elevation),
      radius: random.range(params.light.radius),
      color: oklch(SCENE_FRAME.light.lightness, params.light.chroma, lightHue),
      bloom: oklch(SCENE_FRAME.bloom.lightness, params.light.bloomChroma, lightHue),
    },
    defs: [],
    content: [],
  };

  paintSky(ctx);
  if (params.stars) paintStars(ctx, params.stars);
  if (params.clouds) paintClouds(ctx, params.clouds);
  paintLight(ctx);
  if (params.ground.kind === 'coast') paintCoast(ctx, params.ground);
  else paintLayers(ctx, params.ground);
  paintFinish(ctx, hash);

  return { defs: ctx.defs.join(''), content: ctx.content.join('') };
}

/**
 * Returns complete SVG markup string for a seeded procedural scene.
 */
export function generateSceneSvg(seed: string, variant: SceneVariant = 'landscape'): string {
  const { defs, content } = generateSceneParts(seed, variant);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${SCENE_VIEW_BOX}" preserveAspectRatio="xMidYMid slice" width="100%" height="100%"><defs>${defs}</defs>${content}</svg>`;
}
