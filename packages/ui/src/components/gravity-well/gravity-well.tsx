'use client';

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ComponentType,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import type { SxProps } from '../../styling/sx';
import { useControlledState } from '../../utils/use-controlled-state';
import { useLatestCallback } from '../../utils/use-latest-callback';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { useReducedMotion } from '../../utils/use-reduced-motion';
import { Button } from '../button';
import { FieldSlot, type FieldElementProps } from '../field/field-slot';

declare const process: { env: { NODE_ENV?: string } };

export interface GravityWellItem {
  id: string;
  content: ReactNode;
}

export interface GravityWellControlLabels {
  pause: string;
  resume: string;
}

export interface GravityWellPulseOrigin {
  x: number;
  y: number;
  itemId?: string;
}

export type GravityWellSlots = {
  root?: ComponentType<ComponentPropsWithRef<'div'>>;
  field?: ComponentType<ComponentPropsWithRef<'div'>>;
  scene?: ComponentType<ComponentPropsWithRef<'ul'>>;
  tile?: ComponentType<ComponentPropsWithRef<'div'>>;
  controls?: ComponentType<ComponentPropsWithRef<'div'>>;
  pauseButton?: ComponentType<ComponentPropsWithRef<'button'>>;
};

export type GravityWellSlotProps = {
  root?: FieldElementProps<'div'>;
  field?: FieldElementProps<'div'>;
  scene?: FieldElementProps<'ul'>;
  tile?: FieldElementProps<'div'>;
  controls?: FieldElementProps<'div'>;
  pauseButton?: FieldElementProps<'button'>;
};

interface GravityWellBaseProps
  extends Omit<ComponentPropsWithRef<'div'>, 'children' | 'defaultValue'>,
    SxProps {
  /** Items to render inside the well grid. Noninteractive content only. */
  items: readonly GravityWellItem[];
  /** Optional custom renderer for each item. Defaults to `item.content`. */
  renderItem?: (item: GravityWellItem) => ReactNode;
  /** Accessible group name. Required. */
  label: string;
  /** Current keyboard well location. */
  value?: string;
  /** Initial keyboard well location when uncontrolled. Defaults to first item id. */
  defaultValue?: string;
  /** Callback fired when keyboard navigates to a new item. */
  onValueChange?: (id: string) => void;
  /** Positive integer fixed columns. Auto-fits when omitted. */
  columns?: number;
  /** Minimum tile size in CSS pixels when auto-fitting columns. Defaults to 56. */
  minTileSize?: number;
  /** Gap between tiles in CSS pixels. Defaults to resolved vars.space[2] (8px). */
  gap?: number;
  /** Gravitational pull reach radius in CSS pixels. Defaults to 150. */
  radius?: number;
  /** Gravitational pull strength (0 to 1.5). Defaults to 1. */
  strength?: number;
  /** Callback fired on click or keyboard activation. Local CSS pixel origin. */
  onPulse?: (origin: GravityWellPulseOrigin) => void;
  /** Controlled motion pause state. */
  paused?: boolean;
  /** Initial motion pause state when uncontrolled. Defaults to false. */
  defaultPaused?: boolean;
  /** Callback fired when pause/resume control is toggled. */
  onPausedChange?: (paused: boolean) => void;
  /** Replacement component for the root element. Sugar for `slots.root`. */
  component?: GravityWellSlots['root'];
  /** Replacement components for anatomy parts. */
  slots?: GravityWellSlots;
  /** Props forwarded to anatomy parts. */
  slotProps?: GravityWellSlotProps;
}

export type GravityWellProps = GravityWellBaseProps & (
  | {
      /** Enable pointer and keyboard interaction and pause controls. Defaults to `true`. */
      interactive?: true;
      /** Label the pause and resume buttons. Required when `interactive` is `true` or omitted. */
      controlLabels: GravityWellControlLabels;
    }
  | {
      /** Disable interaction, motion and pause controls. */
      interactive: false;
      /** Label the pause and resume buttons. Unused when `interactive` is `false`. */
      controlLabels?: GravityWellControlLabels;
    }
);

// Named field and physics constants
const WELL_DAMPING_RATE = 12;
const TILE_SPRING_STIFFNESS = 140;
const TILE_SPRING_DAMPING = 14;
const WAVE_SPEED = 900;
const WAVE_WIDTH = 80;
const WAVE_MAX_RADIUS = 1200;
const MAX_WAVES = 6;
const MAX_TIMESTEP_SEC = 0.032;
const EPSILON_REST = 0.05;
const PULL_MAX_DISPLACEMENT = 20;
const SCALE_MAX_BOOST = 0.12;

