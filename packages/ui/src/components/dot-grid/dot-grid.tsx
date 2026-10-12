'use client';

import { useEffect, useId, useRef, useState, type ComponentPropsWithRef } from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { WithSx, type SxProps } from '../../styling/sx';
import { useControlledState } from '../../utils/use-controlled-state';
import { Button, type ButtonProps } from '../button';

type Slot<T> = T & { css?: Interpolation<Theme> };

export interface DotGridSlotProps {
  scene?: Slot<Omit<ComponentPropsWithRef<'canvas'>, 'children' | 'role' | 'aria-hidden' | 'aria-label' | 'tabIndex' | 'width' | 'height'>>;
  content?: Slot<Omit<ComponentPropsWithRef<'div'>, 'children'>>;
  controls?: Slot<Omit<ComponentPropsWithRef<'div'>, 'children'>>;
  pauseButton?: Omit<ButtonProps, 'sx' | 'children' | 'render' | 'disabled' | 'loading'>;
}

interface DotGridBaseProps extends ComponentPropsWithRef<'div'>, SxProps {
  /** Names the decoration only, never the foreground content. */
  label?: string;
  gap?: number;
  dotSize?: number;
  radius?: number;
  strength?: number;
  ripple?: boolean;
  fade?: boolean;
  paused?: boolean;
  defaultPaused?: boolean;
  onPausedChange?: (paused: boolean) => void;
  /** Density degrades automatically to stay within this 1…2000 dot budget. */
  maxDots?: number;
  slotProps?: DotGridSlotProps;
}

export type DotGridProps = DotGridBaseProps & (
  | { interactive?: true; controlLabels: { pause: string; resume: string } }
  | { interactive: false; controlLabels?: { pause: string; resume: string } }
);

const DEFAULTS = { gap: 22, dotSize: 1.4, radius: 150, strength: 16, maxDots: 2000 } as const;
declare const process: { env: { NODE_ENV?: string } };
const SCENE = {
  maxDpr: 2, maxDelta: 32, maxRipples: 6, rippleSpeed: 620, rippleLifetime: 1500,
  spring: 160, damping: 22, settleThreshold: 0.02, rippleWidth: 40,
  frameBudget: 4, slowFrameLimit: 3, densityBackoff: 0.75,
} as const;
const INTERACTIVE_ROLES = [
  'button', 'link', 'checkbox', 'combobox', 'gridcell', 'listbox', 'menuitem', 'menuitemcheckbox',
  'menuitemradio', 'option', 'radio', 'scrollbar', 'searchbox', 'slider', 'spinbutton', 'switch',
  'tab', 'textbox', 'treeitem',
];
const INTERACTIVE_TARGET = [
  'button', 'a[href]', 'input', 'select', 'textarea', 'summary', 'label', 'audio[controls]',
  'video[controls]', '[tabindex]', '[contenteditable]:not([contenteditable="false"])',
  ...INTERACTIVE_ROLES.map((role) => `[role="${role}"]`),
].join(',');

const rootStyle = css({
  label: 'dot-grid', position: 'relative', isolation: 'isolate', backgroundColor: vars.color.bgSoft,
  color: vars.color.text, fontFamily: vars.font.sans, fontSize: vars.textSize.md,
  lineHeight: vars.lineHeight.base, borderRadius: vars.radius.lg, touchAction: 'pan-y',
});
const sceneStyle = css({
  label: 'dot-grid-scene', position: 'absolute', inset: 0, inlineSize: '100%', blockSize: '100%',
  pointerEvents: 'none', borderRadius: 'inherit',
  '--dot-grid-color': vars.color.borderStrong, '--dot-grid-active-color': vars.color.accent,
  '&[data-fade="true"]': { maskImage: 'radial-gradient(ellipse at center, black 35%, transparent 75%)' },
});
const contentStyle = css({ position: 'relative', paddingBlock: vars.space[4], paddingInline: vars.space[5] });
const controlsStyle = css({
  position: 'relative', display: 'flex', justifyContent: 'flex-end', paddingBlock: vars.space[4],
  paddingInline: vars.space[5],
});

function validParameter(name: keyof typeof DEFAULTS, value: number | undefined) {
  if (value === undefined) return DEFAULTS[name];
  const valid = Number.isFinite(value) && (name === 'strength' ? value >= 0 : value > 0)
    && (name !== 'maxDots' || (Number.isInteger(value) && value <= DEFAULTS.maxDots));
  if (valid) return value;
  if (process.env.NODE_ENV !== 'production') console.warn(`DotGrid: invalid ${name}; using ${DEFAULTS[name]}.`);
  return DEFAULTS[name];
}

