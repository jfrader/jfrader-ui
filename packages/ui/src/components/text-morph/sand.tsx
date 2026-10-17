'use client';

import { useEffect, useRef, useState } from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { css } from '../../styling/css';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import type { TextMorphSlotProps, TextMorphSlots } from './text-morph';

export type SandFallbackReason = 'canvas' | 'font' | 'overflow' | 'budget';
export interface SandOptions {
  /** Disturb grains with the pointer without changing the readable text. */
  interactive?: boolean;
  intro?: boolean;
  /** Grain spacing in CSS pixels; clamped to 1–12. */
  grainSize?: number;
  /** Pointer brush radius in CSS pixels; clamped to 0–100. */
  interactionRadius?: number;
  /** Maximum sampled grains, clamped to 1–50,000. */
  maxCells?: number;
  /** Maximum backing-store ratio, clamped to 1–2. */
  maxPixelRatio?: number;
  onRenderFallback?: (reason: SandFallbackReason) => void;
}
const LIMITS = {
  grainSize: 2,
  minGrain: 1,
  maxGrain: 12,
  radius: 14,
  maxRadius: 100,
  cells: 50000,
  dpr: 2,
  width: 4096,
  height: 512,
  pixels: 1048576,
  settleMs: 900,
  driftEm: 0.65,
  grainFill: 0.65,
  disturbanceGain: 2,
} as const;
const canvasStyle = css({
  position: 'absolute',
  insetInlineStart: 0,
  insetBlockStart: 0,
  pointerEvents: 'none',
  userSelect: 'none',
  inlineSize: '100%',
  blockSize: '100%',
  [REDUCED_MOTION]: { display: 'none' },
  [FORCED_COLORS]: { display: 'none' },
});
function finite(value: number | undefined, fallback: number, min: number, max: number) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value!)) : fallback;
}
interface Grain {
  x: number;
  y: number;
  dx: number;
  dy: number;
}

