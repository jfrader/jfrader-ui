'use client';

// Semantics: one `role="img"` root per emblem, named by `name`; the plate, its pattern and the
// monogram are presentational children of that root. The component renders no interactive element
// of its own — the `render` path hands its props to a consumer element (usually an `<a>`), so a
// linked emblem stays one focusable node with one accessible name.
import {
  useState,
  type ComponentPropsWithRef,
  type ComponentType,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  type RefCallback,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type SerializedStyles, type Theme } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { getInitials } from '../../utils/initials';

export type EmblemShape = 'shield' | 'circle' | 'squircle' | 'hexagon';
export type EmblemSize = 'sm' | 'md' | 'lg' | 'xl';
export type EmblemPattern = 'none' | 'stripes' | 'hoops' | 'sash';

export interface EmblemPartProps {
  className?: string;
  sx?: Interpolation<Theme>;
}

/** Props the `render` callback spreads onto the element it returns. */
export interface EmblemRenderProps extends Omit<HTMLAttributes<HTMLElement>, 'color'> {
  ref: RefCallback<HTMLElement> | null;
  'data-ui': string;
  'data-shape': EmblemShape;
  'data-pattern': EmblemPattern;
  style: CSSProperties;
  children: ReactNode;
}

export interface EmblemSlots {
  /** Image element displaying the crest artwork. */
  image?: ComponentType<ComponentPropsWithRef<'img'>>;
  /** Span element displaying initials when no crest image is provided. */
  monogram?: ComponentType<ComponentPropsWithRef<'span'>>;
}

export interface EmblemProps
  extends Omit<ComponentPropsWithRef<'span'>, 'children' | 'role' | 'aria-label' | 'color'>,
    SxProps {
  /** Accessible name, and the words the monogram is built from. */
  name: string;
  /** Replaces the initials derived from `name`. Three characters fill a plate. */
  initials?: string;
  /** Crest image, drawn to the plate's shape. The monogram stands in while it is missing or broken. */
  src?: string;
  /** Fill color. The highlight, the pattern and the default ink derive from it. */
  color?: string;
  /**
   * Pattern color. Defaults to a lighter tint of `color`; keep it near the fill's lightness, or the
   * monogram loses its contrast over the bands.
   */
  secondaryColor?: string;
  /** Ink color over the fill. Defaults to the fill's own contrast color. */
  inkColor?: string;
  /** Plate outline. `shield` keeps the crest geometry this component came from. */
  shape?: EmblemShape;
  /** Plate side: `sm` 24px, `md` 32px, `lg` 40px, `xl` 56px. */
  size?: EmblemSize;
  /** Pattern over the fill. `none` leaves the plain gradient. */
  pattern?: EmblemPattern;
  /** Replace the crest image or fallback monogram element. */
  slots?: EmblemSlots;
  /** Style the crest image or fallback monogram. */
  slotProps?: {
    /** Image element displaying the crest artwork. */
    image?: EmblemPartProps;
    /** Span element displaying initials when no crest image is provided. */
    monogram?: EmblemPartProps;
  };
  /**
   * Replaces the root `<span>` with the returned element, for a linked emblem. Spread every
   * supplied prop onto it and attach the supplied ref. The accessible name is `name`, followed by
   * the monogram while it stands in for an image, because a link's visible text belongs in its
   * name (WCAG 2.5.3). Pass your own `aria-label` after the spread to describe the destination,
   * and keep the monogram in it.
   */
  render?: (props: EmblemRenderProps) => ReactNode;
}

const MAX_INITIALS = 3;
const FULL_SIZE_INITIALS = 2;
const MONOGRAM_FONT_RATIO = 0.5;
const MONOGRAM_WIDTH_RATIO = 0.85;
const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const PLATE = '[data-ui="emblem-plate"]';
/** The crest geometry, 8 units wide for every 7 of height. */
const SHIELD_PATH = 'polygon(50% 0, 91% 16%, 84% 73%, 50% 100%, 16% 73%, 9% 16%)';
const HEXAGON_PATH = 'polygon(50% 0, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)';
/** One OKLCH step up for the gradient's light end, which is also the ink's contrast baseline. */
const HIGHLIGHT_STEP = '0.12';
/** Chroma kept at that end: less neon than raising lightness alone. */
const HIGHLIGHT_CHROMA = '0.85';
const SUPPORTS_DERIVED_COLORS = '@supports (color: oklch(from red l c h))';
const SUPPORTS_CONTRAST_INK = '@supports (color: contrast-color(red))';

