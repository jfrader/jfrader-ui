// Overlay indicator anchored to a corner of its child (a count or a dot). No role: a standard
// marker's text follows the child in reading order, so assistive tech reads "child, count";
// the dot carries no text and is hidden from AT. Pass words in `badgeContent` when the number
// alone is ambiguous. Not interactive.
import type { ComponentPropsWithRef, ComponentType, ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type SerializedStyles, type Theme } from '../../styling/css';
import { FORCED_COLORS } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { isRenderable } from '../../utils/renderable';

export type BadgeVariant = 'standard' | 'dot';
export type BadgeTone = 'accent' | 'danger' | 'neutral';
export type BadgeOverlap = 'rectangular' | 'circular';
export type BadgeAnchor = { vertical?: 'top' | 'bottom'; horizontal?: 'start' | 'end' };

export interface BadgePartProps {
  className?: string;
  sx?: Interpolation<Theme>;
}

export interface BadgeSlots {
  /** Root container element wrapping the anchored child content. */
  root?: ComponentType<ComponentPropsWithRef<'span'>>;
  /** Badge marker element positioned over the anchored child. */
  badge?: ComponentType<ComponentPropsWithRef<'span'>>;
}

export interface BadgeProps extends ComponentPropsWithRef<'span'>, SxProps {
  /** Render the element the badge is positioned around. */
  children: ReactNode;
  /** Show content in the marker. Empty content hides a standard badge. */
  badgeContent?: ReactNode;
  /** Numbers above `max` render as `max+`. */
  max?: number;
  /** Shows the marker when `badgeContent` is 0. */
  showZero?: boolean;
  /** Hide the marker regardless of its content. Defaults to `false`. */
  invisible?: boolean;
  /** Show a content marker or a content-free dot. Defaults to `standard`. */
  variant?: BadgeVariant;
  /** Set the marker colour. Defaults to `accent`. */
  tone?: BadgeTone;
  /** Place the marker at a logical corner. Defaults to top-end. */
  anchor?: BadgeAnchor;
  /** Set standard marker corners to rounded or circular. Defaults to `rectangular`; dots stay round. */
  overlap?: BadgeOverlap;
  /** Replace the wrapper or marker element. */
  slots?: BadgeSlots;
  /** Pass props and `sx` to the wrapper and marker. */
  slotProps?: {
    /** Root container element wrapping the anchored child content. */
    root?: BadgePartProps;
    /** Badge marker element positioned over the anchored child. */
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
  [FORCED_COLORS]: {
    outline: '1px solid CanvasText',
    backgroundColor: 'Canvas',
  },
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
    [FORCED_COLORS]: {
      backgroundColor: 'CanvasText',
      forcedColorAdjust: 'none',
      outline: 'none',
    },
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

/**
 * The marker text never joins the wrapped control's accessible name.
 * - Control with an explicit `aria-label`: put the count in the label (`aria-label="Inbox, 3 unread"`).
 * - Control named by its visible text: the count is read right after the control's name.
 */
export function Badge({
  ref,
  children,
  badgeContent,
  max = DEFAULT_MAX,
  showZero = false,
  invisible = false,
  variant = 'standard',
  tone = 'accent',
  anchor,
  overlap = 'rectangular',
  slots,
  slotProps,
  className,
  sx,
  ...rest
}: BadgeProps) {
  const isDot = variant === 'dot';
  // Null, undefined, booleans and non-renderables never render a marker, even with showZero;
  // numeric zero hides unless showZero; dot never hides on content.
  const hidden =
    invisible ||
    (variant !== 'dot' && (!isRenderable(badgeContent) || (badgeContent === 0 && !showZero)));
  const content = typeof badgeContent === 'number' && badgeContent > max ? `${max}+` : badgeContent;
  const anchorKey: AnchorKey = `${anchor?.vertical ?? 'top'}-${anchor?.horizontal ?? 'end'}`;
  const rootClassName = [className, slotProps?.root?.className].filter(Boolean).join(' ') || undefined;
  const Root = slots?.root ?? 'span';
  const BadgeMarker = slots?.badge ?? 'span';

  return (
    <WithSx className={rootClassName} styles={[rootStyle, slotProps?.root?.sx]} sx={sx}>
      {(className) => (
        <Root {...rest} ref={ref} data-ui="badge" className={className}>
          {children}
          {!hidden && (
            <BadgeMarker
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
                slotProps?.badge?.sx,
              ]}
            >
              {isDot ? null : content}
            </BadgeMarker>
          )}
        </Root>
      )}
    </WithSx>
  );
}

Badge.displayName = 'Badge';
