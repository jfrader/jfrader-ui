'use client';

// Semantics: one `role="img"` root per avatar whose accessible name is the person's name, plus
// the status word when a status is set ("Ada Lovelace, online"). The photo, initials and status
// badge are presentational children of that root. Status uses shape and color for sighted users
// and text for AT; the name stays unchanged when a broken photo falls back to initials. Not interactive.
import { useState, type ComponentPropsWithRef, type ComponentType } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, keyframes, type Interpolation, type SerializedStyles, type Theme } from '../../styling/css';
import { withoutSx, WithSx, type SxProps } from '../../styling/sx';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { getInitials } from '../../utils/initials';
import { isRenderable } from '../../utils/renderable';

export type AvatarSize = 'sm' | 'md' | 'lg';
export type AvatarStatus = 'online' | 'away' | 'busy' | 'offline';

export interface AvatarPartProps {
  className?: string;
  sx?: Interpolation<Theme>;
}

export interface AvatarSlots {
  /** Image element displaying the avatar photo. */
  image?: ComponentType<ComponentPropsWithRef<'img'>>;
  /** Span element displaying fallback content when no image loads. */
  fallback?: ComponentType<ComponentPropsWithRef<'span'>>;
  /** Presence indicator dot reflecting online or busy status. */
  status?: ComponentType<ComponentPropsWithRef<'span'>>;
}

export interface AvatarProps
  extends Omit<ComponentPropsWithRef<'span'>, 'children' | 'role' | 'aria-label'>,
    SxProps {
  /** Used for the accessible name and the initials fallback. */
  name: string;
  /** Shown when src is missing or fails. Noninteractive content only; defaults to initials. */
  children?: ComponentPropsWithRef<'span'>['children'];
  /** Loads the avatar photo. Missing or failed images show the fallback. */
  src?: string;
  /** Sets the avatar diameter. Defaults to `'md'`. */
  size?: AvatarSize;
  /** Shows a presence badge and adds the status to the accessible name. Omit to hide the badge. */
  status?: AvatarStatus;
  /** Pulse the presence ring only when `status="online"`. Defaults to `false`. */
  pulse?: boolean;
  /** Spoken status word; defaults to the `status` value. Pass a translated word for other locales. */
  statusLabel?: string;
  /** Replaces the photo, fallback and presence badge elements. */
  slots?: AvatarSlots;
  /** Passes props and styles to the photo, fallback and presence badge. */
  slotProps?: {
    /** Image element displaying the avatar photo. */
    image?: AvatarPartProps & ComponentPropsWithRef<'img'>;
    /** Span element displaying fallback content when no image loads. */
    fallback?: AvatarPartProps & ComponentPropsWithRef<'span'>;
    /** Presence indicator dot reflecting online or busy status. */
    status?: AvatarPartProps & ComponentPropsWithRef<'span'>;
  };
}

const MAX_INITIALS = 2;

// Initials use `text` on `surfaceHover`: ~16:1 dark, ~18:1 light (WCAG AA needs 4.5:1).
const rootStyle = css({
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  boxSizing: 'border-box',
  borderRadius: vars.radius.full,
  backgroundColor: vars.color.surfaceHover,
  boxShadow: `inset 0 0 0 1px ${vars.color.borderControl}`,
  color: vars.color.text,
  fontWeight: vars.fontWeight.medium,
  lineHeight: 1,
  userSelect: 'none',
  verticalAlign: 'middle',
  [FORCED_COLORS]: {
    outline: '1px solid CanvasText',
  },
});

const sizeStyles: Record<AvatarSize, SerializedStyles> = {
  sm: css({ inlineSize: vars.space[6], blockSize: vars.space[6], fontSize: vars.textSize.xs }),
  md: css({ inlineSize: vars.space[8], blockSize: vars.space[8], fontSize: vars.textSize.sm }),
  lg: css({ inlineSize: vars.space[10], blockSize: vars.space[10], fontSize: vars.textSize.md }),
};

const imageStyle = css({
  display: 'block',
  inlineSize: '100%',
  blockSize: '100%',
  borderRadius: vars.radius.full,
  objectFit: 'cover',
});

const fallbackStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  inlineSize: '100%',
  blockSize: '100%',
  borderRadius: vars.radius.full,
  overflow: 'hidden',
});

// The page-colored outline separates each shape from the photo; it is not the state cue.
const statusStyle = css({
  position: 'absolute',
  insetBlockEnd: 0,
  insetInlineEnd: 0,
  inlineSize: '25%',
  blockSize: '25%',
  // Let clicks and hover pass through the decorative dot and expanding ring.
  pointerEvents: 'none',
  '&::before': {
    content: '""',
    position: 'absolute',
    insetBlockStart: 0,
    insetInlineStart: 0,
    inlineSize: '100%',
    blockSize: '100%',
    boxSizing: 'border-box',
    borderRadius: vars.radius.full,
    boxShadow: `0 0 0 2px ${vars.color.bg}`,
  },
});

