import type { ComponentPropsWithRef, ComponentType, ElementType } from 'react';
import { useMergeRefs } from '@floating-ui/react';
import type { Interpolation, Theme } from '../../styling/css';
import { WithSx, type SxProps } from '../../styling/sx';

export type FieldElement = 'div' | 'span' | 'label' | 'input' | 'textarea' | 'button' | 'ul' | 'li' | 'img' | 'section' | 'figure' | 'figcaption' | 'ol' | 'h3' | 'p';
export type FieldElementProps<Element extends FieldElement> = ComponentPropsWithRef<Element> & {
  css?: Interpolation<Theme>;
  [attribute: `data-${string}`]: unknown;
};
export type FieldSlots<Anatomy extends Record<string, FieldElement>> = {
  [Part in keyof Anatomy]?: ComponentType<ComponentPropsWithRef<Anatomy[Part]>>;
};
export type FieldParts<Anatomy extends Record<string, FieldElement>> = {
  [Part in keyof Anatomy]?: FieldElementProps<Anatomy[Part]>;
};
type FieldBehavior<Element extends FieldElement> = Pick<
  FieldElementProps<Element>,
  Extract<keyof FieldElementProps<Element>, `on${string}`>
>;

export function FieldSlot<Element extends FieldElement>({
  element,
  component,
  slotProps: part,
  root = false,
  sx,
  styles,
  behavior,
  stateProps,
  ...own
}: FieldElementProps<Element> &
  SxProps & {
    element: Element;
    component?: ElementType;
    slotProps?: FieldElementProps<Element>;
    root?: boolean;
    styles?: Interpolation<Theme>;
    behavior?: FieldBehavior<Element>;
    stateProps?: Pick<FieldElementProps<Element>, 'aria-disabled' | 'aria-busy' | 'aria-invalid'>;
  }) {
  const ref = useMergeRefs([own.ref, part?.ref]);
  const merged = { ...(root ? { ...own, ...part } : { ...part, ...own }), ...stateProps };
  merged.children = own.children;
  for (const key of ['data-state', 'data-phase']) {
    if (Reflect.has(own, key)) Reflect.set(merged, key, Reflect.get(own, key));
  }
  const identities = [own['data-ui'], part?.['data-ui']].filter((value) => typeof value === 'string');
  if (identities.length)
    Reflect.set(merged, 'data-ui', [...new Set(identities.join(' ').split(/\s+/).filter(Boolean))].join(' '));
  for (const key of ['aria-describedby', 'aria-labelledby'] as const) {
    const values = [own[key], part?.[key]].filter(Boolean);
    if (values.length) merged[key] = [...new Set(values.join(' ').split(/\s+/))].join(' ');
  }
  const className = [part?.className, own.className].filter(Boolean).join(' ') || undefined;
  const style = { ...own.style, ...part?.style };
  const Component = component ?? element;
  for (const key of Object.keys(root ? {} : (part ?? {}))) {
    if (!/^on[A-Z]/.test(key)) continue;
    const ownHandler = Reflect.get(own, key);
    const partHandler = Reflect.get(part!, key);
    if (typeof partHandler !== 'function') continue;
    Reflect.set(merged, key, (event: unknown) => {
      partHandler(event);
      if (typeof ownHandler === 'function') ownHandler(event);
    });
  }
  for (const key of Object.keys(behavior ?? {})) {
    const handler = Reflect.get(behavior!, key);
    const consumer = Reflect.get(merged, key);
    Reflect.set(merged, key, (event: unknown) => {
      if (typeof consumer === 'function') consumer(event);
      if (typeof handler === 'function') handler(event);
    });
  }
  return (
    <WithSx className={className} styles={[styles, part?.css]} sx={sx}>
      {(resolvedClassName) => (
        <Component {...merged} css={undefined} ref={ref} style={style} className={resolvedClassName} />
      )}
    </WithSx>
  );
}
