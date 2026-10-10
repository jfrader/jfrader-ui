// Page-width wrapper: full inline size up to a max, centred with auto inline margins, with
// inline padding from the layout space scale. Layout only: a plain div with no role. Logical
// properties only, so it is direction-neutral.
import { forwardRef, type HTMLAttributes } from 'react';
import { css, type SerializedStyles } from '../../styling/css';
import { spaceStyles, type LayoutSpace } from '../../styling/layout-style';

export type ContainerSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  size?: ContainerSize;
  paddingInline?: LayoutSpace;
}

// Token candidates: @jfrader/tokens has no size scale yet. Move these there when one lands.
export const CONTAINER_MAX_INLINE_SIZE = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
} as const satisfies Record<ContainerSize, string>;

const rootStyle = css({
  boxSizing: 'border-box',
  inlineSize: '100%',
  marginInline: 'auto',
});

const sizeStyles: Record<ContainerSize, SerializedStyles> = {
  sm: css({ maxInlineSize: CONTAINER_MAX_INLINE_SIZE.sm }),
  md: css({ maxInlineSize: CONTAINER_MAX_INLINE_SIZE.md }),
  lg: css({ maxInlineSize: CONTAINER_MAX_INLINE_SIZE.lg }),
  xl: css({ maxInlineSize: CONTAINER_MAX_INLINE_SIZE.xl }),
};

const paddingStyles = spaceStyles('paddingInline');

export const Container = forwardRef<HTMLDivElement, ContainerProps>(function Container(
  { size = 'lg', paddingInline = 'md', ...rest },
  ref,
) {
  return (
    <div
      {...rest}
      ref={ref}
      data-ui="container"
      data-size={size}
      css={[rootStyle, sizeStyles[size], paddingStyles[paddingInline]]}
    />
  );
});
