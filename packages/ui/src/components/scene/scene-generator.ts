/**
 * Procedural scene generator.
 *
 * Deterministic generation model:
 * 1. Seed string is hashed to a 32-bit unsigned integer via FNV-1a.
 * 2. 32-bit hash seeds a Mulberry32 PRNG producing floats in [0, 1).
 * 3. Named parameter table `SCENE_PARAMETERS` defines layer counts, hue bands,
 *    roughness, grain and vignette ranges per variant.
 * 4. Colors are procedural content derived in OKLCH space and converted to
 *    standard sRGB hex colors without dependencies or theme tokens.
 * 5. Artwork is authored on a 1200x800 viewBox with central framing optimized
 *    for both circular avatar crops and panoramic widescreen gallery tiles.
 */

export type SceneVariant = 'landscape' | 'dunes' | 'dusk' | 'tide';

export interface HueBand {
  readonly min: number;
  readonly max: number;
}

export interface Range {
  readonly min: number;
  readonly max: number;
}

export interface VariantParameters {
  readonly layerCount: { readonly min: number; readonly max: number };
  readonly skyHues: readonly HueBand[];
  readonly skyChroma: Range;
  readonly zenithLight: Range;
  readonly horizonLight: Range;
  readonly terrainHueShift: Range;
  readonly terrainChroma: Range;
  readonly celestialKind: 'sun' | 'moon';
  readonly grainOpacity: Range;
  readonly vignetteOpacity: Range;
}

/**
 * Named parameter table for procedural scene variants.
 * Centralizes all numeric ranges to avoid scattered magic numbers.
 */
