import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ComponentPropsWithRef } from 'react';
import { expect } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { Button } from '../components/button';
import { Spinner } from '../components/spinner';
import { css, type Interpolation, type Theme } from './css';
import { disclosureCaret } from './disclosure-caret';
import { listboxItemStyle, listboxScrollStyle, listboxSurfaceStyle } from './listbox-style';
import { FORCED_COLORS } from './media';
import { WithSx, type SxProps } from './sx';

const rowStyle = css({ display: 'flex', alignItems: 'center', gap: vars.space[4] });
const caretStyle = css({ '&::after': disclosureCaret });
const ownStyle = css({ paddingInlineStart: vars.space[1] });
const slotStyle = css({ paddingInlineStart: vars.space[2] });
const consumerStyle = css({ paddingInlineStart: vars.space[3] });
const sxStyle = css({ paddingInlineStart: vars.space[4] });

const meta = { title: 'Internal/Styling' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

function OverrideButton({ className, styles = ownStyle, sx, ...rest }:
  ComponentPropsWithRef<'button'> & SxProps & { styles?: Interpolation<Theme> }) {
  return (
    <WithSx className={className} styles={styles} sx={sx}>
      {(resolvedClassName) => <button {...rest} className={resolvedClassName} />}
    </WithSx>
  );
}

export const ForcedColors: Story = {
  render: () => (
    <div css={rowStyle}>
      <Spinner />
      <Button loading>Saving</Button>
      <Button css={caretStyle}>Details</Button>
    </div>
  ),
  play: async ({ canvasElement, canvas }) => {
    const indicator = canvasElement.querySelector('[data-ui="spinner-indicator"]')!;
    const caret = canvas.getByRole('button', { name: 'Details' });
    for (const [element, pseudo] of [[indicator, ''], [caret, '::after']] as const) {
      const rules = Array.from(canvasElement.ownerDocument.styleSheets).flatMap((sheet) => Array.from(sheet.cssRules));
      const declarations = rules
        .filter((rule): rule is CSSMediaRule => rule instanceof CSSMediaRule)
        .filter((rule) => `@media ${rule.conditionText}` === FORCED_COLORS)
        .flatMap((rule) => Array.from(rule.cssRules))
        .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule)
        .filter((rule) =>
          rule.selectorText.endsWith(pseudo) &&
          element.matches(pseudo ? rule.selectorText.slice(0, -pseudo.length) : rule.selectorText),
        );
      await expect(declarations.some((rule) => rule.style.forcedColorAdjust === 'none')).toBe(true);
      await expect(declarations.some((rule) => rule.style.color.toLowerCase() === 'canvastext')).toBe(true);
    }
  },
};

export const OverrideOrder: Story = {
  render: () => (
    <div>
      <OverrideButton>Own</OverrideButton>
      <OverrideButton styles={[ownStyle, slotStyle]}>Slot</OverrideButton>
      <OverrideButton styles={[ownStyle, slotStyle]} css={consumerStyle}>CSS</OverrideButton>
      <OverrideButton styles={[ownStyle, slotStyle]} css={consumerStyle} sx={[() => sxStyle]}>SX</OverrideButton>
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(getComputedStyle(canvas.getByRole('button', { name: 'Own' })).paddingInlineStart).toBe('4px');
    await expect(getComputedStyle(canvas.getByRole('button', { name: 'Slot' })).paddingInlineStart).toBe('8px');
    await expect(getComputedStyle(canvas.getByRole('button', { name: 'CSS' })).paddingInlineStart).toBe('12px');
    await expect(getComputedStyle(canvas.getByRole('button', { name: 'SX' })).paddingInlineStart).toBe('16px');
  },
};

export const SmallViewport: Story = {
  render: () => (
    <div
      css={[listboxSurfaceStyle, listboxScrollStyle]}
      data-testid="popup"
      role="region"
      aria-label="Options"
      tabIndex={0}
    >
      {Array.from({ length: 12 }, (_, index) => (
        <div key={index} css={listboxItemStyle}>Option {index + 1}</div>
      ))}
    </div>
  ),
  play: async ({ canvasElement, canvas }) => {
    const doc = canvasElement.ownerDocument;
    const frame = doc.createElement('iframe');
    frame.title = 'Small viewport sizing check';
    frame.width = '320';
    frame.height = '240';
    doc.body.append(frame);
    try {
      const frameDoc = frame.contentDocument!;
      for (const sheet of doc.styleSheets) {
        const style = frameDoc.createElement('style');
        style.textContent = Array.from(sheet.cssRules, (rule) => rule.cssText).join('\n');
        frameDoc.head.append(style);
      }
      const popup = canvas.getByTestId('popup').cloneNode(true) as HTMLElement;
      frameDoc.body.append(popup);
      await expect(popup.getBoundingClientRect().width).toBeLessThanOrEqual(288);
      await expect(popup.getBoundingClientRect().height).toBeLessThanOrEqual(208);
      await expect(popup.scrollHeight).toBeGreaterThan(popup.clientHeight);
      frame.width = '160';
      await expect(popup.getBoundingClientRect().width).toBeLessThanOrEqual(128);
    } finally {
      frame.remove();
    }
  },
};