const rootStyle = css({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  gap: vars.space[3],
  color: vars.color.text,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  lineHeight: vars.lineHeight.base,
  boxSizing: 'border-box',
});

const fieldStyle = css({
  position: 'relative',
  boxSizing: 'border-box',
  overflow: 'hidden',
  borderRadius: vars.radius.lg,
  border: `1px solid ${vars.color.border}`,
  backgroundColor: vars.color.surface,
  padding: vars.space[4],
  touchAction: 'pan-y',
  outline: 'none',
  '&:focus-visible': focusRingOutset,
  [FORCED_COLORS]: {
    borderColor: 'CanvasText',
  },
});

const listStyle = css({
  display: 'grid',
  gap: vars.space[2],
  listStyle: 'none',
  margin: 0,
  padding: 0,
  boxSizing: 'border-box',
  placeItems: 'center',
});

const cellStyle = css({
  position: 'relative',
  boxSizing: 'border-box',
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  inlineSize: '100%',
  aspectRatio: '1 / 1',
});

const tileStyle = css({
  position: 'relative',
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  inlineSize: '100%',
  blockSize: '100%',
  borderRadius: vars.radius.sm,
  overflow: 'hidden',
  userSelect: 'none',
  backgroundColor: vars.color.surfaceRaised,
  border: `1px solid ${vars.color.border}`,
  transition: `box-shadow ${vars.motion.duration.fast} ${vars.motion.easeStandard}, border-color ${vars.motion.duration.fast} ${vars.motion.easeStandard}`,
  '& img, & svg': {
    objectFit: 'cover',
    inlineSize: '100%',
    blockSize: '100%',
    pointerEvents: 'none',
  },
  '&[data-active="true"]': {
    outline: `2px solid ${vars.color.borderControl}`,
    outlineOffset: '2px',
    zIndex: 2,
  },
  [REDUCED_MOTION]: {
    transition: 'none',
    transform: 'none !important',
  },
  [FORCED_COLORS]: {
    forcedColorAdjust: 'none',
    transform: 'none !important',
    '&[data-active="true"]': {
      outline: '2px solid Highlight',
    },
  },
});

const controlsStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: vars.space[2],
  minBlockSize: vars.space[8],
});

const buttonStyle = css({
  minBlockSize: vars.space[8],
  paddingBlock: vars.space[1],
  paddingInline: vars.space[3],
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.surfaceRaised,
  color: vars.color.text,
  font: 'inherit',
  cursor: 'pointer',
  '&:focus-visible': focusRingOutset,
  '&:hover': {
    backgroundColor: vars.color.surfaceHover,
  },
  [FORCED_COLORS]: { borderColor: 'ButtonText' },
  [REDUCED_MOTION]: { transition: 'none' },
});