interface SceneOptions {
  gap: number; dotSize: number; radius: number; strength: number; maxDots: number;
  interactive: boolean; ripple: boolean;
}

function createScene(canvas: HTMLCanvasElement, options: SceneOptions, onMotionEnabled: (enabled: boolean) => void) {
  const root = canvas.parentElement!;
  const doc = canvas.ownerDocument;
  const view = doc.defaultView!;
  let context: CanvasRenderingContext2D | null = null;
  try { context = canvas.getContext('2d'); } catch { /* Foreground survives unavailable canvas implementations. */ }
  const reduce = view.matchMedia('(prefers-reduced-motion: reduce)');
  const forced = view.matchMedia('(forced-colors: active)');
  let width = 0;
  let height = 0;
  let dots = new Float32Array(0);
  let baseColor = '';
  let activeColor = '';
  let frame = 0;
  let timestamp = 0;
  let clock = 0;
  let paused = false;
  let visible = true;
  let disposed = false;
  let sceneBudget = options.maxDots;
  let builtBudget = 0;
  let measuredDpr = 0;
  let slowFrames = 0;
  let pointer: { x: number; y: number } | undefined;
  const ripples: { x: number; y: number; started: number }[] = [];

  const canRun = () => !disposed && context !== null && options.interactive && !paused
    && !reduce.matches && !forced.matches && !doc.hidden && visible && width > 0 && height > 0;
  const stop = () => {
    if (frame) view.cancelAnimationFrame(frame);
    frame = 0;
    timestamp = 0;
  };
  const reset = () => {
    pointer = undefined;
    ripples.length = 0;
    for (let i = 0; i < dots.length; i += 6) dots.fill(0, i + 2, i + 6);
  };
  const draw = () => {
    if (!context || width <= 0 || height <= 0) return;
    context.clearRect(0, 0, width, height);
    if (forced.matches) return;
    for (let batch = 0; batch < 2; batch++) {
      const active = batch === 1;
      context.beginPath();
      for (let i = 0; i < dots.length; i += 6) {
        const displaced = Math.abs(dots[i + 2]!) + Math.abs(dots[i + 3]!) > SCENE.settleThreshold;
        if (displaced !== active) continue;
        const x = dots[i]! + dots[i + 2]!;
        const y = dots[i + 1]! + dots[i + 3]!;
        context.moveTo(x + options.dotSize, y);
        context.arc(x, y, options.dotSize, 0, Math.PI * 2);
      }
      context.fillStyle = active ? activeColor : baseColor;
      context.fill();
    }
  };
  const schedule = () => {
    if (canRun() && !frame) frame = view.requestAnimationFrame(update);
  };
  function update(now: number) {
    frame = 0;
    if (!canRun()) { timestamp = 0; return; }
    const started = view.performance.now();
    const elapsed = timestamp ? Math.min(Math.max(now - timestamp, 0), SCENE.maxDelta) : 16;
    timestamp = now;
    clock += elapsed;
    const dt = elapsed / 1000;
    const strength = Math.min(options.strength, Math.max(width, height));
    while (ripples.length && clock - ripples[0]!.started >= SCENE.rippleLifetime) ripples.shift();
    let unsettled = ripples.length > 0;
    for (let i = 0; i < dots.length; i += 6) {
      let targetX = 0;
      let targetY = 0;
      if (pointer) {
        const dx = dots[i]! - pointer.x;
        const dy = dots[i + 1]! - pointer.y;
        const distance = Math.hypot(dx, dy);
        if (distance < options.radius && distance > 0) {
          const force = strength * (1 - distance / options.radius) ** 2;
          targetX = dx / distance * force;
          targetY = dy / distance * force;
        }
      }
      for (const wave of ripples) {
        const dx = dots[i]! - wave.x;
        const dy = dots[i + 1]! - wave.y;
        const distance = Math.hypot(dx, dy);
        const age = clock - wave.started;
        const edge = Math.abs(distance - age / 1000 * SCENE.rippleSpeed);
        if (distance > 0 && edge < SCENE.rippleWidth) {
          const force = strength * (1 - edge / SCENE.rippleWidth) * (1 - age / SCENE.rippleLifetime);
          targetX += dx / distance * force;
          targetY += dy / distance * force;
        }
      }
      const magnitude = Math.hypot(targetX, targetY);
      if (magnitude > strength) {
        targetX *= strength / magnitude;
        targetY *= strength / magnitude;
      }
      for (let axis = 0; axis < 2; axis++) {
        const target = axis === 0 ? targetX : targetY;
        const offset = i + 2 + axis;
        const velocity = i + 4 + axis;
        dots[velocity] = dots[velocity]! + ((target - dots[offset]!) * SCENE.spring - dots[velocity]! * SCENE.damping) * dt;
        dots[offset] = Math.max(-strength, Math.min(strength, dots[offset]! + dots[velocity]! * dt));
        if (Math.abs(target - dots[offset]!) + Math.abs(dots[velocity]!) > SCENE.settleThreshold) unsettled = true;
        else { dots[offset] = target; dots[velocity] = 0; }
      }
      const displacement = Math.hypot(dots[i + 2]!, dots[i + 3]!);
      if (displacement > strength) {
        dots[i + 2] = dots[i + 2]! * strength / displacement;
        dots[i + 3] = dots[i + 3]! * strength / displacement;
      }
    }
    draw();
    slowFrames = view.performance.now() - started > SCENE.frameBudget ? slowFrames + 1 : 0;
    if (slowFrames >= SCENE.slowFrameLimit && dots.length > 6) {
      sceneBudget = Math.max(1, Math.floor(dots.length / 6 * SCENE.densityBackoff));
      const currentPointer = pointer;
      resize();
      pointer = currentPointer;
      slowFrames = 0;
    }
    if (unsettled) schedule();
    else timestamp = 0;
  }
  const refreshColors = () => {
    const computed = view.getComputedStyle(canvas);
    baseColor = computed.getPropertyValue('--dot-grid-color').trim();
    activeColor = computed.getPropertyValue('--dot-grid-active-color').trim();
    draw();
  };
  const resize = () => {
    const nextWidth = root.clientWidth;
    const nextHeight = root.clientHeight;
    const dpr = Math.min(view.devicePixelRatio || 1, SCENE.maxDpr);
    if (nextWidth === width && nextHeight === height && dpr === measuredDpr && builtBudget === sceneBudget) return;
    stop();
    width = nextWidth;
    height = nextHeight;
    measuredDpr = dpr;
    builtBudget = sceneBudget;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    context?.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (width === 0 || height === 0) { dots = new Float32Array(0); reset(); return; }
    let spacing = Math.max(options.gap, Math.sqrt(width * height / sceneBudget));
    let columns = Math.floor(width / spacing);
    let rows = Math.floor(height / spacing);
    while (columns * rows > sceneBudget) {
      spacing *= 1.05;
      columns = Math.floor(width / spacing);
      rows = Math.floor(height / spacing);
    }
    dots = new Float32Array(columns * rows * 6);
    for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
      const i = (y * columns + x) * 6;
      dots[i] = (width - (columns - 1) * spacing) / 2 + x * spacing;
      dots[i + 1] = (height - (rows - 1) * spacing) / 2 + y * spacing;
    }
    reset();
    draw();
  };
  const environmentChanged = () => {
    stop();
    onMotionEnabled(!reduce.matches && !forced.matches);
    if (reduce.matches || forced.matches) { reset(); draw(); }
    else if (pointer || ripples.length || dots.some((value, index) => index % 6 >= 2 && value !== 0)) schedule();
  };
  const position = (event: PointerEvent | MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * width / rect.width, y: (event.clientY - rect.top) * height / rect.height };
  };
  const move = (event: PointerEvent) => {
    if (!canRun()) return;
    pointer = position(event);
    schedule();
  };
  const leave = () => { pointer = undefined; schedule(); };
  const click = (event: MouseEvent) => {
    if (!canRun() || !options.ripple || !(event.target instanceof view.Element)
      || event.target.closest(INTERACTIVE_TARGET) || event.detail === 0) return;
    if (ripples.length === SCENE.maxRipples) ripples.shift();
    ripples.push({ ...position(event), started: clock });
    schedule();
  };
  const observer = new view.ResizeObserver(resize);
  observer.observe(root);
  const intersection = new view.IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? false;
    environmentChanged();
  });
  intersection.observe(root);
  const themes = new view.MutationObserver(refreshColors);
  for (let node: HTMLElement | null = canvas; node; node = node.parentElement) {
    themes.observe(node, { attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'data-appearance'] });
  }
  root.addEventListener('pointermove', move);
  root.addEventListener('pointerleave', leave);
  root.addEventListener('pointercancel', leave);
  root.addEventListener('click', click);
  doc.addEventListener('visibilitychange', environmentChanged);
  reduce.addEventListener('change', environmentChanged);
  forced.addEventListener('change', environmentChanged);
  refreshColors();
  resize();
  environmentChanged();
  return {
    setPaused(next: boolean) { paused = next; stop(); if (!paused) schedule(); },
    dispose() {
      disposed = true;
      stop();
      observer.disconnect(); intersection.disconnect(); themes.disconnect();
      root.removeEventListener('pointermove', move);
      root.removeEventListener('pointerleave', leave);
      root.removeEventListener('pointercancel', leave);
      root.removeEventListener('click', click);
      doc.removeEventListener('visibilitychange', environmentChanged);
      reduce.removeEventListener('change', environmentChanged);
      forced.removeEventListener('change', environmentChanged);
    },
  };
}

