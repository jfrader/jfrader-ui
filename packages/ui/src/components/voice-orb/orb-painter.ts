const FILAMENT_COUNT = 18;
const CLOUD_STATES = ['listening', 'thinking', 'speaking'] as const;
export type OrbCloudWeights = Partial<Record<(typeof CLOUD_STATES)[number], number>>;

export interface OrbPalette {
  accent: string;
  highlight: string;
  shadow: string;
  light: string;
  listening: string;
  thinking: string;
  speaking: string;
}

export function paintOrb(
  drawing: CanvasRenderingContext2D,
  pixels: number,
  phase: number,
  activity: number,
  amplitude: number,
  palette: OrbPalette,
  expression: number,
  clouds: OrbCloudWeights = {},
) {
  const center = pixels / 2;
  const radius = pixels * (0.32 + amplitude * 0.035);
  const { accent, highlight, shadow, light } = palette;
  const glow = (x: number, y: number, radius: number, color: string, opacity: number) => {
    const gradient = drawing.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'transparent');
    drawing.globalAlpha = opacity;
    drawing.fillStyle = gradient;
    drawing.fillRect(0, 0, pixels, pixels);
  };

  drawing.clearRect(0, 0, pixels, pixels);
  drawing.save();
  const swell = Math.sin(phase * 2) * expression * (0.065 + amplitude * 0.055);
  drawing.translate(center, center);
  drawing.rotate(Math.sin(phase * 0.7) * expression * 0.18);
  drawing.scale(1 + swell, 1 - swell * 0.7);
  drawing.translate(-center, -center);
  glow(center, center + radius * 0.12, radius * 1.44, accent, 0.16 + activity * 0.1);
  drawing.save();
  drawing.globalAlpha = 1;
  drawing.beginPath();
  drawing.arc(center, center, radius, 0, Math.PI * 2);
  drawing.clip();

  const body = drawing.createRadialGradient(
    center - radius * 0.38,
    center - radius * 0.42,
    radius * 0.04,
    center + radius * 0.16,
    center + radius * 0.23,
    radius * 1.26,
  );
  body.addColorStop(0, highlight);
  body.addColorStop(0.36, accent);
  body.addColorStop(0.78, shadow);
  body.addColorStop(1, shadow);
  drawing.fillStyle = body;
  drawing.fillRect(0, 0, pixels, pixels);

  const drift = phase * 0.7;
  glow(
    center + Math.cos(drift) * radius * (0.36 + expression * 0.2),
    center + Math.sin(drift * 1.17) * radius * (0.34 + expression * 0.18),
    radius * 0.95,
    accent,
    0.85,
  );
  glow(
    center + Math.sin(drift * 1.3) * radius * 0.5,
    center + Math.cos(drift * 1.3) * radius * 0.48,
    radius * (0.8 - expression * 0.12),
    highlight,
    0.65 + expression * 0.3,
  );

  const breath = (Math.sin(phase * 1.8) + 1) / 2;
  const cloudShapes = {
    listening: {
      orbit: 0.34 - amplitude * 0.1,
      spread: 0.64 + breath * 0.08,
      brightness: 0.44 + amplitude * 0.18,
    },
    thinking: {
      orbit: 0.22 - breath * 0.12,
      spread: 0.5 - breath * 0.08,
      brightness: 0.54 + breath * 0.12,
    },
    speaking: {
      orbit: 0.22 + breath * 0.26,
      spread: 0.56 + breath * 0.18,
      brightness: 0.48 + amplitude * 0.16,
    },
  };
  for (const state of CLOUD_STATES) {
    const weight = Math.max(0, Math.min(1, clouds[state] ?? 0));
    if (!weight) continue;
    const { orbit, spread, brightness } = cloudShapes[state];
    for (let cloud = 0; cloud < 2; cloud++) {
      const angle = drift + cloud * Math.PI + 0.8;
      glow(
        center + Math.cos(angle) * radius * orbit,
        center + Math.sin(angle * 1.13) * radius * orbit * 0.8,
        radius * spread,
        palette[state],
        weight * brightness * (cloud ? 0.72 : 1),
      );
    }
  }

  drawing.save();
  drawing.translate(center, center);
  drawing.rotate(-0.45 + Math.sin(phase * 0.12) * 0.3 + Math.sin(phase * 0.7) * expression * 0.9);
  const flow = drawing.createLinearGradient(-radius, -radius, radius * 0.65, radius);
  flow.addColorStop(0, 'transparent');
  flow.addColorStop(0.24, highlight);
  flow.addColorStop(0.52, light);
  flow.addColorStop(0.76, accent);
  flow.addColorStop(1, 'transparent');
  drawing.strokeStyle = flow;
  drawing.lineCap = 'round';
  for (let strand = 0; strand < FILAMENT_COUNT; strand++) {
    const position = strand / (FILAMENT_COUNT - 1);
    const offset = Math.sin((position - 0.5) * 2.1) * 0.68;
    const wave = Math.sin(phase * 0.6 + strand * 0.3);
    const bend = (0.25 + activity * 0.2 + amplitude * 0.22 + expression * 0.2) * wave;
    drawing.globalAlpha = (0.06 + Math.sin(position * Math.PI) * 0.18) * (0.65 + activity * 0.35);
    drawing.lineWidth = radius * (0.006 + Math.sin(position * Math.PI) * (0.009 + expression * 0.009));
    drawing.beginPath();
    drawing.moveTo(-radius * 1.08, radius * (offset + 0.18));
    drawing.bezierCurveTo(
      -radius * 0.3,
      radius * (offset - 0.7 + bend),
      radius * 0.24,
      radius * (offset + 0.75 - bend),
      radius * 1.08,
      radius * (offset - 0.25),
    );
    drawing.stroke();
  }
  drawing.restore();

  glow(center - radius * 0.38, center - radius * 0.48, radius * 0.58, light, 0.28);
  const shade = drawing.createRadialGradient(
    center - radius * 0.24,
    center - radius * 0.3,
    radius * 0.35,
    center,
    center,
    radius,
  );
  shade.addColorStop(0, 'transparent');
  shade.addColorStop(0.72, 'transparent');
  shade.addColorStop(1, shadow);
  drawing.globalAlpha = 0.7;
  drawing.fillStyle = shade;
  drawing.fillRect(0, 0, pixels, pixels);
  drawing.restore();

  const rim = drawing.createLinearGradient(
    center - radius, center - radius, center + radius, center + radius,
  );
  rim.addColorStop(0, light);
  rim.addColorStop(0.34, highlight);
  rim.addColorStop(0.65, 'transparent');
  rim.addColorStop(1, accent);
  drawing.globalAlpha = 0.48;
  drawing.strokeStyle = rim;
  drawing.lineWidth = pixels / 300;
  drawing.beginPath();
  drawing.arc(center, center, radius, 0, Math.PI * 2);
  drawing.stroke();
  drawing.restore();
  drawing.globalAlpha = 1;
}
