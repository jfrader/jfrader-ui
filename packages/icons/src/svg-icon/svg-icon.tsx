import { useCallback, type ComponentPropsWithRef, type ComponentType, type ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, WithSx, type SerializedStyles, type SxProps } from '@jfrader/styling';

export type SvgIconVariant = 'line' | 'solid';
export type SvgIconSize = 'sm' | 'md' | 'lg' | 'inherit' | number;
export type SvgIconTone = 'inherit' | 'accent' | 'danger' | 'warning' | 'success' | 'info' | 'muted';
export type SvgIconRootProps = ComponentPropsWithRef<'svg'> & SxProps & { 'data-ui'?: string };
export type SvgIconTitleProps = ComponentPropsWithRef<'title'> & SxProps;

export interface SvgIconSlots {
  /** Replace the SVG with a component forwarding every received prop and ref to one `svg`. */
  root?: ComponentType<ComponentPropsWithRef<'svg'>>;
  /** Replace the accessible title with a component forwarding props and ref to one SVG `title`. */
  title?: ComponentType<ComponentPropsWithRef<'title'>>;
}

export interface SvgIconSlotProps {
  /** Pass native attributes, ref, and `sx` to the SVG root. Conflicts win over root attributes. */
  root?: SvgIconRootProps;
  /** Pass native attributes, ref, and `sx` to the generated SVG title. */
  title?: SvgIconTitleProps;
}

export interface SvgIconProps extends Omit<ComponentPropsWithRef<'svg'>, 'children' | 'color'>, SxProps {
  /** Draw the icon with SVG children. */
  children: ReactNode;
  /** Choose rounded strokes or a filled silhouette. Defaults to `line`. */
  variant?: SvgIconVariant;
  /** Set line weight in viewBox units. Applies only to `line`. Defaults to `1.5`. */
  strokeWidth?: number;
  /** Set 16px (`sm`), 24px (`md`), 32px (`lg`), `1em` (`inherit`), or positive finite pixels. Invalid numbers use `md`. Defaults to `md`. */
  size?: SvgIconSize;
  /** Set a semantic token color, or inherit the surrounding color. Defaults to `inherit`. */
  tone?: SvgIconTone;
  /** Name the image with `aria-label` and a generated SVG title. Without a label the icon is hidden from assistive technology. */
  label?: string;
  /** Hide the icon from assistive technology and omit its title, even with a label. Defaults to `false`. */
  decorative?: boolean;
  /** Set the drawing grid. Defaults to `0 0 24 24` unless `inheritViewBox` is true. */
  viewBox?: string;
  /** Skip the default viewBox and all variant paint attributes (fill, stroke, stroke width, caps, and joins). Keep an explicit viewBox and native paint attributes. Size, tone, layout, accessibility, slots, and `sx` still apply. Does not inspect or clone children. Defaults to `false`. */
  inheritViewBox?: boolean;
  /** Replace the SVG root; `slots.root` takes precedence. Declare replacements outside render and forward all props and ref. */
  component?: SvgIconSlots['root'];
  /** Replace the root or generated title. */
  slots?: SvgIconSlots;
  /** Pass native props and `sx` to each replaceable part. */
  slotProps?: SvgIconSlotProps;
  /** Append whitespace-separated markers while retaining `svg-icon`, with duplicates removed. */
  'data-ui'?: string;
}

const rootStyle = css({
  label: 'svg-icon',
  display: 'inline-block',
  verticalAlign: 'middle',
  flexShrink: 0,
});
const sizeStyles: Record<Exclude<SvgIconSize, number>, SerializedStyles> = {
  sm: css({ inlineSize: vars.space[4], blockSize: vars.space[4] }),
  md: css({ inlineSize: vars.space[6], blockSize: vars.space[6] }),
  lg: css({ inlineSize: vars.space[8], blockSize: vars.space[8] }),
  inherit: css({ inlineSize: '1em', blockSize: '1em' }),
};
const toneStyles: Record<SvgIconTone, SerializedStyles> = {
  inherit: css({ color: 'inherit' }),
  accent: css({ color: vars.color.accentText }),
  danger: css({ color: vars.color.dangerText }),
  warning: css({ color: vars.color.warning }),
  success: css({ color: vars.color.success }),
  info: css({ color: vars.color.info }),
  muted: css({ color: vars.color.textMuted }),
};

