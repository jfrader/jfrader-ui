'use client';

import type { ComponentPropsWithRef, ComponentType } from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { PERSON_ART_COLORS } from '@jfrader/tokens';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { FORCED_COLORS } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { personAppearanceSignature, resolveAppearanceId, resolvePersonAppearance } from './appearance';
import { PersonArt } from './person-art';
import { resolvePersonKit, type PersonAvatarAttire, type PersonAvatarKit } from './kit';
export type { PersonAvatarAttire, PersonAvatarKit, PersonShirtPattern, PersonShortsPattern, PersonSocksPattern } from './kit';

export type PersonAvatarSize = 'sm' | 'md' | 'lg' | 'full';
export type PersonAvatarCrop = 'none' | 'circle';

export interface PersonAvatarSlots {
  /** Replaces the root with an adapter that forwards props and ref to one SVG. */
  root?: ComponentType<ComponentPropsWithRef<'svg'>>;
}

export interface PersonAvatarRootProps extends Omit<ComponentPropsWithRef<'svg'>,
  'children' | 'dangerouslySetInnerHTML' | 'viewBox' | 'preserveAspectRatio' | 'width' | 'height' |
  'role' | 'tabIndex' | 'focusable'> {
  css?: Interpolation<Theme>;
  [attribute: `data-${string}`]: string | number | boolean | undefined;
}

interface PersonAvatarBaseProps extends Omit<ComponentPropsWithRef<'svg'>,
  'children' | 'dangerouslySetInnerHTML' | 'viewBox' | 'preserveAspectRatio' | 'width' | 'height' |
  'role' | 'tabIndex' | 'focusable'>, SxProps {
  /** Selects physical traits. Empty strings are valid seeds. */
  seed: string;
  /** Uses this trimmed durable seed instead of `seed` unless blank. */
  appearanceId?: string;
  /** Clothing projection; staff ignores `kit` and `fullKit`. @default 'kit' */
  attire?: PersonAvatarAttire;
  /** Resolved garment colors and patterns. Takes precedence over simple colors in kit attire. */
  kit?: PersonAvatarKit;
  /** Simple shirt/socks color and staff tie accent. */
  primary?: string;
  /** Simple shorts and shirt accent color. */
  secondary?: string;
  /** Square viewport: 32px, 48px, 72px, or the containing frame with full. @default 'md' */
  size?: PersonAvatarSize;
  /** Accessible name. Omit for decorative artwork; an empty string forces decoration. */
  alt?: string;
  component?: PersonAvatarSlots['root'];
  slots?: PersonAvatarSlots;
  slotProps?: { root?: PersonAvatarRootProps };
}

export type PersonAvatarProps = PersonAvatarBaseProps & (
  | { fullKit: true; crop?: 'none' }
  | { fullKit?: false; crop?: PersonAvatarCrop }
);

const PERSON_AVATAR_FRAME = { portrait: '0 0 48 48', fullKit: '0 0 48 61' } as const;
const rootStyle = css({
  label: 'person-avatar',
  display: 'block',
  flex: '0 0 auto',
  imageRendering: 'pixelated',
  shapeRendering: 'crispEdges',
  forcedColorAdjust: 'none',
  [FORCED_COLORS]: { outline: '1px solid CanvasText' },
});
const sizeStyles = {
  sm: css({ inlineSize: vars.space[8], blockSize: vars.space[8] }),
  md: css({ inlineSize: vars.space[12], blockSize: vars.space[12] }),
  lg: css({ inlineSize: vars.size.personAvatarLg, blockSize: vars.size.personAvatarLg }),
  full: css({ inlineSize: '100%', blockSize: '100%' }),
};
const cropStyles = {
  none: css({ overflow: 'visible' }),
  circle: css({ borderRadius: vars.radius.full, overflow: 'hidden' }),
};

export function PersonAvatar({
  ref, seed, appearanceId, attire = 'kit', kit,
  primary = PERSON_ART_COLORS.staffJacket, secondary = PERSON_ART_COLORS.staffShirt,
  size = 'md', fullKit = false, crop = 'none', alt,
  component, slots, slotProps, className, style, sx, ...rest
}: PersonAvatarProps) {
  const { css: slotCss, className: slotClass, style: slotStyle, ref: slotRef, ...slotRest } = slotProps?.root ?? {};
  const merged = { ...rest, ...slotRest };
  const rootRef = useMergeRefs([ref, slotRef]);
  const Root = slots?.root ?? component ?? 'svg';
  const labelledBy = merged['aria-labelledby']?.trim() ? merged['aria-labelledby'] : undefined;
  const name = alt ?? merged['aria-label'];
  const decorative = merged['aria-hidden'] === true || merged['aria-hidden'] === 'true' || alt === '' ||
    (!labelledBy && !name?.trim());
  const visualId = resolveAppearanceId(seed, appearanceId);
  const appearance = resolvePersonAppearance(visualId);
  const resolvedKit = resolvePersonKit({ kit, primary, secondary });

  // Kit and role diagnostics stay app-owned: this renderer receives resolved presentation.
  return (
    <WithSx className={[slotClass, className].filter(Boolean).join(' ')}
      styles={[rootStyle, sizeStyles[size], cropStyles[crop], slotCss]} sx={sx}>
      {(rootClass) => (
        <Root {...merged} ref={rootRef} className={rootClass} style={{ ...style, ...slotStyle }}
          xmlns="http://www.w3.org/2000/svg"
          viewBox={fullKit && attire === 'kit' ? PERSON_AVATAR_FRAME.fullKit : PERSON_AVATAR_FRAME.portrait}
          preserveAspectRatio="xMidYMid meet" width={undefined} height={undefined}
          dangerouslySetInnerHTML={undefined} tabIndex={undefined} focusable={false}
          role={decorative ? undefined : 'img'} aria-hidden={decorative ? true : undefined}
          aria-labelledby={decorative ? undefined : labelledBy}
          aria-label={decorative || labelledBy ? undefined : name}
          data-ui="person-avatar"
          data-avatar-appearance-version={appearance.version}
          data-avatar-appearance-signature={personAppearanceSignature(appearance)}
          data-avatar-skin={appearance.skinTone} data-avatar-hair={appearance.hairStyle}
          data-avatar-hair-color={appearance.hairColor} data-avatar-facial-hair={appearance.facialHair}
          data-avatar-face={appearance.faceShape} data-avatar-brows={appearance.browStyle}
          data-avatar-eyes={appearance.eyeStyle} data-avatar-eye-color={appearance.eyeColor}
          data-avatar-nose={appearance.noseStyle} data-avatar-mouth={appearance.mouthStyle}
          data-avatar-accessory={appearance.accessory} data-avatar-marking={appearance.marking}>
          <PersonArt appearance={appearance} attire={attire} kit={resolvedKit} primary={primary} fullKit={fullKit} />
        </Root>
      )}
    </WithSx>
  );
}

PersonAvatar.displayName = 'PersonAvatar';
