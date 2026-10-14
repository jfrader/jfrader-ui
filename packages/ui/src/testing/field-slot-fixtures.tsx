import type { ComponentPropsWithRef } from 'react';
import { expect, fireEvent } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../styling/css';

const material = css({ backgroundColor: vars.color.surfaceRaised, borderRadius: '6px' });
const labelMaterial = css({ fontWeight: vars.fontWeight.medium });

export function FieldReplacementRoot({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-slot-root="slots" css={material} className={className} />;
}

export function FieldSugarRoot(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-slot-root="component" />;
}

export function FieldReplacementLabel({ className, ...props }: ComponentPropsWithRef<'label'>) {
  return <label {...props} data-slot-part css={labelMaterial} className={className} />;
}

export function FieldReplacementInput(props: ComponentPropsWithRef<'input'>) {
  return <input {...props} data-slot-part />;
}

export const fieldRootStyles = {
  consumer: { marginTop: '1px', padding: '1px' },
  slot: { marginBottom: '3px', padding: '2px' },
};

export async function expectFieldSlotCustomization(
  canvasElement: HTMLElement,
  refs: { root: unknown; part: unknown; consumer: unknown; rootEvent: unknown; consumerEvent: unknown },
  target: 'root' | 'input' | 'textarea',
) {
  const root = canvasElement.querySelector<HTMLElement>('[data-slot-root="slots"]')!;
  const part = root.querySelector<HTMLElement>('[data-slot-part]')!;
  await expect(root).not.toBeNull();
  await expect(part).not.toBeNull();
  await expect(part).toHaveAttribute('title', 'generated part');
  await expect(root).toHaveClass('slot-root', 'consumer-root');
  await expect(root).toHaveAttribute('title', 'slot title');
  await expect(root.style.marginTop).toBe('1px');
  await expect(root.style.marginBottom).toBe('3px');
  await expect(root.style.padding).toBe('2px');
  await expect(getComputedStyle(root).borderRadius).toBe('11px');
  await expect(refs.root).toHaveBeenCalledWith(root);
  await expect(refs.part).toHaveBeenCalledWith(part);
  const consumerTarget = target === 'root' ? root : root.querySelector(`${target}:not([type="hidden"])`);
  await expect(refs.consumer).toHaveBeenCalledWith(consumerTarget);
  fireEvent.click(root);
  await expect(refs.rootEvent).toHaveBeenCalledTimes(1);
  await expect(refs.consumerEvent).not.toHaveBeenCalled();
  if (part.tagName === 'LABEL') {
    await expect(part).toHaveAttribute('for', root.querySelector('input:not([type="hidden"]), textarea')!.id);
  }
}