/** Draw an SVG icon with shared sizing, paint, and accessible naming. */
export function SvgIcon({
  ref,
  children,
  variant = 'line',
  strokeWidth = 1.5,
  size = 'md',
  tone = 'inherit',
  label,
  decorative = false,
  viewBox,
  inheritViewBox = false,
  component,
  slots,
  slotProps,
  className,
  sx,
  style,
  ...rest
}: SvgIconProps) {
  const {
    sx: rootSx,
    className: rootClassName,
    style: rootStyleProp,
    ref: rootRef,
    ...rootProps
  } = slotProps?.root ?? {};
  const { sx: titleSx, className: titleClassName, ...titleProps } = slotProps?.title ?? {};
  const mergedRef = useCallback(
    (node: SVGSVGElement | null) => {
      for (const target of [ref, rootRef]) {
        if (typeof target === 'function') target(node);
        else if (target) target.current = node;
      }
    },
    [ref, rootRef],
  );
  const Root = slots?.root ?? component ?? 'svg';
  const Title = slots?.title ?? 'title';
  const named = !decorative && label !== undefined;
  const numericSize =
    typeof size === 'number' && Number.isFinite(size) && size > 0 ? size : undefined;
  const marker = [
    ...new Set([
      'svg-icon',
      ...[rest['data-ui'], rootProps['data-ui']].flatMap(
        (value) => value?.split(/\s+/).filter(Boolean) ?? [],
      ),
    ]),
  ].join(' ');
  return (
    <WithSx
      className={[className, rootClassName].filter(Boolean).join(' ')}
      styles={[rootStyle, sizeStyles[typeof size === 'number' ? 'md' : size], toneStyles[tone], rootSx]}
      sx={sx}
    >
      {(className) => (
        <Root
          viewBox={viewBox ?? (inheritViewBox ? undefined : '0 0 24 24')}
          fill={inheritViewBox ? undefined : variant === 'line' ? 'none' : 'currentColor'}
          stroke={inheritViewBox || variant === 'solid' ? undefined : 'currentColor'}
          strokeWidth={inheritViewBox || variant === 'solid' ? undefined : strokeWidth}
          strokeLinecap={inheritViewBox || variant === 'solid' ? undefined : 'round'}
          strokeLinejoin={inheritViewBox || variant === 'solid' ? undefined : 'round'}
          {...rest}
          {...rootProps}
          ref={mergedRef}
          className={className}
          style={{
            ...(numericSize === undefined ? undefined : { inlineSize: numericSize, blockSize: numericSize }),
            ...style,
            ...rootStyleProp,
          }}
          data-ui={marker}
          role={named ? 'img' : undefined}
          aria-label={named ? label : undefined}
          aria-hidden={named ? undefined : true}
          focusable="false"
        >
          {named && (
            <WithSx className={titleClassName} sx={titleSx}>
              {(className) => <Title {...titleProps} className={className}>{label}</Title>}
            </WithSx>
          )}
          {children}
        </Root>
      )}
    </WithSx>
  );
}
SvgIcon.displayName = 'SvgIcon';

export type CreatedSvgIconProps = Omit<SvgIconProps, 'children'> & {
  /** Replace the factory's drawing. Omitted children retain its original drawing. */
  children?: ReactNode;
};

/**
 * Create an icon once at module scope. Pass a public display name, such as `Icons.Search`, and any
 * `SvgIcon` prop the component should bake in, such as `{ variant: 'solid' }` for a filled twin or
 * `{ inheritViewBox: true, viewBox: '0 0 512 512' }` for a mark on its own grid. Baked props stay
 * overridable at render time.
 */
export function createSvgIcon(
  children: ReactNode,
  displayName: string,
  defaults?: Omit<CreatedSvgIconProps, 'children'>,
) {
  function Icon(props: CreatedSvgIconProps) {
    return <SvgIcon {...defaults} {...props} children={props.children === undefined ? children : props.children} />;
  }
  Icon.displayName = displayName;
  return Icon;
}