export function GravityWell({
  ref,
  items,
  renderItem,
  label,
  value: valueProp,
  defaultValue,
  onValueChange,
  columns,
  minTileSize = 56,
  gap,
  radius = 150,
  strength = 1,
  interactive = true,
  onPulse,
  paused: pausedProp,
  defaultPaused = false,
  onPausedChange,
  controlLabels,
  component,
  slots,
  slotProps,
  sx,
  className,
  ...rest
}: GravityWellProps) {
  const labelId = useId();
  const isReduced = useReducedMotion();
  const prefersReducedMotion = isReduced ?? false;
  const [forcedColors, setForcedColors] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(forced-colors: active)');
    const update = () => setForcedColors(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  if (process.env.NODE_ENV !== 'production') {
    if (component && slots?.root) {
      console.warn('GravityWell: component is redundant when slots.root is supplied; slots.root wins.');
    }
    if (items.length > 60) {
      console.warn('GravityWell: item count exceeds 60; rendering static list without animations.');
    }
  }

  const [value, setValue] = useControlledState(
    valueProp,
    defaultValue ?? items[0]?.id,
    onValueChange,
  );

  const [isPaused = false, setPaused] = useControlledState(
    pausedProp,
    defaultPaused ?? false,
    onPausedChange,
  );

  // Unknown or deleted value displays marker at first item without emitting callback
  const activeItemId = items.some((item) => item.id === value) ? value : items[0]?.id;

  const gapPx = typeof gap === 'number' && Number.isFinite(gap) && gap >= 0 ? gap : undefined;
  const minTileSizePx =
    typeof minTileSize === 'number' && Number.isFinite(minTileSize) && minTileSize > 0
      ? minTileSize
      : 56;
  const hasFixedColumns =
    typeof columns === 'number' && Number.isInteger(columns) && columns > 0;
  const fixedColCount = hasFixedColumns ? columns : undefined;
  const clampedStrength =
    typeof strength === 'number' && Number.isFinite(strength)
      ? Math.max(0, Math.min(1.5, strength))
      : 1;
  const resolvedRadius =
    typeof radius === 'number' && Number.isFinite(radius) && radius > 0 ? radius : 150;

  const isMotionDisabled =
    !interactive || prefersReducedMotion || forcedColors || isPaused || !items.length || items.length > 60;

  const fieldRef = useRef<HTMLDivElement | null>(null);
  const itemElementsRef = useRef<Map<string, HTMLLIElement>>(new Map());
  const tileElementsRef = useRef<Map<string, HTMLDivElement>>(new Map());

  const tileCentersRef = useRef<Map<string, { baseX: number; baseY: number }>>(new Map());
  const measuredColumnCountRef = useRef<number>(fixedColCount ?? 1);

  const rafRef = useRef<number | null>(null);
  const animatingRef = useRef(false);
  const lastTimeRef = useRef(0);
  const isPointerInsideRef = useRef(false);
  const pointerPosRef = useRef({ x: 0, y: 0 });
  const wellPosRef = useRef({ x: 0, y: 0 });
  const wavesRef = useRef<Array<{ originX: number; originY: number; radius: number }>>([]);
  const isIntersectingRef = useRef(true);
  const isUnmountedRef = useRef(false);

  const tilePhysicsRef = useRef<
    Map<
      string,
      { x: number; y: number; vx: number; vy: number; scale: number; opacity: number }
    >
  >(new Map());

  // Detect interactive content inside tiles in dev mode
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' && fieldRef.current) {
      const interactiveChild = fieldRef.current.querySelector(
        'a, button, input, select, textarea, [tabindex]:not([data-ui="gravity-well-field"])',
      );
      if (interactiveChild) {
        console.warn('GravityWell: tiles must not contain interactive or focusable elements.');
      }
    }
  }, [items]);

  // Keep physics map in sync with current items
  useEffect(() => {
    const currentMap = tilePhysicsRef.current;
    const itemIds = new Set(items.map((it) => it.id));
    for (const key of currentMap.keys()) {
      if (!itemIds.has(key)) currentMap.delete(key);
    }
    for (const item of items) {
      if (!currentMap.has(item.id)) {
        currentMap.set(item.id, { x: 0, y: 0, vx: 0, vy: 0, scale: 1, opacity: 1 });
      }
    }
  }, [items]);

  const updateGeometry = () => {
    if (!fieldRef.current) return;
    const fieldRect = fieldRef.current.getBoundingClientRect();
    const centers = new Map<string, { baseX: number; baseY: number }>();

    for (const item of items) {
      const liEl = itemElementsRef.current.get(item.id);
      if (liEl) {
        const liRect = liEl.getBoundingClientRect();
        centers.set(item.id, {
          baseX: liRect.left - fieldRect.left + liRect.width / 2,
          baseY: liRect.top - fieldRect.top + liRect.height / 2,
        });
      }
    }
    tileCentersRef.current = centers;

    if (hasFixedColumns) {
      measuredColumnCountRef.current = fixedColCount!;
    } else if (items.length > 0) {
      const firstItem = items[0];
      const firstTile = firstItem ? centers.get(firstItem.id) : undefined;
      if (firstTile) {
        let count = 0;
        for (const item of items) {
          const c = centers.get(item.id);
          if (c && Math.abs(c.baseY - firstTile.baseY) < 5) {
            count++;
          } else {
            break;
          }
        }
        measuredColumnCountRef.current = Math.max(1, count);
      }
    }
  };

  const startAnimationIfNeeded = useLatestCallback(() => {
    if (
      isMotionDisabled ||
      !isIntersectingRef.current ||
      fieldRef.current?.ownerDocument.hidden ||
      isUnmountedRef.current
    ) {
      return;
    }
    if (!animatingRef.current) {
      animatingRef.current = true;
      lastTimeRef.current = performance.now();
      rafRef.current = requestAnimationFrame(animateFrame);
    }
  });

  const animateFrame = useLatestCallback((now: number) => {
    if (
      !animatingRef.current ||
      isUnmountedRef.current ||
      isMotionDisabled ||
      !isIntersectingRef.current ||
      fieldRef.current?.ownerDocument.hidden
    ) {
      animatingRef.current = false;
      rafRef.current = null;
      return;
    }

    const dt = Math.min(
      MAX_TIMESTEP_SEC,
      Math.max(0.001, (now - lastTimeRef.current) / 1000),
    );
    lastTimeRef.current = now;

    const isFieldFocused = fieldRef.current?.ownerDocument.activeElement === fieldRef.current;
    let wellActive = false;
    let targetWellX = wellPosRef.current.x;
    let targetWellY = wellPosRef.current.y;

    if (isPointerInsideRef.current) {
      targetWellX = pointerPosRef.current.x;
      targetWellY = pointerPosRef.current.y;
      wellActive = true;
    } else if (isFieldFocused && activeItemId) {
      const tileCenter = tileCentersRef.current.get(activeItemId);
      if (tileCenter) {
        targetWellX = tileCenter.baseX;
        targetWellY = tileCenter.baseY;
        wellActive = true;
      }
    }

    if (wellActive) {
      const damping = Math.min(1, WELL_DAMPING_RATE * dt);
      wellPosRef.current.x += (targetWellX - wellPosRef.current.x) * damping;
      wellPosRef.current.y += (targetWellY - wellPosRef.current.y) * damping;
    }

    const currentWellX = wellPosRef.current.x;
    const currentWellY = wellPosRef.current.y;

    const activeWaves = wavesRef.current;
    for (let index = activeWaves.length - 1; index >= 0; index--) {
      const wave = activeWaves[index]!;
      wave.radius += WAVE_SPEED * dt;
      if (wave.radius >= WAVE_MAX_RADIUS) {
        activeWaves.splice(index, 1);
      }
    }

    let allAtRest = true;

    for (const item of items) {
      const center = tileCentersRef.current.get(item.id);
      let tile = tilePhysicsRef.current.get(item.id);
      if (!tile) {
        tile = { x: 0, y: 0, vx: 0, vy: 0, scale: 1, opacity: 1 };
        tilePhysicsRef.current.set(item.id, tile);
      }

      if (!center) continue;

      let targetOffsetX = 0;
      let targetOffsetY = 0;
      let targetScale = 1;

      if (wellActive && clampedStrength > 0) {
        const dx = currentWellX - center.baseX;
        const dy = currentWellY - center.baseY;
        const dist = Math.hypot(dx, dy);

        if (dist < resolvedRadius) {
          const factor = 1 - dist / resolvedRadius;
          const falloff = factor * factor;
          const pullDist = Math.min(dist, PULL_MAX_DISPLACEMENT * falloff * clampedStrength);
          const angle = Math.atan2(dy, dx);
          targetOffsetX = Math.cos(angle) * pullDist;
          targetOffsetY = Math.sin(angle) * pullDist;
          targetScale = 1 + SCALE_MAX_BOOST * falloff * clampedStrength;
        }
      }

      let waveOffsetX = 0;
      let waveOffsetY = 0;
      for (const wave of activeWaves) {
        const tileDist = Math.hypot(center.baseX - wave.originX, center.baseY - wave.originY);
        const distFromFront = Math.abs(tileDist - wave.radius);
        if (distFromFront < WAVE_WIDTH) {
          const amplitude = Math.max(0, 1 - wave.radius / WAVE_MAX_RADIUS);
          const waveFactor = Math.sin((1 - distFromFront / WAVE_WIDTH) * Math.PI) * amplitude;
          const angle = Math.atan2(center.baseY - wave.originY, center.baseX - wave.originX);
          waveOffsetX += Math.cos(angle) * waveFactor * 16;
          waveOffsetY += Math.sin(angle) * waveFactor * 16;
        }
      }

      const totalTargetX = targetOffsetX + waveOffsetX;
      const totalTargetY = targetOffsetY + waveOffsetY;

      const diffX = totalTargetX - tile.x;
      const diffY = totalTargetY - tile.y;
      const ax = diffX * TILE_SPRING_STIFFNESS - tile.vx * TILE_SPRING_DAMPING;
      const ay = diffY * TILE_SPRING_STIFFNESS - tile.vy * TILE_SPRING_DAMPING;

      tile.vx += ax * dt;
      tile.vy += ay * dt;
      tile.x += tile.vx * dt;
      tile.y += tile.vy * dt;
      tile.scale += (targetScale - tile.scale) * Math.min(1, 10 * dt);

      const tileEl = tileElementsRef.current.get(item.id);
      if (tileEl) {
        const tx = Math.round(tile.x * 100) / 100;
        const ty = Math.round(tile.y * 100) / 100;
        const s = Math.round(tile.scale * 1000) / 1000;
        const isTransformed = tx !== 0 || ty !== 0 || s !== 1;
        const newTransform = isTransformed ? `translate3d(${tx}px, ${ty}px, 0) scale(${s})` : '';
        if (tileEl.style.transform !== newTransform) {
          tileEl.style.transform = newTransform;
        }
      }

      if (
        Math.abs(tile.x - totalTargetX) > EPSILON_REST ||
        Math.abs(tile.y - totalTargetY) > EPSILON_REST ||
        Math.abs(tile.vx) > EPSILON_REST ||
        Math.abs(tile.vy) > EPSILON_REST ||
        Math.abs(tile.scale - targetScale) > 0.01
      ) {
        allAtRest = false;
      }
    }

    if (activeWaves.length > 0) {
      allAtRest = false;
    }

    if (
      wellActive &&
      (Math.abs(targetWellX - wellPosRef.current.x) > 0.5 ||
        Math.abs(targetWellY - wellPosRef.current.y) > 0.5)
    ) {
      allAtRest = false;
    }

    if (
      allAtRest &&
      (!wellActive ||
        (Math.abs(targetWellX - wellPosRef.current.x) <= 0.5 &&
          Math.abs(targetWellY - wellPosRef.current.y) <= 0.5))
    ) {
      animatingRef.current = false;
      rafRef.current = null;
      return;
    }

    rafRef.current = requestAnimationFrame(animateFrame);
  });

  const addWave = (originX: number, originY: number) => {
    if (wavesRef.current.length >= MAX_WAVES) {
      wavesRef.current.shift();
    }
    wavesRef.current.push({ originX, originY, radius: 0 });
    startAnimationIfNeeded();
  };

  const getTileCenter = (itemId?: string): { x: number; y: number } | null => {
    if (!itemId) return null;
    const center = tileCentersRef.current.get(itemId);
    if (center) return { x: center.baseX, y: center.baseY };
    const liEl = itemElementsRef.current.get(itemId);
    if (liEl && fieldRef.current) {
      const fieldRect = fieldRef.current.getBoundingClientRect();
      const liRect = liEl.getBoundingClientRect();
      return {
        x: liRect.left - fieldRect.left + liRect.width / 2,
        y: liRect.top - fieldRect.top + liRect.height / 2,
      };
    }
    return null;
  };

  // Geometry measurement on mount and layout changes
  useLayoutEffect(() => {
    updateGeometry();
  }, [items, columns, gapPx, minTileSizePx]);

  // ResizeObserver for fluid width and ragged row geometry
  useEffect(() => {
    if (!fieldRef.current || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      updateGeometry();
      startAnimationIfNeeded();
    });
    ro.observe(fieldRef.current);
    return () => {
      ro.disconnect();
    };
  }, [items, columns, gapPx, minTileSizePx]);

  // IntersectionObserver to pause when offscreen
  useEffect(() => {
    if (!fieldRef.current || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      isIntersectingRef.current = entry.isIntersecting;
      if (!entry.isIntersecting) {
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
          animatingRef.current = false;
        }
      } else {
        lastTimeRef.current = performance.now();
        startAnimationIfNeeded();
      }
    });
    io.observe(fieldRef.current);
    return () => {
      io.disconnect();
    };
  }, []);

  // Visibility change to pause when document tab is hidden
  useEffect(() => {
    const doc = fieldRef.current?.ownerDocument;
    if (!doc) return;
    const handleVisibility = () => {
      if (doc.hidden) {
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
          animatingRef.current = false;
        }
      } else {
        lastTimeRef.current = performance.now();
        startAnimationIfNeeded();
      }
    };
    doc.addEventListener('visibilitychange', handleVisibility);
    return () => {
      doc.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Pause state / reduced motion handler
  useEffect(() => {
    if (isMotionDisabled) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        animatingRef.current = false;
      }
      if (prefersReducedMotion || forcedColors || !interactive || items.length > 60) {
        for (const item of items) {
          const tileEl = tileElementsRef.current.get(item.id);
          if (tileEl) tileEl.style.transform = '';
        }
      }
    } else {
      startAnimationIfNeeded();
    }
  }, [isMotionDisabled, activeItemId, clampedStrength, resolvedRadius, items, startAnimationIfNeeded]);

  // StrictMode cleanup
  useEffect(() => {
    isUnmountedRef.current = false;
    return () => {
      isUnmountedRef.current = true;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        animatingRef.current = false;
      }
    };
  }, []);

  const handleFieldKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented) return;
    if (event.target !== event.currentTarget) return;

    const key = event.key;

    if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
      if (key === ' ' || key === 'Spacebar') {
        event.preventDefault();
      }
      if (event.repeat) return;
      if (activeItemId) {
        const center = getTileCenter(activeItemId);
        if (center) {
          onPulse?.({ x: center.x, y: center.y, itemId: activeItemId });
          if (!isMotionDisabled) {
            addWave(center.x, center.y);
          }
        }
      }
      return;
    }

    const isArrowKey =
      key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown';
    const isNavKey = isArrowKey || key === 'Home' || key === 'End';

    if (!isNavKey) return;

    event.preventDefault();

    if (items.length === 0) return;

    const currentIndex = items.findIndex((it) => it.id === activeItemId);
    if (currentIndex === -1) return;

    const colCount = measuredColumnCountRef.current || 1;
    const currentRow = Math.floor(currentIndex / colCount);
    const currentCol = currentIndex % colCount;

    let nextIndex = currentIndex;

    if (key === 'ArrowUp') {
      if (currentRow > 0) {
        const targetRow = currentRow - 1;
        const rowStart = targetRow * colCount;
        const itemsInRow = Math.min(colCount, items.length - rowStart);
        const clampedCol = Math.min(currentCol, itemsInRow - 1);
        nextIndex = rowStart + clampedCol;
      }
    } else if (key === 'ArrowDown') {
      const rowCount = Math.ceil(items.length / colCount);
      if (currentRow < rowCount - 1) {
        const targetRow = currentRow + 1;
        const rowStart = targetRow * colCount;
        const itemsInRow = Math.min(colCount, items.length - rowStart);
        const clampedCol = Math.min(currentCol, itemsInRow - 1);
        nextIndex = rowStart + clampedCol;
      }
    } else if (key === 'ArrowLeft' || key === 'ArrowRight') {
      const isRtl = fieldRef.current
        ? getComputedStyle(fieldRef.current).direction === 'rtl'
        : false;
      const isMovingLeft = key === 'ArrowLeft';
      const deltaCol = isRtl ? (isMovingLeft ? 1 : -1) : (isMovingLeft ? -1 : 1);
      const targetCol = currentCol + deltaCol;
      const rowStart = currentRow * colCount;
      const itemsInRow = Math.min(colCount, items.length - rowStart);
      if (targetCol >= 0 && targetCol < itemsInRow) {
        nextIndex = rowStart + targetCol;
      }
    } else if (key === 'Home') {
      nextIndex = 0;
    } else if (key === 'End') {
      nextIndex = items.length - 1;
    }

    const targetItem = items[nextIndex];
    if (nextIndex !== currentIndex && targetItem) {
      setValue(targetItem.id);
      startAnimationIfNeeded();
    }
  };

  const handleFieldPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!interactive || !fieldRef.current) return;
    const rect = fieldRef.current.getBoundingClientRect();
    isPointerInsideRef.current = true;
    pointerPosRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    startAnimationIfNeeded();
  };

  const handleFieldPointerLeave = () => {
    isPointerInsideRef.current = false;
    startAnimationIfNeeded();
  };

  const handleFieldClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || !fieldRef.current || !items.length) return;
    const rect = fieldRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const tileEl = (event.target as HTMLElement).closest('[data-ui="gravity-well-tile"]');
    const clickedItemId = tileEl?.getAttribute('data-item-id') ?? undefined;

    onPulse?.({ x, y, itemId: clickedItemId });
    if (!isMotionDisabled) {
      addWave(x, y);
    }
  };

  const handleTogglePause = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.defaultPrevented) return;
    setPaused(!isPaused);
  };

  const gridTemplateColumns = hasFixedColumns
    ? `repeat(${fixedColCount}, minmax(${minTileSizePx}px, 1fr))`
    : `repeat(auto-fill, minmax(${minTileSizePx}px, 1fr))`;

  const showControls = Boolean(interactive && items.length > 0 && controlLabels);

  const isFocusable = Boolean(interactive && items.length > 0);
  const consumerLabelledBy = rest['aria-labelledby'];
  const hasConsumerLabelledBy = Boolean(consumerLabelledBy?.trim() || slotProps?.root?.['aria-labelledby']?.trim());
  const mergedLabelledBy = hasConsumerLabelledBy ? [consumerLabelledBy, labelId].filter(Boolean).join(' ') : undefined;
  const resolvedAriaLabel = hasConsumerLabelledBy ? undefined : (rest['aria-label'] || label);

  return (
    <FieldSlot
      root
      element="div"
      component={slots?.root ?? component}
      slotProps={slotProps?.root}
      data-ui="gravity-well"
      role="group"
      ref={ref}
      className={className}
      styles={rootStyle}
      sx={sx}
      {...rest}
      aria-label={resolvedAriaLabel}
      aria-labelledby={mergedLabelledBy}
    >
      <span id={labelId} css={visuallyHiddenStyle}>{label}</span>
      <FieldSlot
        element="div"
        component={slots?.field}
        slotProps={slotProps?.field}
        data-ui="gravity-well-field"
        ref={fieldRef}
        role={isFocusable ? 'group' : undefined}
        tabIndex={isFocusable ? 0 : undefined}
        aria-labelledby={isFocusable ? labelId : undefined}
        styles={fieldStyle}
        behavior={{
          onKeyDown: isFocusable ? handleFieldKeyDown : undefined,
          onPointerMove: isFocusable ? handleFieldPointerMove : undefined,
          onPointerLeave: isFocusable ? handleFieldPointerLeave : undefined,
          onClick: isFocusable ? handleFieldClick : undefined,
          onFocus: isFocusable ? startAnimationIfNeeded : undefined,
          onBlur: isFocusable ? startAnimationIfNeeded : undefined,
        }}
      >
        <FieldSlot
          element="ul"
          component={slots?.scene}
          slotProps={slotProps?.scene}
          data-ui="gravity-well-scene"
          role="list"
          styles={listStyle}
          style={{
            gridTemplateColumns,
            gap: gapPx === undefined ? undefined : `${gapPx}px`,
          }}
        >
          {items.map((item) => {
            const isMarkerActive = interactive && item.id === activeItemId;
            return (
              <li
                key={item.id}
                role="listitem"
                aria-current={isMarkerActive ? 'true' : undefined}
                ref={(el) => {
                  if (el) itemElementsRef.current.set(item.id, el);
                  else itemElementsRef.current.delete(item.id);
                }}
                data-item-id={item.id}
                css={cellStyle}
              >
                <FieldSlot
                  element="div"
                  component={slots?.tile}
                  slotProps={slotProps?.tile}
                  data-ui="gravity-well-tile"
                  data-item-id={item.id}
                  data-active={isMarkerActive ? 'true' : undefined}
                  ref={(el: HTMLDivElement | null) => {
                    if (el) tileElementsRef.current.set(item.id, el);
                    else tileElementsRef.current.delete(item.id);
                  }}
                  styles={tileStyle}
                >
                  {renderItem ? renderItem(item) : item.content}
                </FieldSlot>
              </li>
            );
          })}
        </FieldSlot>
      </FieldSlot>
      {showControls && (
        <FieldSlot
          element="div"
          component={slots?.controls}
          slotProps={slotProps?.controls}
          data-ui="gravity-well-controls"
          styles={controlsStyle}
        >
          <FieldSlot
            element="button"
            component={slots?.pauseButton ?? Button}
            slotProps={slotProps?.pauseButton}
            data-ui="gravity-well-pause-button"
            type="button"
            styles={buttonStyle}
            behavior={{
              onClick: handleTogglePause,
            }}
          >
            {isPaused ? controlLabels!.resume : controlLabels!.pause}
          </FieldSlot>
        </FieldSlot>
      )}
    </FieldSlot>
  );
}

GravityWell.displayName = 'GravityWell';