const rootStyle = css({
  '--emblem-fill': vars.color.accent,
  // Flat fill, then the derived highlight; both are read by the plate's background.
  '--emblem-highlight': 'var(--emblem-fill)',
  '--emblem-secondary': 'var(--emblem-highlight)',
  '--emblem-pattern': 'none',
  '--emblem-shadow': `drop-shadow(${vars.shadow.raised})`,
  '--emblem-brightness': '1',
  position: 'relative',
  display: 'inline-block',
  flexShrink: 0,
  inlineSize: 'var(--emblem-size)',
  blockSize: 'var(--emblem-size)',
  fontSize: 'var(--emblem-size)',
  verticalAlign: 'middle',
  userSelect: 'none',
  filter: 'var(--emblem-shadow) brightness(var(--emblem-brightness))',
  [SUPPORTS_DERIVED_COLORS]: {
    '--emblem-highlight': `oklch(from var(--emblem-fill) calc(l + ${HIGHLIGHT_STEP}) calc(c * ${HIGHLIGHT_CHROMA}) h)`,
  },
  [FORCED_COLORS]: { filter: 'none' },
});

const plateStyle = css({
  position: 'absolute',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  overflow: 'hidden',
  backgroundImage:
    'var(--emblem-pattern), linear-gradient(135deg, var(--emblem-highlight), var(--emblem-fill))',
  [FORCED_COLORS]: {
    forcedColorAdjust: 'none',
    backgroundImage: 'none',
    backgroundColor: 'CanvasText',
  },
  // Hairline inset that keeps the plate's radius and clips to its shape.
  '&::after': {
    content: '""',
    position: 'absolute',
    inset: '10% 12% 14%',
    border: `1px solid color-mix(in srgb, var(--emblem-secondary) 42%, transparent)`,
    borderRadius: 'inherit',
    clipPath: 'inherit',
  },
});

const monogramStyle = css({
  position: 'relative',
  maxInlineSize: '100%',
  overflow: 'hidden',
  fontFamily: vars.font.sans,
  fontSize: 'calc(1em * var(--emblem-monogram-scale))',
  fontWeight: vars.fontWeight.semibold,
  letterSpacing: '-0.03em',
  lineHeight: 1,
  whiteSpace: 'nowrap',
});

// The fill's contrast color, resolved against the gradient's light end. Engines without
// contrast-color() keep the accent pair, which is the pair the default fill ships with.
const inkStyle = css({
  color: `var(--emblem-ink, ${vars.color.accentContrast})`,
  [SUPPORTS_CONTRAST_INK]: {
    color: 'var(--emblem-ink, contrast-color(var(--emblem-highlight)))',
  },
  [FORCED_COLORS]: { color: 'Canvas' },
});

const imageStyle = css({
  display: 'block',
  inlineSize: '100%',
  blockSize: '100%',
  objectFit: 'cover',
});

const sizeStyles: Record<EmblemSize, SerializedStyles> = {
  sm: css({ '--emblem-size': vars.size.emblemSm }),
  md: css({ '--emblem-size': vars.size.emblemMd }),
  lg: css({ '--emblem-size': vars.size.emblemLg }),
  xl: css({ '--emblem-size': vars.size.emblemXl }),
};

const shapeStyles: Record<EmblemShape, SerializedStyles> = {
  shield: css({
    blockSize: 'calc(var(--emblem-size) * 8 / 7)',
    [`& > ${PLATE}`]: { clipPath: SHIELD_PATH },
  }),
  circle: css({ [`& > ${PLATE}`]: { borderRadius: vars.radius.full } }),
  squircle: css({ [`& > ${PLATE}`]: { borderRadius: '30%' } }),
  hexagon: css({ [`& > ${PLATE}`]: { clipPath: HEXAGON_PATH } }),
};

