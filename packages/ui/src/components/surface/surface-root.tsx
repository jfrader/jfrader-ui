'use client';

import {
  createElement, useEffect, useRef,
  type ComponentPropsWithRef, type ComponentType, type CSSProperties,
  type ReactNode, type Ref, type RefObject,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { FORCED_COLORS } from '../../styling/media';
import { raisedSurface, surfaceTheme, type SurfaceAppearance } from '../../styling/surface';
import {
  AppearanceScope,
  themeColorSchemeStyle,
  useSurfaceAppearance,
  useSurfaceStyle,
  useThemeScope,
} from '../../styling/theme-scope';
import { WithSx } from '../../styling/sx';
import type { SurfacePartProps, SurfaceProps, SurfaceVariant } from './surface';
import type { PresentationProps } from '../../utils/presentation-slot';

declare const process: { env: { NODE_ENV?: string } };

const material = css({ ...raisedSurface, borderRadius: vars.radius.lg });
const shadows = {
  flat: css({ boxShadow: 'none' }),
  raised: css({ boxShadow: vars.shadow.raised }),
  floating: css({ boxShadow: vars.shadow.floating }),
};
const forcedColors = css({ [FORCED_COLORS]: { boxShadow: 'none', borderColor: 'CanvasText' } });
const appearances = ['default', 'contrast'] as const;

export function resolveSurfaceValue<T extends string>(
  owner: string,
  name: string,
  value: T | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  if (value === undefined || allowed.includes(value)) return value ?? fallback;
  if (process.env.NODE_ENV !== 'production') console.warn(`${owner}: invalid ${name}. Using ${fallback}.`);
  return fallback;
}

function tokens(...values: unknown[]) {
  return [...new Set(values.flatMap((value) => typeof value === 'string' ? value.split(/\s+/).filter(Boolean) : []))].join(' ');
}

type SurfaceElement = 'div' | 'section' | 'figure';
type NativeSurfaceProps<T extends SurfaceElement> = ComponentPropsWithRef<T> & {
  'data-ui'?: string;
  'data-theme'?: 'dark' | 'light';
  'data-appearance'?: SurfaceAppearance;
  [attribute: `data-${string}`]: string | number | boolean | undefined;
};
type SurfaceRootProps<T extends SurfaceElement> = Omit<
  SurfaceProps,
  keyof ComponentPropsWithRef<'div'> | 'component' | 'slots' | 'slotProps'
> & NativeSurfaceProps<T> & {
  element?: T;
  component?: ComponentType<NativeSurfaceProps<T>>;
  slots?: { root?: ComponentType<NativeSurfaceProps<T>> };
  slotProps?: { root?: PresentationProps<T> };
  owner: string;
  marker: string;
  variant: SurfaceVariant;
  structure?: Interpolation<Theme>;
  materialStyle?: Interpolation<Theme>;
  attributes?: SurfacePartProps;
  wrapChildren?: (children: ReactNode) => ReactNode;
  internalRef?: Ref<HTMLElementTagNameMap[T]>;
  containerRef?: RefObject<HTMLElement | null>;
  defaultAppearance?: SurfaceAppearance;
  reservedStyle?: CSSProperties;
  reservedStyleKeys?: readonly string[];
};

export function SurfaceRoot<T extends SurfaceElement = 'div'>({
  element,
  owner,
  marker,
  variant,
  structure,
  materialStyle,
  attributes,
  wrapChildren,
  internalRef,
  containerRef,
  defaultAppearance = 'default',
  reservedStyle,
  reservedStyleKeys,
  appearance: appearanceProp,
  component,
  slots,
  slotProps,
  sx,
  className,
  style,
  ...host
}: SurfaceRootProps<T>) {
  const appearance = resolveSurfaceValue(owner, 'appearance', appearanceProp, appearances, defaultAppearance);
  const effectiveAppearance = useSurfaceAppearance(appearance);
  const parent = useThemeScope();
  const ownTheme = surfaceTheme(appearance);
  const slot = slotProps?.root;
  const { sx: slotCss, className: slotClassName, style: slotStyle, ...slotRest } = slot ?? {};
  const merged = { ...host, ...slotRest };
  for (const key of ['aria-labelledby', 'aria-describedby'] as const) {
    merged[key] = tokens(host[key], slot?.[key]) || undefined;
  }
  const declaredTheme = ownTheme ?? (merged['data-theme'] === parent?.theme ? merged['data-theme'] : undefined);
  const declaredAppearance = ownTheme || merged['data-appearance'] === effectiveAppearance
    ? effectiveAppearance
    : undefined;
  const mergedStyle = { ...style, ...slotStyle };
  const consumerStyle = reservedStyleKeys
    ? Object.fromEntries(Object.entries(mergedStyle).filter(([key]) => !reservedStyleKeys.includes(key)))
    : mergedStyle;
  const rootStyle = useSurfaceStyle(declaredTheme ?? null, { ...consumerStyle, ...reservedStyle });
  const nativeElement = element ?? 'div';
  const Root = slots?.root ?? component ?? nativeElement;
  const previousRoot = useRef(Root);
  const node = useRef<HTMLElementTagNameMap[T]>(null);
  const ref = useMergeRefs([node, internalRef, merged.ref]);

  if (process.env.NODE_ENV !== 'production') {
    if (previousRoot.current !== Root) {
      console.warn(
        `${owner}: root component identity changed (component/slots.root). Inline component functions remount the panel and reset focus and form state. Declare the component outside render.`,
      );
    }
    if (component && slots?.root && component !== slots.root) {
      console.warn(`${owner}: component is redundant when slots.root is supplied; slots.root wins.`);
    }
  }
  useEffect(() => {
    previousRoot.current = Root;
    if (process.env.NODE_ENV !== 'production') {
      if (!node.current || node.current.localName !== nativeElement) {
        console.warn(nativeElement === 'div'
          ? `${owner}: root must forward its ref to one HTMLDivElement. Missing or non-div root registration.`
          : `${owner}: root must forward its ref to one ${nativeElement} element. Missing or mismatched root registration.`);
      } else if (containerRef && !containerRef.current?.contains(node.current)) {
        console.warn(`${owner}: root must remain inside its owning shell or stage.`);
      }
    }
  });

  return (
    <AppearanceScope theme={ownTheme} appearance={effectiveAppearance}>
      <WithSx
        styles={[
          Root === nativeElement && [material, shadows[variant], materialStyle, forcedColors],
          declaredTheme && themeColorSchemeStyle,
          structure,
          slotCss,
        ]}
        className={slotClassName}
      >
        {(slotClasses) => (
          <WithSx styles={[]} className={className} sx={sx}>
            {(consumerClasses) => (
              <WithSx styles={[]} className={[slotClasses, consumerClasses].filter(Boolean).join(' ')}>
                {(classes) => (
                  createElement(Root, {
                    ...merged,
                    ...attributes,
                    ref,
                    'data-ui': tokens(marker, host['data-ui'], slot?.['data-ui']),
                    'data-theme': declaredTheme,
                    'data-appearance': declaredAppearance,
                    className: classes,
                    style: rootStyle,
                  } as NativeSurfaceProps<T>, wrapChildren ? wrapChildren(merged.children) : merged.children)
                )}
              </WithSx>
            )}
          </WithSx>
        )}
      </WithSx>
    </AppearanceScope>
  );
}
