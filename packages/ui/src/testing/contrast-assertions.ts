import { expect } from 'storybook/test';

type Pixel = readonly [number, number, number, number];

function readColor(document: Document, color: string): Pixel {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas color conversion is unavailable.');
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  const [r = 0, g = 0, b = 0, alpha = 0] = context.getImageData(0, 0, 1, 1).data;
  return [r, g, b, alpha / 255];
}

function composite(color: Pixel, background: Pixel): Pixel {
  const [r, g, b, alpha] = color;
  return [
    r * alpha + background[0] * (1 - alpha),
    g * alpha + background[1] * (1 - alpha),
    b * alpha + background[2] * (1 - alpha),
    1,
  ];
}

function luminance(color: Pixel): number {
  const linear = color.slice(0, 3).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722;
}

/** Check text and the inner control boundary over black and white backdrops. */
export async function expectTranslucentContrast(element: HTMLElement) {
  const style = getComputedStyle(element);
  const read = (color: string) => readColor(element.ownerDocument, color);
  const background = read(style.backgroundColor);
  const border = read(style.borderTopColor);
  const text = read(style.color);
  for (const backdrop of [0, 255]) {
    const fill = composite(background, [backdrop, backdrop, backdrop, 1]);
    for (const [name, foreground, minimum] of [['border', border, 3], ['text', text, 4.5]] as const) {
      const a = luminance(composite(foreground, fill));
      const b = luminance(fill);
      const contrast = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      await expect(contrast, `${name} contrast over backdrop ${backdrop}`).toBeGreaterThanOrEqual(minimum);
    }
  }
}
