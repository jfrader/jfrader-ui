// Semantics: a labeled dot is one `role="img"` named by `label`; a decorative dot is
// `aria-hidden` and leaves the name to the element around it (Avatar, a row with visible text).
// Each presence status draws its own glyph, so the state survives without color: online is
// solid, away is a crescent, busy carries a bar, offline is hollow. Not interactive.
import type { ComponentPropsWithRef, CSSProperties } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, keyframes, type SerializedStyles } from '../../styling/css';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';

export type StatusDotStatus = 'online' | 'away' | 'busy' | 'offline' | 'neutral';
export type StatusDotVariant = 'dot' | 'square';
export type StatusDotSize = 'sm' | 'md' | 'lg';
/** A color token name from `vars.color`, for example `accent` or `info`. */
export type StatusDotColor = keyof typeof vars.color;

export type StatusDotNaming =
  | {
      /** Names the dot for assistive tech. Required when the dot is the only cue for its state. */
      label: string;
      decorative?: false;
    }
  | {
      /** Hides the dot from assistive tech. Use it when a named parent or visible text carries the state. */
      decorative: true;
      label?: undefined;
    };

/** Everything except naming; the dot renders no content and owns its role. */
export interface StatusDotBaseProps
  extends Omit<
      ComponentPropsWithRef<'span'>,
      'children' | 'dangerouslySetInnerHTML' | 'color' | 'role' | 'aria-label' | 'aria-labelledby' | 'aria-hidden'
    >,
    SxProps {
  /** Sets the color and the glyph. Defaults to `neutral`. */
  status?: StatusDotStatus;
  /** Draws a round dot or a rounded square. Defaults to `dot`. */
  variant?: StatusDotVariant;
  /** Sets the dot's side: `sm` 8px, `md` 12px, `lg` 16px. Defaults to `md`. */
  size?: StatusDotSize;
  /** Repeats a ring that expands from the dot's own edge. Reduced motion and forced colors hide it. Defaults to `false`. */
  pulse?: boolean;
  /** Replaces the status color with a color token; the status glyph stays. */
  color?: StatusDotColor;
}

export type StatusDotProps = StatusDotBaseProps & StatusDotNaming;

/*
 * Status color against `bg` (non-text, WCAG 1.4.11 needs 3:1; WCAG 2 relative luminance).
 * Dark from the hex sources; light is the lower bound from the Pill and Badge tables, whose
 * fills sit on `bg`.
 *
 *   status    token        dark    light
 *   online    success      7.97    >= 6.1
 *   away      warning      8.95    >= 6.1
 *   busy      danger       4.2     6.5
 *   offline   textSubtle   4.57    6.0
 *   neutral   textMuted    6.1     7.1
 */
const statusTones: Record<StatusDotStatus, string> = {
  online: vars.color.success,
  away: vars.color.warning,
  busy: vars.color.danger,
  offline: vars.color.textSubtle,
  neutral: vars.color.textMuted,
};

// `--status-dot-surface` is the color the dot sits on. It paints the separating outline and the
// glyph cut-outs; override it through `sx` when the dot sits on something other than `bg`.
const ink = 'var(--status-dot-ink)';
const cut = 'var(--status-dot-cut)';

const rootStyle = css({
  '--status-dot-surface': vars.color.bg,
  '--status-dot-ink': 'var(--status-dot-tone)',
  '--status-dot-cut': 'var(--status-dot-surface)',
  position: 'relative',
  display: 'inline-block',
  flexShrink: 0,
  boxSizing: 'border-box',
  inlineSize: 'var(--status-dot-size)',
  blockSize: 'var(--status-dot-size)',
  background: ink,
  outline: `2px solid ${cut}`,
  verticalAlign: 'middle',
  [FORCED_COLORS]: {
    forcedColorAdjust: 'none',
    '--status-dot-ink': 'CanvasText',
    '--status-dot-cut': 'Canvas',
  },
});

