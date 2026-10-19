'use client';

import type { ComponentPropsWithRef, ComponentType, ElementType, ReactNode } from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { WithSx, type SxProps } from '../styling/sx';
import type { Interpolation, Theme } from '../styling/css';

type PresentationElement = 'article' | 'div' | 'p' | 'span' | 'a' | 'time' | 'figure' | 'figcaption' | 'ul' | 'li' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
export type PresentationProps<E extends PresentationElement> = ComponentPropsWithRef<E> & {
  css?: Interpolation<Theme>;
  'data-ui'?: string;
  [attribute: `data-${string}`]: unknown;
};
export type PresentationSlots<A extends Record<string, PresentationElement>> = {
  [K in keyof A]?: ComponentType<ComponentPropsWithRef<A[K]>>;
};
export type PresentationParts<A extends Record<string, PresentationElement>> = {
  [K in keyof A]?: PresentationProps<A[K]>;
};
export type PrintedTime = { dateTime: string; label: ReactNode };
export type ArticleHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
export type RenderArticleLink = (props: ComponentPropsWithRef<'a'>) => ReactNode;

export function PresentationSlot<E extends PresentationElement>({
  element, component, marker, slotProps: part, templateProps: template, inheritedSlotProps: inherited, styles, sx, renderLink, css: ownCss, ...own
}: PresentationProps<E> & SxProps & {
  element: E;
  marker?: string;
  component?: ElementType;
  slotProps?: PresentationProps<E>;
  templateProps?: PresentationProps<E>;
  inheritedSlotProps?: PresentationProps<E>;
  styles?: Interpolation<Theme>;
  renderLink?: RenderArticleLink;
}) {
  const ref = useMergeRefs([own.ref, template?.ref, inherited?.ref, part?.ref]);
  const merged = { ...own, ...template, ...inherited, ...part };
  merged.children = own.children;
  for (const key of ['aria-describedby', 'aria-labelledby'] as const) {
    const values = [own[key], template?.[key], inherited?.[key], part?.[key]].filter(Boolean);
    if (values.length) merged[key] = [...new Set(values.join(' ').split(/\s+/))].join(' ');
  }
  if (element === 'a') {
    const target = Reflect.get(merged, 'target');
    const rel = Reflect.get(merged, 'rel');
    Reflect.set(merged, 'rel', safeArticleRel(typeof target === 'string' ? target : undefined, typeof rel === 'string' ? rel : undefined));
  }
  const identities = [marker, own['data-ui'], template?.['data-ui'], inherited?.['data-ui'], part?.['data-ui']].filter((value) => typeof value === 'string');
  const dataUi = [...new Set(identities.join(' ').split(/\s+/).filter(Boolean))].join(' ');
  const className = [template?.className, inherited?.className, part?.className, own.className].filter(Boolean).join(' ') || undefined;
  const style = { ...own.style, ...template?.style, ...inherited?.style, ...part?.style };
  const Component = component ?? element;
  return (
    <WithSx className={className} styles={[styles, template?.css, inherited?.css, part?.css, ownCss]} sx={sx}>
      {(className) => {
        const props = { ...merged, css: undefined, ref, style, className, 'data-ui': dataUi };
        if (renderLink) {
          const { css: _css, ...linkProps } = props;
          return renderLink(linkProps as ComponentPropsWithRef<'a'>);
        }
        return <Component {...props} />;
      }}
    </WithSx>
  );
}

export function repeatedTemplate<P extends { id?: string; ref?: unknown }>(props: P | undefined): Omit<P, 'id' | 'ref'> | undefined {
  if (!props) return undefined;
  const { id: _id, ref: _ref, ...template } = props;
  return template;
}

export function safeArticleRel(target: string | undefined, rel: string | undefined) {
  return target === '_blank' ? [...new Set([...(rel?.split(/\s+/).filter(Boolean) ?? []), 'noopener', 'noreferrer'])].join(' ') : rel;
}