const statusToneStyles: Record<AvatarStatus, SerializedStyles> = {
  online: css({ '&::before': { backgroundColor: vars.color.success } }),
  away: css({ '&::before': { border: `2px solid ${vars.color.warning}`, backgroundColor: 'transparent' } }),
  busy: css({ '&::before': { backgroundColor: vars.color.danger, blockSize: '30%', insetBlockStart: '35%' } }),
  offline: css({
    '&::before': {
      backgroundColor: vars.color.textSubtle,
      inlineSize: '60%',
      blockSize: '60%',
      insetBlockStart: '20%',
      insetInlineStart: '20%',
    },
  }),
};

const statusForcedColorsStyle = css({
  [FORCED_COLORS]: {
    '&::before': {
      forcedColorAdjust: 'none',
      backgroundColor: 'CanvasText',
      outline: '2px solid Canvas',
    },
    '&[data-status="away"]::before': {
      borderColor: 'CanvasText',
      backgroundColor: 'Canvas',
    },
  },
});

const presenceRipple = keyframes({
  from: { transform: 'scale(.8)', opacity: 1 },
  to: { transform: 'scale(2.4)', opacity: 0 },
});

const hiddenPresenceRing = {
  '&[data-status="online"][data-pulse]::after': {
    content: 'none',
    display: 'none',
    animation: 'none',
  },
} as const;

const statusPulseStyle = css({
  '&[data-status="online"][data-pulse]::after': {
    content: '""',
    position: 'absolute',
    boxSizing: 'border-box',
    insetBlockStart: 0,
    insetInlineStart: 0,
    inlineSize: '100%',
    blockSize: '100%',
    borderRadius: vars.radius.full,
    color: vars.color.success,
    border: '1px solid currentColor',
    animation: `${presenceRipple} ${vars.motion.duration.presence} infinite ${vars.motion.easePresence}`,
  },
  [REDUCED_MOTION]: hiddenPresenceRing,
  [FORCED_COLORS]: hiddenPresenceRing,
});

export function Avatar({
  ref,
  name,
  children,
  src,
  size = 'md',
  status,
  pulse = false,
  statusLabel,
  slots,
  slotProps,
  className,
  sx,
  ...rest
}: AvatarProps) {
  // Keyed by URL so a new `src` gets a fresh attempt without an effect.
  // A failed URL stays suppressed when revisited after success → failure → same-URL cycles.
  const [failedSrc, setFailedSrc] = useState<string>();
  const showImage = src !== undefined && src !== '' && src !== failedSrc;
  const label = status === undefined ? name : `${name}, ${statusLabel ?? status}`;
  const Image = slots?.image ?? 'img';
  const Fallback = slots?.fallback ?? 'span';
  const Status = slots?.status ?? 'span';

  return (
    <WithSx className={className} styles={[rootStyle, sizeStyles[size]]} sx={sx}>
      {(className) => (
        <span {...rest} ref={ref} data-ui="avatar" role="img" aria-label={label} className={className}>
          {showImage ? (
            <Image
              {...withoutSx(slotProps?.image)}
              src={src}
              alt=""
              role={undefined}
              aria-hidden="true"
              aria-label={undefined}
              aria-labelledby={undefined}
              children={undefined}
              dangerouslySetInnerHTML={undefined}
              onError={(event) => {
                setFailedSrc(src);
                slotProps?.image?.onError?.(event);
              }}
              data-ui="avatar-image"
              className={slotProps?.image?.className}
              css={[imageStyle, slotProps?.image?.sx]}
            />
          ) : (
            <Fallback {...withoutSx(slotProps?.fallback)} role={undefined} aria-label={undefined} aria-labelledby={undefined}
              dangerouslySetInnerHTML={undefined} aria-hidden="true" data-ui="avatar-fallback"
              className={slotProps?.fallback?.className} css={[fallbackStyle, slotProps?.fallback?.sx]}>
              {isRenderable(children) ? children : getInitials(name, MAX_INITIALS)}
            </Fallback>
          )}
          {status !== undefined && (
            <Status
              {...withoutSx(slotProps?.status)}
              role={undefined}
              aria-label={undefined}
              aria-labelledby={undefined}
              children={undefined}
              dangerouslySetInnerHTML={undefined}
              aria-hidden="true"
              data-ui="avatar-status"
              data-status={status}
              data-pulse={pulse && status === 'online' ? '' : undefined}
              className={slotProps?.status?.className}
              css={[statusStyle, statusToneStyles[status], statusForcedColorsStyle, statusPulseStyle, slotProps?.status?.sx]}
            />
          )}
        </span>
      )}
    </WithSx>
  );
}

Avatar.displayName = 'Avatar';
