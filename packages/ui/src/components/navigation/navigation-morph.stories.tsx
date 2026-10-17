import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '../../styling/styled';
import { expectTranslucentContrast } from '../../testing/contrast-assertions';
import { Navigation, type NavigationEasyProps } from './navigation';

const Frame = styled.div({ boxSizing: 'border-box', inlineSize: `min(40rem, calc(100vw - ${vars.space[8]}))`, padding: vars.space[4], minBlockSize: '18rem' });
const Outside = styled.button({ marginBlockStart: '12rem', font: 'inherit', color: vars.color.text, background: vars.color.surfaceRaised, border: `1px solid ${vars.color.borderControl}`, padding: vars.space[3], borderRadius: vars.radius.md });
const groups = [
  { label: 'Product', collapsible: true, columns: 2 as const, items: [
    { label: 'Overview', href: '#overview', description: 'Projects and activity' },
    { label: 'Reports', href: '#reports', description: 'Usage and performance' },
    { label: 'Upcoming', href: '#upcoming', disabled: true },
  ] },
  { label: 'Company', collapsible: true, items: [
    { label: 'About', href: '#about' }, { label: 'Contact', href: '#contact' },
  ] },
];
const source = `<Navigation variant="morph" label="Site" activeHref="#overview" groups={[
  { label: 'Product', collapsible: true, columns: 2, items: [
    { label: 'Overview', href: '#overview', description: 'Projects and activity' },
    { label: 'Reports', href: '#reports', description: 'Usage and performance' },
  ] },
  { label: 'Company', collapsible: true, items: [
    { label: 'About', href: '#about' }, { label: 'Contact', href: '#contact' },
  ] },
]} />`;
const meta = {
  title: 'Navigation/Navigation', component: Navigation, tags: ['!autodocs'],
  args: { label: 'Site', variant: 'morph', activeHref: '#overview', groups },
  parameters: { docs: { description: { component: 'Group links into navigation sections and mark the current page.' }, source: { language: 'tsx', code: source } } },
  decorators: [(Story) => <Frame><Story /></Frame>],
  render: (args) => <><Navigation {...args} /><Outside>Continue</Outside></>,
} satisfies Meta<NavigationEasyProps>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Open grouped destinations with native disclosures and follow the current section. */
export const MorphKeyboard: Story = {
  play: async ({ canvas, userEvent }) => {
    await expectTranslucentContrast(canvas.getByRole('navigation', { name: 'Site' }));
    const product = canvas.getByText('Product');
    const company = canvas.getByText('Company');
    await expect(product).toHaveAttribute('aria-current', 'location');
    await userEvent.tab();
    await expect(product).toHaveFocus();
    await expect(getComputedStyle(product).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{ArrowRight}');
    await expect(company).toHaveFocus();
    await userEvent.keyboard('{Home}{ArrowDown}');
    const overview = canvas.getByRole('link', { name: 'Overview Projects and activity' });
    await expect(overview).toHaveFocus();
    await expect(overview).toHaveAttribute('aria-current', 'page');
    await userEvent.keyboard('{ArrowDown}');
    await expect(canvas.getByRole('link', { name: 'Reports Usage and performance' })).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}{ArrowUp}');
    await expect(product).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    await expect(company.parentElement).toHaveAttribute('open');
    await expect(product.parentElement).not.toHaveAttribute('open');
    await userEvent.keyboard('{ArrowLeft}');
    await expect(product.parentElement).toHaveAttribute('open');
    await userEvent.keyboard('{ArrowDown}{Escape}');
    await expect(product).toHaveFocus();
    await expect(product.parentElement).not.toHaveAttribute('open');
    await userEvent.keyboard('{End}{ArrowDown}');
    await expect(canvas.getByRole('link', { name: 'About' })).toHaveFocus();
    await userEvent.tab();
    await expect(canvas.getByRole('link', { name: 'Contact' })).toHaveFocus();
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: 'Continue' })).toHaveFocus();
    await expect(company.parentElement).not.toHaveAttribute('open');
  },
};
/** Keep a two-column panel open for reading. */
export const MorphPersistentPanel: Story = { args: { groups: groups.map((group, index) => ({ ...group, defaultOpen: index === 0 })) } };
/** Use the same disclosure bar in a light theme. */
export const MorphLight: Story = { ...MorphPersistentPanel, globals: { theme: 'light' }, play: async ({ canvas }) => { await expectTranslucentContrast(canvas.getByRole('navigation', { name: 'Site' })); } };
/** Compact spacing is supplied by the application. */
export const MorphCompact: Story = { args: { compact: true } };
/** Left advances to the next section under RTL. */
export const MorphRTL: Story = {
  args: { dir: 'rtl' },
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab();
    await userEvent.keyboard('{ArrowLeft}');
    await expect(canvas.getByText('Company')).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    await expect(canvas.getByRole('link', { name: 'About' })).toHaveFocus();
  },
};
/** Enable reduced motion in the browser to remove spacing transitions. */
export const MorphReducedMotion: Story = {
  args: { compact: true },
  parameters: { docs: { description: { story: 'The play checks the reduced-motion CSS declaration and disclosure keyboard behavior. Manual QA: emulate prefers-reduced-motion: reduce and toggle compact spacing; padding and gap must change immediately.' } } },
  play: async ({ canvas, userEvent }) => {
    const navigation = canvas.getByRole('navigation', { name: 'Site' });
    const reducedRules = Array.from(navigation.ownerDocument.styleSheets).flatMap((sheet) =>
      Array.from(sheet.cssRules).flatMap((rule) =>
        rule instanceof CSSMediaRule && rule.conditionText.includes('prefers-reduced-motion: reduce')
          ? Array.from(rule.cssRules).filter((inner): inner is CSSStyleRule =>
            inner instanceof CSSStyleRule && navigation.matches(inner.selectorText),
          )
          : [],
      ),
    );
    await expect(reducedRules.some((rule) => rule.style.transitionDuration === '0s')).toBe(true);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowDown}');
    await expect(canvas.getByRole('link', { name: 'Overview Projects and activity' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    await expect(canvas.getByText('Product')).toHaveFocus();
    await expect(canvas.getByText('Product').parentElement).not.toHaveAttribute('open');
  },
};
/** Preserve native modified-click behavior; prevented routing keeps the panel open. */
export const MorphPreventedRouting: Story = {
  args: { groups: [{ ...groups[0]!, defaultOpen: true, items: [{ label: 'Overview', href: '#overview', onClick: fn((event) => event.preventDefault()) }] }] },
  play: async ({ canvas, userEvent, args }) => {
    const link = canvas.getByRole('link', { name: 'Overview' });
    await userEvent.click(link);
    await expect(args.groups[0]?.items[0]?.onClick).toHaveBeenCalledTimes(1);
    await expect(canvas.getByText('Product').parentElement).toHaveAttribute('open');
    await expect(fireEvent.click(link, { ctrlKey: true })).toBe(false);
    await expect(args.groups[0]?.items[0]?.onClick).toHaveBeenCalledTimes(2);
  },
};
/** Opening a neighbouring section closes the previous disclosure. */
export const MorphOutsideDismiss: Story = {
  play: async ({ canvas, userEvent }) => {
    const product = canvas.getByText('Product');
    const company = canvas.getByText('Company');
    await userEvent.click(product);
    await userEvent.click(company);
    await expect(product.parentElement).not.toHaveAttribute('open');
    await expect(company.parentElement).toHaveAttribute('open');
    const outside = canvas.getByRole('button', { name: 'Continue' });
    await userEvent.click(outside);
    await expect(outside).toHaveFocus();
    await expect(company.parentElement).not.toHaveAttribute('open');
  },
};
