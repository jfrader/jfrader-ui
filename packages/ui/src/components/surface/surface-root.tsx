'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { FORCED_COLORS } from '../../styling/media';
import { raisedSurface, surfaceTheme } from '../../styling/surface';
import {
  AppearanceScope,
  themeColorSchemeStyle,
  useSurfaceAppearance,
  useSurfaceStyle,
  useThemeScope,
} from '../../styling/theme-scope';
import { WithSx } from '../../styling/sx';
import type { SurfacePartProps, SurfaceProps, SurfaceVariant } from './surface';

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

function tokens(...values: (string | undefined)[]) {
  return [...new Set(values.flatMap((value) => value?.split(/\s+/).filter(Boolean) ?? []))].join(' ');
}

interface SurfaceRootProps extends SurfaceProps {
  owner: string;
  marker: string;
  variant: SurfaceVariant;
  structure?: Interpolation<Theme>;
  attributes?: SurfacePartProps;
  wrapChildren?: (children: ReactNode) => ReactNode;
}

export function SurfaceRoot({
  owner,
  marker,
  variant,
  structure,
  attributes,
  wrapChildren,
  appearance: appearanceProp,
  component,
  slots,
  slotProps,
  css: consumerCss,
  sx,
  className,
  style,
  ...host
}: SurfaceRootProps) {
  const appearance = resolveSurfaceValue(owner, 'appearance', appearanceProp, appearances, 'default');
  const effectiveAppearance = useSurfaceAppearance(appearance);
  const parent = useThemeScope();
  const ownTheme = surfaceTheme(appearance);
  const slot = slotProps?.root;
  const { css: slotCss, className: slotClassName, style: slotStyle, ...slotRest } = slot ?? {};
  const merged = { ...host, ...slotRest };
  const declaredTheme = ownTheme ?? (merged['data-theme'] === parent?.theme ? merged['data-theme'] : undefined);
  const declaredAppearance = ownTheme || merged['data-appearance'] === effectiveAppearance
    ? effectiveAppearance
    : undefined;
  const rootStyle = useSurfaceStyle(declaredTheme ?? null, { ...style, ...slotStyle });
  const Root = slots?.root ?? component ?? 'div';
  const previousRoot = useRef(Root);
  const node = useRef<HTMLDivElement>(null);
  const ref = useMergeRefs([node, merged.ref]);

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
      const Div = node.current?.ownerDocument?.defaultView?.HTMLDivElement;
      if (!Div || !(node.current instanceof Div)) {
        console.warn(`${owner}: root must forward its ref to one HTMLDivElement. Missing or non-div root registration.`);
      }
    }
  });

  return (
    <AppearanceScope theme={ownTheme} appearance={effectiveAppearance}>
      <WithSx
        styles={[
          Root === 'div' && [material, shadows[variant], forcedColors],
          declaredTheme && themeColorSchemeStyle,
          structure,
          slotCss,
        ]}
        className={slotClassName}
      >
        {(slotClasses) => (
          <WithSx styles={consumerCss} className={className} sx={sx}>
            {(consumerClasses) => (
              <WithSx styles={[]} className={[slotClasses, consumerClasses].filter(Boolean).join(' ')}>
                {(classes) => (
                  <Root
                    {...merged}
                    {...attributes}
                    ref={ref}
                    data-ui={tokens(marker, host['data-ui'], slotRest['data-ui'])}
                    data-theme={declaredTheme}
                    data-appearance={declaredAppearance}
                    className={classes}
                    style={rootStyle}
                  >
                    {wrapChildren ? wrapChildren(merged.children) : merged.children}
                  </Root>
                )}
              </WithSx>
            )}
          </WithSx>
        )}
      </WithSx>
    </AppearanceScope>
  );
}