export const SCENE_PARAMETERS: Record<SceneVariant, VariantParameters> = {
  landscape: {
    layerCount: { min: 4, max: 5 },
    skyHues: [
      { min: 195, max: 220 }, // Alpine azure
      { min: 38, max: 52 },   // Golden hour amber
      { min: 170, max: 190 }, // Glacial teal
    ],
    skyChroma: { min: 0.08, max: 0.13 },
    zenithLight: { min: 0.36, max: 0.48 },
    horizonLight: { min: 0.78, max: 0.88 },
    terrainHueShift: { min: -10, max: 12 },
    terrainChroma: { min: 0.04, max: 0.08 },
    celestialKind: 'sun',
    grainOpacity: { min: 0.035, max: 0.06 },
    vignetteOpacity: { min: 0.22, max: 0.32 },
  },
  dunes: {
    layerCount: { min: 4, max: 5 },
    skyHues: [
      { min: 34, max: 48 }, // Sahara golden amber
      { min: 22, max: 34 }, // Terracotta apricot
      { min: 48, max: 60 }, // Desert sunlight
    ],
    skyChroma: { min: 0.07, max: 0.12 },
    zenithLight: { min: 0.48, max: 0.58 },
    horizonLight: { min: 0.82, max: 0.90 },
    terrainHueShift: { min: -6, max: 8 },
    terrainChroma: { min: 0.11, max: 0.16 },
    celestialKind: 'sun',
    grainOpacity: { min: 0.035, max: 0.06 },
    vignetteOpacity: { min: 0.20, max: 0.30 },
  },
  dusk: {
    layerCount: { min: 4, max: 5 },
    skyHues: [
      { min: 280, max: 310 }, // Twilight violet
      { min: 255, max: 280 }, // Deep indigo nightfall
      { min: 315, max: 340 }, // Crimson twilight
    ],
    skyChroma: { min: 0.12, max: 0.18 },
    zenithLight: { min: 0.18, max: 0.26 },
    horizonLight: { min: 0.62, max: 0.74 },
    terrainHueShift: { min: -15, max: 10 },
    terrainChroma: { min: 0.03, max: 0.07 },
    celestialKind: 'moon',
    grainOpacity: { min: 0.04, max: 0.07 },
    vignetteOpacity: { min: 0.30, max: 0.42 },
  },
  tide: {
    layerCount: { min: 4, max: 5 },
    skyHues: [
      { min: 195, max: 225 }, // Maritime ocean blue
      { min: 170, max: 195 }, // Sea glass aquamarine
      { min: 38, max: 52 },   // Coastal sunset gold
    ],
    skyChroma: { min: 0.08, max: 0.13 },
    zenithLight: { min: 0.38, max: 0.50 },
    horizonLight: { min: 0.76, max: 0.88 },
    terrainHueShift: { min: -8, max: 15 },
    terrainChroma: { min: 0.07, max: 0.12 },
    celestialKind: 'sun',
    grainOpacity: { min: 0.035, max: 0.06 },
    vignetteOpacity: { min: 0.20, max: 0.32 },
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

/**
 * Converts OKLCH (Lightness 0..1, Chroma 0..0.4, Hue 0..360) to standard sRGB hex (#rrggbb).
 * Ensures perceptual uniformity and broad browser compatibility without dependencies.
 */
export function oklchToHex(l: number, c: number, h: number): string {
  const clampedL = Math.max(0, Math.min(1, l));
  const clampedC = Math.max(0, Math.min(0.4, c));
  const hRad = (h * Math.PI) / 180;
  const a = clampedC * Math.cos(hRad);
  const b = clampedC * Math.sin(hRad);

  const l_ = clampedL + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = clampedL - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = clampedL - 0.0894841775 * a - 1.2914855480 * b;

  const l3 = l_ * l_ * l_;
  const m3 = m_ * m_ * m_;
  const s3 = s_ * s_ * s_;

  const rLin = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const gLin = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const bLin = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;

  const transfer = (val: number): number => {
    if (val <= 0.0031308) return 12.92 * val;
    return 1.055 * Math.pow(Math.max(0, val), 1 / 2.4) - 0.055;
  };

  const r = Math.max(0, Math.min(255, Math.round(transfer(rLin) * 255)));
  const g = Math.max(0, Math.min(255, Math.round(transfer(gLin) * 255)));
  const bVal = Math.max(0, Math.min(255, Math.round(transfer(bLin) * 255)));

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bVal.toString(16).padStart(2, '0')}`;
}

/** Formats a coordinate number to 1 decimal place to guarantee compact, deterministic SVG paths. */
const f = (n: number): number => Math.round(n * 10) / 10;

interface Point {
  x: number;
  y: number;
}

function pointsToSvgPath(points: readonly Point[], closeBottom = true, height = 800): string {
  if (points.length < 2) return '';
  const first = points[0]!;
  let d = `M ${f(first.x)} ${f(first.y)}`;
  for (let i = 1; i < points.length; i++) {
    const pt = points[i]!;
    d += ` L ${f(pt.x)} ${f(pt.y)}`;
  }
  if (closeBottom) {
    const last = points[points.length - 1]!;
    d += ` L ${f(last.x)} ${height} L ${f(first.x)} ${height} Z`;
  }
  return d;
}

function smoothPointsToSvgPath(points: readonly Point[], closeBottom = true, height = 800): string {
  if (points.length < 2) return '';
  const first = points[0]!;
  let d = `M ${f(first.x)} ${f(first.y)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${f(cp1x)} ${f(cp1y)}, ${f(cp2x)} ${f(cp2y)}, ${f(p2.x)} ${f(p2.y)}`;
  }
  if (closeBottom) {
    const last = points[points.length - 1]!;
    d += ` L ${f(last.x)} ${height} L ${f(first.x)} ${height} Z`;
  }
  return d;
}

export interface GeneratedSceneParts {
  defs: string;
  content: string;
}

/**
 * Generates the SVG defs and content elements for a given seed and variant.
 * Guaranteed to return identical output for identical inputs.
 */
export function generateSceneParts(seed: string, variant: SceneVariant = 'landscape'): GeneratedSceneParts {
  const hash = hashSeed(seed);
  const rnd = createPrng(hash);
  const range = (min: number, max: number): number => min + rnd() * (max - min);
  const int = (min: number, max: number): number => Math.floor(range(min, max + 1));
  const pick = <T>(arr: readonly T[]): T => {
    const item = arr[Math.floor(rnd() * arr.length)];
    if (item === undefined) {
      throw new Error('Cannot pick from empty array');
    }
    return item;
  };

  const params = SCENE_PARAMETERS[variant] ?? SCENE_PARAMETERS.landscape;
  const idPrefix = 'sc-' + hash.toString(36);

  // Palette derivation with perceptual harmony
  const skyHueBand = pick(params.skyHues);
  const skyHue = range(skyHueBand.min, skyHueBand.max);
  const skyChroma = range(params.skyChroma.min, params.skyChroma.max);
  const zenithL = range(params.zenithLight.min, params.zenithLight.max);
  const horizonL = range(params.horizonLight.min, params.horizonLight.max);
  const midL = (zenithL + horizonL) * 0.52;

  const skyZenith = oklchToHex(zenithL, skyChroma, skyHue);
  const skyMid = oklchToHex(midL, skyChroma * 0.9, skyHue + range(-3, 3));
  const skyHorizon = oklchToHex(horizonL, skyChroma * 0.55, skyHue + range(6, 16));

  const terrainHue = (skyHue + range(params.terrainHueShift.min, params.terrainHueShift.max) + 360) % 360;
  const terrainChroma = range(params.terrainChroma.min, params.terrainChroma.max);

  // Celestial focal position: balanced for both circle (avatar) crops showing sky+terrain and wide tiles.
  // y range chosen so square crops from full-height render place focal point upper-middle, horizon visible.
  const celestialX = range(520, 680);
  const celestialY = range(280, 380);
  const celestialR = range(22, 32);

  const layerCount = int(params.layerCount.min, params.layerCount.max);
  const grainOpacity = f(range(params.grainOpacity.min, params.grainOpacity.max));
  const vignetteOpacity = f(range(params.vignetteOpacity.min, params.vignetteOpacity.max));

  let defs = `
    <linearGradient id="${idPrefix}-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${skyZenith}" />
      <stop offset="50%" stop-color="${skyMid}" />
      <stop offset="100%" stop-color="${skyHorizon}" />
    </linearGradient>
    <radialGradient id="${idPrefix}-celestial-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.9" />
      <stop offset="20%" stop-color="${oklchToHex(0.92, 0.07, skyHue + 15)}" stop-opacity="0.55" />
      <stop offset="55%" stop-color="${oklchToHex(0.85, 0.10, skyHue + 25)}" stop-opacity="0.2" />
      <stop offset="100%" stop-color="${skyHorizon}" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="${idPrefix}-vignette" cx="50%" cy="50%" r="65%">
      <stop offset="35%" stop-color="#000000" stop-opacity="0" />
      <stop offset="100%" stop-color="#000000" stop-opacity="${vignetteOpacity}" />
    </radialGradient>
    <filter id="${idPrefix}-grain" x="0%" y="0%" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
      <feColorMatrix type="matrix" values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 1 0" />
    </filter>
  `;

  let content = `
    <!-- Sky Base -->
    <rect width="1200" height="800" fill="url(#${idPrefix}-sky)" />
  `;

  // Atmospheric haze gradient at horizon
  defs += `
    <linearGradient id="${idPrefix}-horizon-haze" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${skyHorizon}" stop-opacity="0" />
      <stop offset="65%" stop-color="${skyHorizon}" stop-opacity="0.45" />
      <stop offset="100%" stop-color="${skyHorizon}" stop-opacity="0.85" />
    </linearGradient>
  `;
  content += `
    <!-- Horizon Glow -->
    <rect y="320" width="1200" height="260" fill="url(#${idPrefix}-horizon-haze)" opacity="0.6" />
  `;

  // Soft atmospheric cloud bands (feathered, non-pill shapes)
  const cloudCount = int(3, 4);
  for (let cIdx = 0; cIdx < cloudCount; cIdx++) {
    const cy = range(110 + cIdx * 45, 150 + cIdx * 45);
    const cWidth = range(500, 900);
    const cx = range(200, 700);
    const cOpacity = f(range(0.06, 0.14));
    content += `
      <ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(cWidth)}" ry="${f(range(12, 28))}" fill="${skyHorizon}" opacity="${cOpacity}" />
    `;
  }

  // Celestial Body: Sun or Moon
  if (params.celestialKind === 'sun') {
    content += `
      <!-- Sun Corona / Atmospheric Bloom -->
      <circle cx="${f(celestialX)}" cy="${f(celestialY)}" r="${f(celestialR * 4.2)}" fill="url(#${idPrefix}-celestial-glow)" />
      <!-- Sun Core -->
      <circle cx="${f(celestialX)}" cy="${f(celestialY)}" r="${f(celestialR)}" fill="#ffffff" />
    `;
  } else {
    // Stars
    const starCount = int(45, 65);
    content += `<!-- Stars -->`;
    for (let sIdx = 0; sIdx < starCount; sIdx++) {
      const sx = range(20, 1180);
      const sy = range(15, 380);
      const sr = f(range(0.7, 1.7));
      const sOp = f(range(0.35, 0.85));
      content += `<circle cx="${f(sx)}" cy="${f(sy)}" r="${sr}" fill="#ffffff" opacity="${sOp}" />`;
    }
    const moonR = celestialR * 0.88;
    content += `
      <!-- Moon Glow -->
      <circle cx="${f(celestialX)}" cy="${f(celestialY)}" r="${f(moonR * 3.2)}" fill="url(#${idPrefix}-celestial-glow)" opacity="0.5" />
      <!-- Moon Crescent -->
      <path d="M ${f(celestialX)} ${f(celestialY - moonR)} A ${f(moonR)} ${f(moonR)} 0 0 1 ${f(celestialX)} ${f(celestialY + moonR)} A ${f(moonR * 1.15)} ${f(moonR * 1.15)} 0 0 0 ${f(celestialX)} ${f(celestialY - moonR)} Z" fill="#ffffff" opacity="0.95" />
    `;
  }

  if (variant === 'landscape' || variant === 'dusk') {
    // Photographic mountain massifs with arêtes, facet lighting, and atmospheric mist
    const baseElevations = [420, 500, 580, 660, 740];
    const sunOnRight = celestialX > 600;

    for (let l = 0; l < layerCount; l++) {
      const depth = l / (layerCount - 1); // 0 (far) to 1 (near)
      // Aerial perspective: distant mountains absorb the sky horizon color, near ones have deep rich tones
      const layerL = horizonL - depth * (horizonL - (variant === 'dusk' ? 0.08 : 0.16));
      const layerC = terrainChroma * (0.65 + depth * 0.75);

      const litColor = oklchToHex(layerL * 1.08, layerC * 0.95, terrainHue + (sunOnRight ? 6 : -6));
      const shadowColor = oklchToHex(layerL * 0.72, layerC * 1.15, terrainHue + (sunOnRight ? -8 : 8));
      const baseFogColor = oklchToHex(layerL * 0.88, layerC * 0.7, terrainHue);

      const gradId = `${idPrefix}-mgrad-${l}`;
      defs += `
        <linearGradient id="${gradId}" x1="${sunOnRight ? '75%' : '25%'}" y1="0%" x2="${sunOnRight ? '20%' : '80%'}" y2="100%">
          <stop offset="0%" stop-color="${litColor}" />
          <stop offset="50%" stop-color="${baseFogColor}" />
          <stop offset="100%" stop-color="${shadowColor}" />
        </linearGradient>
      `;

      const elevation = baseElevations[Math.min(l, baseElevations.length - 1)] ?? 500;
      const baseY = elevation + range(-12, 12);

      // Massifs: 2-3 dominant summits per layer
      const peakCount = int(2, 3);
      const peaks: { x: number; h: number; w: number; asymmetry: number }[] = [];
      for (let pk = 0; pk < peakCount; pk++) {
        const peakX = range(180 + pk * (840 / peakCount), 380 + pk * (840 / peakCount));
        const peakH = range(100, 185) * (1 - depth * 0.20);
        const peakW = range(180, 320);
        const asym = range(-0.25, 0.25);
        peaks.push({ x: peakX, h: peakH, w: peakW, asymmetry: asym });
      }

      const sampleCount = 55;
      const points: Point[] = [];
      const roughFreq = range(0.014, 0.026);
      const roughPhase = range(0, Math.PI * 2);
      const roughAmp = range(16, 32) * (1 - depth * 0.25);

      for (let i = 0; i <= sampleCount; i++) {
        const x = (i / sampleCount) * 1200;
        let peakLift = 0;
        for (const pk of peaks) {
          const dx = x - pk.x;
          const halfW = dx < 0 ? pk.w * (1 - pk.asymmetry) : pk.w * (1 + pk.asymmetry);
          if (Math.abs(dx) < halfW) {
            const factor = 1 - Math.pow(Math.abs(dx) / halfW, 1.25);
            peakLift = Math.max(peakLift, pk.h * factor);
          }
        }
        // Multi-frequency harmonic crag roughness
        const harmonic1 = Math.sin(x * roughFreq + roughPhase) * roughAmp;
        const harmonic2 = Math.sin(x * roughFreq * 2.7 + roughPhase * 1.5) * (roughAmp * 0.38);
        const harmonic3 = Math.sin(x * roughFreq * 5.1 + roughPhase * 2.3) * (roughAmp * 0.16);
        const crags = harmonic1 + harmonic2 + harmonic3;

        points.push({ x, y: baseY - peakLift + crags });
      }
      points[0]!.x = 0;
      points[points.length - 1]!.x = 1200;

      const pathData = pointsToSvgPath(points, true, 800);
      content += `
        <!-- Ridge Layer ${l} -->
        <path d="${pathData}" fill="url(#${gradId})" />
      `;

      // Ridge crest highlight rim light catching the sun
      const crestRimPath = pointsToSvgPath(points, false);
      const rimOpacity = f(range(0.35, 0.65) * (1 - depth * 0.3));
      content += `
        <path d="${crestRimPath}" fill="none" stroke="${litColor}" stroke-width="${f(1.4 + (1 - depth) * 1.2)}" opacity="${rimOpacity}" />
      `;

      // Valley mist reservoir between ridge layers (aerial perspective)
      if (l < layerCount - 1) {
        const mistY = baseY + range(18, 45);
        defs += `
          <linearGradient id="${idPrefix}-mist-${l}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${skyHorizon}" stop-opacity="0" />
            <stop offset="50%" stop-color="${skyHorizon}" stop-opacity="${f(range(0.25, 0.45))}" />
            <stop offset="100%" stop-color="${skyHorizon}" stop-opacity="0" />
          </linearGradient>
        `;
        content += `
          <rect y="${f(mistY - 25)}" width="1200" height="65" fill="url(#${idPrefix}-mist-${l})" />
        `;
      }
    }
  } else if (variant === 'dunes') {
    // Sinuous sweeping barchan and star dunes with sharp windward crests and slip-face shading
    const baseElevations = [450, 530, 610, 690, 760];
    const sunOnRight = celestialX > 600;

    for (let l = 0; l < layerCount; l++) {
      const depth = l / (layerCount - 1);
      const duneL = horizonL - depth * (horizonL - 0.26);
      const duneC = terrainChroma * (0.8 + depth * 0.45);

      const litDune = oklchToHex(duneL * 1.08, duneC, terrainHue + 4);
      const midDune = oklchToHex(duneL * 0.92, duneC, terrainHue);
      const shadowDune = oklchToHex(duneL * 0.68, duneC * 1.25, terrainHue - 8);

      const gradId = `${idPrefix}-dgrad-${l}`;
      const sweepDir = (l % 2 === 0) ? sunOnRight : !sunOnRight;
      defs += `
        <linearGradient id="${gradId}" x1="${sweepDir ? '15%' : '85%'}" y1="20%" x2="${sweepDir ? '85%' : '15%'}" y2="90%">
          <stop offset="0%" stop-color="${litDune}" />
          <stop offset="55%" stop-color="${midDune}" />
          <stop offset="100%" stop-color="${shadowDune}" />
        </linearGradient>
      `;

      const baseY = baseElevations[Math.min(l, baseElevations.length - 1)] ?? 500;
      const points: Point[] = [];
      const ptCount = 7;
      const duneFreq = range(0.75, 1.3);
      const phase = range(0, Math.PI * 2);
      const amp = range(45, 90) * (0.8 + depth * 0.35);

      for (let p = 0; p <= ptCount; p++) {
        const t = p / ptCount;
        const x = t * 1200;
        const sinWave = Math.sin(t * Math.PI * duneFreq + phase) * amp;
        const slope = (sweepDir ? 1 : -1) * (t - 0.5) * range(25, 70);
        points.push({ x, y: baseY + sinWave + slope });
      }
      points[0]!.x = 0;
      points[points.length - 1]!.x = 1200;

      const pathData = smoothPointsToSvgPath(points, true, 800);
      content += `
        <!-- Dune Layer ${l} -->
        <path d="${pathData}" fill="url(#${gradId})" />
      `;

      // Dune crest razor highlight line
      const crestStroke = smoothPointsToSvgPath(points, false);
      content += `
        <path d="${crestStroke}" fill="none" stroke="${litDune}" stroke-width="${f(1.8 + depth * 1.2)}" opacity="${f(0.55 + (1 - depth) * 0.25)}" />
      `;

      // Desert heat haze between dunes
      if (l < layerCount - 1) {
        content += `
          <ellipse cx="600" cy="${f(baseY + 25)}" rx="680" ry="${f(range(14, 28))}" fill="${skyHorizon}" opacity="${f(range(0.10, 0.20))}" />
        `;
      }
    }
  } else if (variant === 'tide') {
    // Pacific coastal landscape: Ocean horizon, headland bluff silhouette, water reflection, rolling surf
    const horizonY = 400;
    const waterHorizonColor = oklchToHex(horizonL * 0.72, terrainChroma * 0.8, terrainHue);
    const deepOceanColor = oklchToHex(0.18, terrainChroma * 1.05, terrainHue);
    const headlandBluffColor = oklchToHex(horizonL * 0.38, terrainChroma * 0.6, terrainHue - 15);

    defs += `
      <linearGradient id="${idPrefix}-ocean-water" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${waterHorizonColor}" />
        <stop offset="30%" stop-color="${oklchToHex(0.35, terrainChroma * 0.9, terrainHue)}" />
        <stop offset="100%" stop-color="${deepOceanColor}" />
      </linearGradient>
      <linearGradient id="${idPrefix}-sun-column" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.7" />
        <stop offset="60%" stop-color="#ffffff" stop-opacity="0.25" />
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0.05" />
      </linearGradient>
    `;

    // Sea Surface Base
    content += `
      <!-- Sea Surface -->
      <rect x="0" y="${horizonY}" width="1200" height="${800 - horizonY}" fill="url(#${idPrefix}-ocean-water)" />
    `;

    // Two layered coastal headlands with sea mist for scale and depth
    const headlandOnLeft = celestialX > 600;
    const farHeadlandPoints: Point[] = headlandOnLeft
      ? [
          { x: 0, y: horizonY },
          { x: 0, y: 335 },
          { x: 180, y: 350 },
          { x: 320, y: 375 },
          { x: 480, y: horizonY },
        ]
      : [
          { x: 720, y: horizonY },
          { x: 880, y: 375 },
          { x: 1020, y: 350 },
          { x: 1200, y: 335 },
          { x: 1200, y: horizonY },
        ];
    const nearHeadlandPoints: Point[] = headlandOnLeft
      ? [
          { x: 0, y: horizonY },
          { x: 0, y: 295 },
          { x: 110, y: 315 },
          { x: 220, y: 350 },
          { x: 360, y: horizonY },
        ]
      : [
          { x: 840, y: horizonY },
          { x: 980, y: 350 },
          { x: 1090, y: 315 },
          { x: 1200, y: 295 },
          { x: 1200, y: horizonY },
        ];

    content += `
      <!-- Far Headland Bluff -->
      <path d="${smoothPointsToSvgPath(farHeadlandPoints, true, horizonY)}" fill="${headlandBluffColor}" opacity="0.45" />
      <!-- Near Headland Bluff -->
      <path d="${smoothPointsToSvgPath(nearHeadlandPoints, true, horizonY)}" fill="${headlandBluffColor}" opacity="0.9" />
      <!-- Coastal Sea Spray Haze -->
      <ellipse cx="${headlandOnLeft ? '200' : '1000'}" cy="${f(horizonY - 8)}" rx="260" ry="24" fill="${skyHorizon}" opacity="0.4" />
    `;

    // Sun glitter path: soft horizontal ripples expanding toward the camera
    content += `<!-- Sun Reflection Glitter Path -->`;
    for (let r = 0; r < 22; r++) {
      const ry = horizonY + 8 + r * 14;
      const rw = 16 + r * 7.5;
      const rOp = f(Math.max(0.06, 0.55 - r * 0.02));
      content += `
        <ellipse cx="${f(celestialX)}" cy="${f(ry)}" rx="${f(rw)}" ry="${f(1.6 + r * 0.08)}" fill="#ffffff" opacity="${rOp}" />
      `;
    }

    // Rolling swell waves with deep trough shading and soft crest highlights
    const waveElevations = [460, 535, 615, 695];
    for (let w = 0; w < waveElevations.length; w++) {
      const depth = w / (waveElevations.length - 1);
      const wY = waveElevations[w] ?? 600;
      const swellPoints: Point[] = [];
      const ptCount = 9;
      const wPhase = range(0, Math.PI * 2);
      const wAmp = range(10, 20) * (0.8 + depth * 0.6);

      for (let p = 0; p <= ptCount; p++) {
        const x = (p / ptCount) * 1200;
        const waveY = wY + Math.sin((p / ptCount) * Math.PI * 3.5 + wPhase) * wAmp;
        swellPoints.push({ x, y: waveY });
      }
      swellPoints[0]!.x = 0;
      swellPoints[swellPoints.length - 1]!.x = 1200;

      const swellFillPath = smoothPointsToSvgPath(swellPoints, true, 800);
      const swellShade = oklchToHex(0.24 + (1 - depth) * 0.14, terrainChroma * (0.8 + depth * 0.3), terrainHue);

      content += `
        <!-- Swell Body ${w} -->
        <path d="${swellFillPath}" fill="${swellShade}" opacity="${f(0.50 + depth * 0.38)}" />
      `;

      // Only foreground swells have visible breaking crest foam lines
      if (w >= waveElevations.length - 2) {
        const swellPath = smoothPointsToSvgPath(swellPoints, false);
        const foamWidth = w === waveElevations.length - 1 ? 2.4 : 1.4;
        const foamOpacity = w === waveElevations.length - 1 ? 0.6 : 0.35;
        content += `
          <!-- Breaking Crest Foam ${w} -->
          <path d="${swellPath}" fill="none" stroke="#ffffff" stroke-width="${foamWidth}" opacity="${foamOpacity}" />
        `;
      }
    }

    // Wet reflective tidal shore wash
    const shorePoints: Point[] = [
      { x: 0, y: 745 },
      { x: 300, y: 735 },
      { x: 650, y: 755 },
      { x: 950, y: 742 },
      { x: 1200, y: 750 },
    ];
    const shoreSandColor = oklchToHex(0.26, terrainChroma * 0.5, terrainHue + 20);
    content += `
      <!-- Wet Sand Shore -->
      <path d="${smoothPointsToSvgPath(shorePoints, true, 800)}" fill="${shoreSandColor}" />
      <!-- Foam Wash Line -->
      <path d="${smoothPointsToSvgPath(shorePoints, false)}" fill="none" stroke="#ffffff" stroke-width="2.6" opacity="0.65" />
    `;
  }

  // Atmospheric Vignette overlay (lens falloff)
  content += `
    <!-- Vignette -->
    <rect width="1200" height="800" fill="url(#${idPrefix}-vignette)" style="mix-blend-mode: multiply;" />
  `;

  // Fine Photographic Grain overlay (emulsion texture)
  content += `
    <!-- Film Grain -->
    <rect width="1200" height="800" filter="url(#${idPrefix}-grain)" opacity="${grainOpacity}" style="mix-blend-mode: overlay;" />
  `;

  return { defs, content };
}

/**
 * Returns complete SVG markup string for a seeded procedural scene.
 */
export function generateSceneSvg(seed: string, variant: SceneVariant = 'landscape'): string {
  const { defs, content } = generateSceneParts(seed, variant);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" width="100%" height="100%"><defs>${defs}</defs>${content}</svg>`;
}