export function Sand({
  text,
  interactive = true,
  intro = true,
  grainSize,
  interactionRadius,
  maxCells,
  maxPixelRatio,
  onRenderFallback,
  slots,
  slotProps,
}: SandOptions & {
  text: string;
  slots?: TextMorphSlots;
  slotProps?: TextMorphSlotProps;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const ref = useMergeRefs([canvas, slotProps?.canvas?.ref]);
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const owner = canvas.current?.ownerDocument.defaultView ?? window;
    const reduced = owner.matchMedia('(prefers-reduced-motion: reduce)');
    const forced = owner.matchMedia('(forced-colors: active)');
    const update = () => setEnabled(!reduced.matches && !forced.matches);
    update();
    reduced.addEventListener('change', update);
    forced.addEventListener('change', update);
    return () => {
      reduced.removeEventListener('change', update);
      forced.removeEventListener('change', update);
    };
  }, []);
  useEffect(() => {
    const element = canvas.current;
    const root = element?.parentElement;
    const label = root?.querySelector<HTMLElement>('[data-ui="text-morph-text"]');
    const owner = element?.ownerDocument.defaultView;
    if (!enabled || !element || !root || !label || !owner || !text) return;
    const document = element.ownerDocument;
    const reported = new Set<SandFallbackReason>();
    const report = (reason: SandFallbackReason) => {
      if (reported.has(reason)) return;
      reported.add(reason);
      onRenderFallback?.(reason);
    };
    let context: CanvasRenderingContext2D | null;
    try {
      context = element.getContext('2d');
    } catch {
      context = null;
    }
    if (!context) {
      report('canvas');
      return;
    }
    const ctx = context;
    const mask = document.createElement('canvas');
    const maskContext = mask.getContext('2d', { willReadFrequently: true });
    if (!maskContext) {
      report('canvas');
      return;
    }
    const radius = finite(interactionRadius, LIMITS.radius, 0, LIMITS.maxRadius);
    const budget = Math.floor(finite(maxCells, LIMITS.cells, 1, LIMITS.cells));
    let grains: Grain[] = [];
    let frame = 0;
    let started = 0;
    let disposed = false;
    let visible = true;
    let hasIntroduced = false;
    let width = 0;
    let height = 0;
    let step = LIMITS.grainSize as number;
    let fontSize = 0;
    const stop = () => {
      owner.cancelAnimationFrame(frame);
      frame = 0;
    };
    const clear = () => ctx.clearRect(0, 0, width, height);
    const draw = (progress: number) => {
      clear();
      const remaining = (1 - progress) ** 3;
      ctx.globalAlpha = remaining;
      for (const grain of grains) {
        ctx.fillRect(
          grain.x + grain.dx * remaining,
          grain.y + grain.dy * remaining,
          step * LIMITS.grainFill,
          step * LIMITS.grainFill,
        );
      }
      ctx.globalAlpha = 1;
    };
    const tick = (time: number) => {
      frame = 0;
      if (disposed || !visible || document.hidden) {
        clear();
        return;
      }
      const progress = Math.min(1, Math.max(0, (time - started) / LIMITS.settleMs));
      draw(progress);
      if (progress < 1) frame = owner.requestAnimationFrame(tick);
      else clear();
    };
    const start = () => {
      stop();
      if (!visible || document.hidden || disposed) return;
      started = owner.performance.now();
      frame = owner.requestAnimationFrame(tick);
    };
    const measure = () => {
      stop();
      clear();
      grains = [];
      const rect = label.getBoundingClientRect();
      const style = owner.getComputedStyle(label);
      width = Math.ceil(rect.width);
      height = Math.ceil(rect.height);
      fontSize = Number.parseFloat(style.fontSize);
      if (!width || !height) return;
      if (width > LIMITS.width || height > LIMITS.height || width * height > LIMITS.pixels) {
        report('budget');
        return;
      }
      if (width > owner.innerWidth || label.getClientRects().length > 1 || /[\n\r]/u.test(text)) {
        report('overflow');
        return;
      }
      const ratio = Math.min(
        owner.devicePixelRatio || 1,
        finite(maxPixelRatio, LIMITS.dpr, 1, LIMITS.dpr),
        Math.sqrt(LIMITS.pixels / (width * height)),
      );
      element.width = Math.max(1, Math.floor(width * ratio));
      element.height = Math.max(1, Math.floor(height * ratio));
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.fillStyle = style.color;
      mask.width = width;
      mask.height = height;
      maskContext.font = style.font || `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      maskContext.direction = style.direction === 'rtl' ? 'rtl' : 'ltr';
      maskContext.textAlign = style.direction === 'rtl' ? 'right' : 'left';
      maskContext.letterSpacing = style.letterSpacing;
      maskContext.fillStyle = style.color;
      const metrics = maskContext.measureText(text);
      const ascent = metrics.actualBoundingBoxAscent;
      const descent = metrics.actualBoundingBoxDescent;
      maskContext.fillText(
        text,
        style.direction === 'rtl' ? width : 0,
        (height - ascent - descent) / 2 + ascent,
      );
      let pixels: Uint8ClampedArray;
      try {
        pixels = maskContext.getImageData(0, 0, width, height).data;
      } catch {
        report('canvas');
        return;
      }
      step = Math.max(
        finite(grainSize, LIMITS.grainSize, LIMITS.minGrain, LIMITS.maxGrain),
        Math.sqrt((width * height) / budget),
      );
      for (let y = step / 2; y < height; y += step) {
        for (let x = step / 2; x < width; x += step) {
          if (
            pixels[(Math.floor(y) * width + Math.floor(x)) * 4 + 3]! > 0 &&
            grains.length < budget
          ) {
            grains.push({ x, y, dx: Math.sin(x + y) * fontSize * LIMITS.driftEm, dy: -height });
          }
        }
      }
      if (intro && !hasIntroduced) {
        hasIntroduced = true;
        start();
      }
    };
    const pointer = (event: PointerEvent) => {
      if (!interactive || event.pointerType === 'touch' || !visible || document.hidden) return;
      const rect = element.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      let disturbed = false;
      for (const grain of grains) {
        const distance = Math.hypot(grain.x - x, grain.y - y);
        if (distance >= radius) {
          grain.dx = 0;
          grain.dy = 0;
          continue;
        }
        grain.dx = (grain.x - x) * LIMITS.disturbanceGain;
        grain.dy = (grain.y - y) * LIMITS.disturbanceGain + fontSize * LIMITS.driftEm;
        disturbed = true;
      }
      if (disturbed) start();
    };
    const visibility = () => {
      stop();
      clear();
    };
    const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    resize?.observe(label);
    const intersection =
      typeof IntersectionObserver === 'function'
        ? new IntersectionObserver(([entry]) => {
            visible = entry?.isIntersecting ?? false;
            if (!visible) {
              stop();
              clear();
            }
          })
        : null;
    intersection?.observe(root);
    const mutation = new MutationObserver(measure);
    for (let parent: HTMLElement | null = root; parent; parent = parent.parentElement) {
      mutation.observe(parent, {
        attributes: true,
        attributeFilter: ['class', 'style', 'data-theme', 'data-appearance', 'dir'],
      });
    }
    root.addEventListener('pointermove', pointer, { passive: true });
    root.addEventListener('pointercancel', visibility);
    document.addEventListener('visibilitychange', visibility);
    document.fonts?.addEventListener('loadingdone', measure);
    measure();
    document.fonts?.ready.then(
      () => {
        if (!disposed) measure();
      },
      () => {
        if (!disposed) report('font');
      },
    );
    return () => {
      disposed = true;
      stop();
      clear();
      resize?.disconnect();
      intersection?.disconnect();
      mutation.disconnect();
      root.removeEventListener('pointermove', pointer);
      root.removeEventListener('pointercancel', visibility);
      document.removeEventListener('visibilitychange', visibility);
      document.fonts?.removeEventListener('loadingdone', measure);
    };
  }, [
    enabled,
    text,
    interactive,
    intro,
    grainSize,
    interactionRadius,
    maxCells,
    maxPixelRatio,
    onRenderFallback,
    slots?.canvas,
  ]);
  const Canvas = slots?.canvas ?? 'canvas';
  return enabled ? (
    <Canvas
      {...slotProps?.canvas}
      ref={ref}
      css={[canvasStyle, slotProps?.canvas?.css]}
      aria-hidden="true"
      tabIndex={-1}
      data-ui="text-morph-canvas"
    />
  ) : null;
}
