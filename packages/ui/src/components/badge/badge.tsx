// Overlay indicator anchored to a corner of its child (a count or a dot). No role: a standard
// marker's text follows the child in reading order, so assistive tech reads "child, count";
// the dot carries no text and is hidden from AT. Pass words in `badgeContent` when the number
// alone is ambiguous. Not interactive.
import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type SerializedStyles, type Theme } from '../../styling/css';

export type BadgeVariant = 'standard' | 'dot';
export type BadgeTone = 'accent' | 'danger' | 'neutral';
export type BadgeOverlap = 'rectangular' | 'circular';
export type BadgeAnchor = { vertical?: 'top' | 'bottom'; horizontal?: 'start' | 'end' };

export interface BadgePartProps {
  className?: string;
  css?: Interpolation<Theme>;
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  badgeContent?: ReactNode;
  /** Numbers above `max` render as `max+`. */
  max?: number;
  /** Shows the marker when `badgeContent` is 0. */
  showZero?: boolean;
  invisible?: boolean;
  variant?: BadgeVariant;
  tone?: BadgeTone;
  anchor?: BadgeAnchor;
  overlap?: BadgeOverlap;
  slotProps?: {
    root?: BadgePartProps;
    badge?: BadgePartProps;
  };
}

type AnchorKey = `${NonNullable<BadgeAnchor['vertical']>}-${NonNullable<BadgeAnchor['horizontal']>}`;

const DEFAULT_MAX = 99;

const rootStyle = css({
  position: 'relative',
  display: 'inline-flex',
  flexShrink: 0,
  verticalAlign: 'middle',
});

// The page-colored ring separates the marker from whatever it overlaps (avatars, buttons);
// it is not a state cue. Pointer events pass through so the marker never steals clicks or
// hover from the child it sits on.
const markerStyle = css({
  position: 'absolute',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxSizing: 'border-box',
  boxShadow: `0 0 0 2px ${vars.color.bg}`,
  fontWeight: vars.fontWeight.medium,
  lineHeight: 1,
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
});

const variantStyles: Record<BadgeVariant, SerializedStyles> = {
  standard: css({
    blockSize: vars.space[5],
    minInlineSize: vars.space[5],
    paddingInline: vars.space[1],
    fontSize: vars.textSize.xs,
  }),
  dot: css({
    blockSize: vars.space[2],
    inlineSize: vars.space[2],
    borderRadius: vars.radius.full,
  }),
};

// Standard markers follow the child's shape; dots are always round (set in variantStyles).
const overlapStyles: Record<BadgeOverlap, SerializedStyles> = {
  rectangular: css({ borderRadius: vars.radius.sm }),
  circular: css({ borderRadius: vars.radius.full }),
};

// Insets are logical, but transforms are physical: the X half-shift points outward from the
// inline edge, so it flips sign when the root's effective direction is RTL.
const anchorStyles: Record<AnchorKey, SerializedStyles> = {
  'top-start': css({
    insetBlockStart: 0,
    insetInlineStart: 0,
    transform: 'translate(-50%, -50%)',
    '&:dir(rtl)': { transform: 'translate(50%, -50%)' },
  }),
  'top-end': css({
    insetBlockStart: 0,
    insetInlineEnd: 0,
    transform: 'translate(50%, -50%)',
    '&:dir(rtl)': { transform: 'translate(-50%, -50%)' },
  }),
  'bottom-start': css({
    insetBlockEnd: 0,
    insetInlineStart: 0,
    transform: 'translate(-50%, 50%)',
    '&:dir(rtl)': { transform: 'translate(50%, 50%)' },
  }),
  'bottom-end': css({
    insetBlockEnd: 0,
    insetInlineEnd: 0,
    transform: 'translate(50%, 50%)',
    '&:dir(rtl)': { transform: 'translate(-50%, 50%)' },
  }),
};

/*
 * Solid fills (WCAG 2 relative luminance; oklch converted via OKLab → linear sRGB, out-of-gamut
 * channels clipped). Text AA needs 4.5:1; the fill against `bg` (non-text, dot) needs 3:1.
 *
 *   tone     text on fill                      dark    light    fill vs bg (dark / light)
 *   accent   accentContrast on accent          6.8     5.1      7.4 / 5.1
 *   danger   dangerContrast on danger          4.7     6.5      4.2 / 6.5
 *   neutral  bg             on textMuted       6.1     7.1      6.1 / 7.1
 *
 * accentText/dangerText fail on the solid fills (1.0 and 1.4 dark, 1.4 and 1.0 light).
 * textMuted on surfaceHover reads (5.4 / 6.6) but that fill is ~1.1:1 against `bg`, so the
 * marker would have no visible shape; the inverted pair keeps neutral a solid chip.
 */
const toneStyles: Record<BadgeTone, SerializedStyles> = {
  accent: css({ backgroundColor: vars.color.accent, color: vars.color.accentContrast }),
  danger: css({ backgroundColor: vars.color.danger, color: vars.color.dangerContrast }),
  neutral: css({ backgroundColor: vars.color.textMuted, color: vars.color.bg }),
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  {
    children,
    badgeContent,
    max = DEFAULT_MAX,
    showZero = false,
    invisible = false,
    variant = 'standard',
    tone = 'accent',
    anchor,
    overlap = 'rectangular',
    slotProps,
    className,
    ...rest
  },
  ref,
) {
  const isDot = variant === 'dot';
  // MUI-faithful: null/undefined/false never render a marker, even with showZero; numeric zero
  // hides unless showZero; dot never hides on content. The one deliberate extension over MUI
  // treats false as absent so `count > 0 && count` idioms hide cleanly.
  const hidden =
    invisible ||
    (variant !== 'dot' && (badgeContent == null || badgeContent === false || (badgeContent === 0 && !showZero)));
  const content = typeof badgeContent === 'number' && badgeContent > max ? `${max}+` : badgeContent;
  const anchorKey: AnchorKey = `${anchor?.vertical ?? 'top'}-${anchor?.horizontal ?? 'end'}`;
  const rootClassName = [className, slotProps?.root?.className].filter(Boolean).join(' ') || undefined;

  return (
    <span
      {...rest}
      ref={ref}
      data-ui="badge"
      className={rootClassName}
      css={[rootStyle, slotProps?.root?.css]}
    >
      {children}
      {!hidden && (
        <span
          data-ui="badge-marker"
          data-variant={variant}
          data-tone={tone}
          aria-hidden={isDot ? 'true' : undefined}
          className={slotProps?.badge?.className}
          css={[
            markerStyle,
            variantStyles[variant],
            !isDot && overlapStyles[overlap],
            anchorStyles[anchorKey],
            toneStyles[tone],
            slotProps?.badge?.css,
          ]}
        >
          {isDot ? null : content}
        </span>
      )}
    </span>
  );
});
