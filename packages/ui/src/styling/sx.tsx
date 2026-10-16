// `sx` is the MUI-style spelling of the consumer `css` override. It cannot simply join a part's
// `css` array: Emotion's JSX turns a consumer's `css` prop into a class in `className` before the
// component renders, and Emotion merges `className` classes after an element's own `css`, so an
// `sx` inside that array would lose to `css`. WithSx resolves `sx` into its own class (theme
// callbacks included), appends it after `className`, and merges own styles → `css` → `sx` into
// the single class it hands to the part's element.
import type { ReactNode } from 'react';
import { ClassNames, type ClassNamesContent, type Interpolation, type Theme } from './css';

export interface SxProps {
  /** Style overrides. Accepts the same values as `css` and applies after it. */
  sx?: Interpolation<Theme>;
}

export interface SlotCss {
  css?: Interpolation<Theme>;
}

interface ClassNameProps {
  className?: string;
  children: (className: string | undefined) => ReactNode;
}

const isInterpolationArray = (styles: Interpolation<Theme>): styles is readonly Interpolation<Theme>[] =>
  Array.isArray(styles);

// ClassNames' css helper does not evaluate theme callbacks, including those nested in arrays.
function resolveTheme(styles: Interpolation<Theme>, theme: Theme): Parameters<ClassNamesContent['css']>[0] {
  if (typeof styles === 'function') return resolveTheme(styles(theme), theme);
  if (isInterpolationArray(styles)) return styles.map((style) => resolveTheme(style, theme));
  return styles;
}

// Keep ClassNames mounted: adding/removing a JSX css prop would swap Emotion's wrapper type.
function ResolvedClassName({ className, styles, children }: ClassNameProps & { styles?: Interpolation<Theme> }) {
  return (
    <ClassNames>
      {({ css, cx, theme }) =>
        children(styles === undefined ? className : cx(css(resolveTheme(styles, theme)), className))
      }
    </ClassNames>
  );
}

interface WithSxProps extends SxProps, ClassNameProps {
  /** The part's own styles, merged first. */
  styles?: Interpolation<Theme>;
}

export function WithSx({ className, styles, sx, children }: WithSxProps) {
  // Both layers always render, so toggling `sx` never remounts the part.
  return (
    <ResolvedClassName styles={sx}>
      {(sxClassName) => (
        <ResolvedClassName
          className={sx === undefined ? className : [className, sxClassName].filter(Boolean).join(' ')}
          styles={styles}
        >
          {children}
        </ResolvedClassName>
      )}
    </ResolvedClassName>
  );
}