const patternStyles: Record<EmblemPattern, SerializedStyles> = {
  none: css({ '--emblem-pattern': 'none' }),
  stripes: css({
    '--emblem-pattern':
      'repeating-linear-gradient(to right, var(--emblem-secondary) 0 10%, transparent 10% 20%)',
  }),
  hoops: css({
    '--emblem-pattern':
      'repeating-linear-gradient(to bottom, var(--emblem-secondary) 0 12%, transparent 12% 24%)',
  }),
  // A bend, mirrored with the reading direction.
  sash: css({
    '--emblem-pattern':
      'linear-gradient(135deg, transparent 34%, var(--emblem-secondary) 34% 62%, transparent 62%)',
    '&:dir(rtl)': {
      '--emblem-pattern':
        'linear-gradient(225deg, transparent 34%, var(--emblem-secondary) 34% 62%, transparent 62%)',
    },
  }),
};

/** Only the `render` path gets hover and focus affordances; a plain emblem is not interactive. */
const interactiveStyle = css({
  cursor: 'pointer',
  textDecoration: 'none',
  transitionProperty: 'filter, transform',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '&:hover': {
    '--emblem-brightness': '1.08',
    transform: 'translateY(-1px)',
  },
  '&:focus-visible': {
    ...focusRingOutset,
  },
  [REDUCED_MOTION]: {
    transitionDuration: '0s',
  },
});

export function Emblem({
  ref,
  name,
  initials,
  src,
  color,
  secondaryColor,
  inkColor,
  shape = 'shield',
  size = 'md',
  pattern = 'none',
  slots,
  slotProps,
  className,
  style,
  sx,
  render,
  ...rest
}: EmblemProps) {
  const Image = slots?.image ?? 'img';
  const Monogram = slots?.monogram ?? 'span';
  // Keyed by URL so a new `src` gets a fresh attempt without an effect.
  const [failedSrc, setFailedSrc] = useState<string>();
  const renderRef = useMergeRefs<HTMLElement>([ref]);
  const showImage = src !== undefined && src !== '' && src !== failedSrc;

  const styles: Interpolation<Theme>[] = [rootStyle, sizeStyles[size], shapeStyles[shape], patternStyles[pattern]];
  if (render !== undefined) styles.push(interactiveStyle);

  const monogram = initials ?? getInitials(name, MAX_INITIALS);
  // WCAG 2.5.3: a link's visible text belongs in its accessible name, and the monogram is text on
  // screen. An image shows no text, so it needs the name alone.
  const renderLabel = showImage ? name : `${name} — ${monogram}`;

  const initialCount = Array.from(graphemes.segment(monogram)).length;
  const monogramScale = initialCount > FULL_SIZE_INITIALS ? MONOGRAM_WIDTH_RATIO / initialCount : MONOGRAM_FONT_RATIO;
  const customProperties: Record<string, string> = { '--emblem-monogram-scale': String(monogramScale) };
  if (color !== undefined) customProperties['--emblem-fill'] = color;
  if (secondaryColor !== undefined) customProperties['--emblem-secondary'] = secondaryColor;
  if (inkColor !== undefined) customProperties['--emblem-ink'] = inkColor;
  const colorStyle = { ...customProperties, ...style } as CSSProperties;

  const content = (
    <span data-ui="emblem-plate" aria-hidden="true" css={plateStyle}>
      {showImage ? (
        <Image
          src={src}
          alt=""
          onError={() => setFailedSrc(src)}
          className={slotProps?.image?.className}
          css={[imageStyle, slotProps?.image?.sx]}
        />
      ) : (
        <Monogram
          data-ui="emblem-ink"
          aria-hidden="true"
          className={slotProps?.monogram?.className}
          css={[monogramStyle, inkStyle, slotProps?.monogram?.sx]}
        >
          {monogram}
        </Monogram>
      )}
    </span>
  );

  if (render) {
    return (
      <WithSx className={className} styles={styles} sx={sx}>
        {(rootClass) =>
          render({
            ...rest,
            className: rootClass,
            ref: renderRef,
            style: colorStyle,
            'data-ui': 'emblem',
            'data-shape': shape,
            'data-pattern': pattern,
            'aria-label': renderLabel,
            children: content,
          })
        }
      </WithSx>
    );
  }

  return (
    <WithSx className={className} styles={styles} sx={sx}>
      {(rootClass) => (
        <span
          {...rest}
          ref={ref}
          role="img"
          aria-label={name}
          data-ui="emblem"
          data-shape={shape}
          data-pattern={pattern}
          className={rootClass}
          style={colorStyle}
        >
          {content}
        </span>
      )}
    </WithSx>
  );
}

Emblem.displayName = 'Emblem';