/** Decorative canvas with native Button keyboard behavior. Children size the surface; empty fields need a blockSize. */
export function DotGrid({
  ref, children, label, interactive = true, gap: gapProp, dotSize: dotSizeProp, radius: radiusProp,
  strength: strengthProp, maxDots: maxDotsProp, ripple = true, fade = true, paused: pausedProp,
  defaultPaused = false, onPausedChange, controlLabels, slotProps, className, sx, ...rest
}: DotGridProps) {
  const gap = validParameter('gap', gapProp);
  const dotSize = validParameter('dotSize', dotSizeProp);
  const radius = validParameter('radius', radiusProp);
  const strength = validParameter('strength', strengthProp);
  const maxDots = validParameter('maxDots', maxDotsProp);
  const [paused, requestPaused] = useControlledState(pausedProp, defaultPaused, onPausedChange);
  const [motionEnabled, setMotionEnabled] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scene = useRef<ReturnType<typeof createScene> | null>(null);
  const mergedSceneRef = useMergeRefs([canvasRef, slotProps?.scene?.ref]);
  const id = useId();
  const sceneId = slotProps?.scene?.id ?? id;
  const name = label?.trim();
  useEffect(() => {
    if (!canvasRef.current) return;
    scene.current = createScene(canvasRef.current, { gap, dotSize, radius, strength, maxDots, interactive, ripple }, setMotionEnabled);
    return () => { scene.current?.dispose(); scene.current = null; };
  }, [gap, dotSize, radius, strength, maxDots, interactive, ripple]);
  useEffect(() => { scene.current?.setPaused(paused ?? false); }, [paused, gap, dotSize, radius, strength, maxDots, interactive, ripple]);
  const { css: sceneCss, ref: _sceneRef, ...sceneProps } = slotProps?.scene ?? {};
  const { css: contentCss, ...contentProps } = slotProps?.content ?? {};
  const { css: controlsCss, ...controlsProps } = slotProps?.controls ?? {};
  const { onClick: pauseClick, ...pauseProps } = slotProps?.pauseButton ?? {};
  return (
    <WithSx className={className} styles={[rootStyle]} sx={sx}>
      {(className) => (
        <div {...rest} ref={ref} data-ui="dot-grid" data-paused={paused ? 'true' : 'false'} className={className}>
          <canvas {...sceneProps} ref={mergedSceneRef} id={sceneId} css={[sceneStyle, sceneCss]} data-fade={fade ? 'true' : 'false'}
            role={name ? 'img' : undefined} aria-label={name || undefined} aria-hidden={name ? undefined : true} />
          <div {...contentProps} css={[contentStyle, contentCss]} data-ui="dot-grid-content">{children}</div>
          {interactive && motionEnabled && (
            <div {...controlsProps} css={[controlsStyle, controlsCss]} data-ui="dot-grid-controls">
              <Button size="sm" variant="outline" {...pauseProps}
                aria-controls={[sceneId, pauseProps['aria-controls']].filter(Boolean).join(' ')}
                onClick={(event) => { pauseClick?.(event); if (!event.defaultPrevented) requestPaused(!paused); }}>
                {paused ? controlLabels?.resume : controlLabels?.pause}
              </Button>
            </div>
          )}
        </div>
      )}
    </WithSx>
  );
}

DotGrid.displayName = 'DotGrid';