const variantStyles: Record<StatusDotVariant, SerializedStyles> = {
  dot: css({ borderRadius: vars.radius.full }),
  // A quarter of the side keeps the square's corners in proportion at every size.
  square: css({ borderRadius: 'calc(var(--status-dot-size) / 4)' }),
};

const sizeStyles: Record<StatusDotSize, SerializedStyles> = {
  sm: css({ '--status-dot-size': vars.space[2] }),
  md: css({ '--status-dot-size': vars.space[3] }),
  lg: css({ '--status-dot-size': vars.space[4] }),
};

// Glyphs are background layers clipped by the root's own corners, so nothing paints outside the
// dot when it sits on a photo.
const glyphStyles: Record<StatusDotStatus, SerializedStyles> = {
  online: css({ '--status-dot-tone': statusTones.online }),
  neutral: css({ '--status-dot-tone': statusTones.neutral }),
  away: css({
    '--status-dot-tone': statusTones.away,
    background: `radial-gradient(circle calc(var(--status-dot-size) * 0.4) at 25% 25%, ${cut} 100%, ${ink} 100%)`,
  }),
  busy: css({
    '--status-dot-tone': statusTones.busy,
    background: `linear-gradient(${cut}, ${cut}) center / 60% 25% no-repeat, ${ink}`,
  }),
  offline: css({
    '--status-dot-tone': statusTones.offline,
    background: `radial-gradient(circle closest-side, ${cut} 50%, ${ink} 50%)`,
  }),
};

const PULSE_START_SCALE = 0.8;
const PULSE_END_SCALE = 2.4;

const pulseRing = keyframes({
  from: { transform: `scale(${PULSE_START_SCALE})`, opacity: 1 },
  to: { transform: `scale(${PULSE_END_SCALE})`, opacity: 0 },
});

const hiddenPulse = {
  '&[data-pulse]::after': { content: 'none', display: 'none', animation: 'none' },
} as const;

// The ring is the dot's own box (inset 0, centered origin), so it grows from the dot's edge
// wherever the dot is placed.
const pulseStyle = css({
  '&[data-pulse]::after': {
    content: '""',
    position: 'absolute',
    inset: 0,
    boxSizing: 'border-box',
    borderRadius: 'inherit',
    border: `1px solid ${ink}`,
    transformOrigin: 'center',
    pointerEvents: 'none',
    animation: `${pulseRing} ${vars.motion.duration.presence} infinite ${vars.motion.easePresence}`,
  },
  [REDUCED_MOTION]: hiddenPulse,
  [FORCED_COLORS]: hiddenPulse,
});

/** Show presence or a state as a small dot. Pair a decorative dot with visible text or a named parent. */
export function StatusDot({
  ref,
  status = 'neutral',
  variant = 'dot',
  size = 'md',
  pulse = false,
  color,
  label,
  decorative,
  className,
  sx,
  style,
  'data-ui': dataUi,
  ...rest
}: StatusDotProps & { 'data-ui'?: string }) {
  const identity = [...new Set(['status-dot', ...(dataUi?.split(/\s+/).filter(Boolean) ?? [])])].join(' ');
  const toneStyle =
    color === undefined ? style : ({ ...style, '--status-dot-tone': vars.color[color] } as CSSProperties);
  return (
    <WithSx
      className={className}
      styles={[rootStyle, sizeStyles[size], variantStyles[variant], glyphStyles[status], pulseStyle]}
      sx={sx}
    >
      {(className) => (
        <span
          {...rest}
          ref={ref}
          data-ui={identity}
          data-status={status}
          data-variant={variant}
          data-size={size}
          data-pulse={pulse ? '' : undefined}
          role={decorative ? undefined : 'img'}
          aria-label={decorative ? undefined : label}
          aria-hidden={decorative ? 'true' : undefined}
          className={className}
          style={toneStyle}
          children={undefined}
          dangerouslySetInnerHTML={undefined}
        />
      )}
    </WithSx>
  );
}

StatusDot.displayName = 'StatusDot';
