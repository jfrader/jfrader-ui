import type { ComponentPropsWithRef, CSSProperties, MouseEvent } from 'react';
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, spyOn, userEvent, waitFor, within, type Mock } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { Popover } from '../popover';
import { LocaleSwitcher, type LocaleSwitcherLinkProps, type LocaleSwitcherOption, type LocaleSwitcherSlots } from './index';

const OPTIONS = [
  { value: 'en', label: 'English', lang: 'en', href: '/en/pricing' },
  { value: 'es', label: 'Español', lang: 'es', href: '/es/precios' },
  { value: 'fr', label: 'Français', lang: 'fr', href: '/fr/tarifs' },
  { value: 'ar', label: 'العربية', lang: 'ar', href: '/ar/pricing' },
] as const satisfies readonly LocaleSwitcherOption[];
const PAIR = OPTIONS.slice(0, 2);
// Short visible codes; the native name stays the accessible name.
const SHORT_PAIR = [
  { value: 'es', label: 'ES', ariaLabel: 'Español', lang: 'es', href: '/es/precios' },
  { value: 'en', label: 'EN', ariaLabel: 'English', lang: 'en', href: '/en/pricing' },
] as const satisfies readonly LocaleSwitcherOption[];
const TRIGGER_LABEL = 'Change language';
const TRIGGER_NAME = `${TRIGGER_LABEL} English`;
const NAV_LABEL = 'Language';

function ReplacementTrigger(props: ComponentPropsWithRef<'button'>) {
  return <button {...props} data-testid="replacement-trigger" />;
}
function ReplacementContent(props: ComponentPropsWithRef<'div'>) {
  return <section {...props} data-testid="replacement-content" />;
}
const ReplacementOption: NonNullable<LocaleSwitcherSlots['option']> = (props) => {
  return <a {...props} data-testid="replacement-option" />;
};

export const ReplacementSlots: StoryObj<typeof LocaleSwitcher> = {
  parameters: { docs: { source: { language: 'tsx', code: `import type { ComponentPropsWithRef } from 'react';
import { LocaleSwitcher, type LocaleSwitcherSlots } from '@jfrader/ui';

function LanguageTrigger(props: ComponentPropsWithRef<'button'>) {
  return <button {...props} />;
}
function LanguageContent(props: ComponentPropsWithRef<'div'>) {
  return <section {...props} />;
}
const LanguageOption: NonNullable<LocaleSwitcherSlots['option']> = (props) => <a {...props} />;

<LocaleSwitcher
  value="en"
  triggerLabel="Change language"
  label="Language"
  options={[
    { value: 'en', label: 'English', lang: 'en', href: '/en/pricing' },
    { value: 'es', label: 'Español', lang: 'es', href: '/es/precios' },
    { value: 'fr', label: 'Français', lang: 'fr', href: '/fr/tarifs' },
    { value: 'ar', label: 'العربية', lang: 'ar', href: '/ar/pricing' },
  ]}
  slots={{ trigger: LanguageTrigger, content: LanguageContent, option: LanguageOption }}
  slotProps={{
    trigger: { className: 'replacement-trigger' },
    content: { className: 'replacement-content' },
    option: { className: 'replacement-option' },
  }}
/>` } } },
  args: {
    slots: { trigger: ReplacementTrigger, content: ReplacementContent, option: ReplacementOption },
    slotProps: {
      trigger: { className: 'replacement-trigger', onClick: fn() },
      content: { className: 'replacement-content' },
      option: { className: 'replacement-option' },
    },
  },
  play: async ({ canvasElement, args, userEvent }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByTestId('replacement-trigger');
    await expect(trigger).toHaveAttribute('data-ui', 'locale-switcher-trigger');
    await expect(trigger).toHaveClass('replacement-trigger');
    await expect(trigger.className).toMatch(/css-/);
    await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    await userEvent.click(trigger);
    await expect(args.slotProps?.trigger?.onClick).toHaveBeenCalled();
    const content = await body.findByTestId('replacement-content');
    await expect(content).toHaveAttribute('data-ui', 'locale-switcher-menu');
    await expect(content).toHaveClass('replacement-content');
    await expect(content.className).toMatch(/css-/);
    await expect(content).toHaveAttribute('role', 'menu');
    await expect(trigger).toHaveAttribute('aria-controls', content.id);
    const options = within(content).getAllByTestId('replacement-option');
    for (const option of options) {
      await expect(option).toHaveAttribute('data-ui', 'locale-switcher-option');
      await expect(option).toHaveClass('replacement-option');
      await expect(option.className).toMatch(/css-/);
      await expect(option).toHaveAttribute('role', 'menuitem');
      await expect(option).toHaveAttribute('href');
    }
    await expect(options[0]).toHaveAttribute('aria-current', 'true');
    await expect(canvasElement.querySelector('[data-ui="locale-switcher-trigger"]:not([data-testid="replacement-trigger"])')).toBeNull();
    await expect(canvasElement.ownerDocument.querySelector('div[data-ui="locale-switcher-menu"]')).toBeNull();
    await expect(content.querySelector('[data-ui="locale-switcher-option"]:not([data-testid="replacement-option"])')).toBeNull();
    await expect(options[0]).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    await expect(options[1]).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(content).not.toBeInTheDocument());
    await expect(trigger).toHaveFocus();
  },
};
// Landmark names must differ when a story renders more than one navigation.
const SECOND_NAV_LABEL = 'Site language';
// Regional indicator symbols: the code points flag emoji are made of.
const FLAG_GLYPHS = /[\u{1F1E6}-\u{1F1FF}]/u;

const usage = `<LocaleSwitcher
  triggerLabel="Change language"
  value="en"
  options={[
    { value: 'en', label: 'English', lang: 'en', href: '/en/pricing' },
    { value: 'es', label: 'Español', lang: 'es', href: '/es/precios' },
  ]}
/>`;

const stackStyle = {
  display: 'grid',
  justifyItems: 'start',
  gap: vars.space[4],
} satisfies CSSProperties;

// Story-only: links never leave the story; the spy records where they would have gone.
const navigate = fn<(href: string) => void>();

function interceptNavigation(event: MouseEvent<HTMLDivElement>) {
  const link = (event.target as Element).closest('a');
  if (!link) return;
  event.preventDefault();
  navigate(link.getAttribute('href')!);
}

const withNavigationSpy: Decorator = (Story) => (
  <div onClick={interceptNavigation}>
    <Story />
  </div>
);

const meta = {
  title: 'Navigation/LocaleSwitcher',
  component: LocaleSwitcher,
  tags: ['autodocs'],
  decorators: [withNavigationSpy],
  args: {
    options: OPTIONS,
    value: 'en',
    triggerLabel: TRIGGER_LABEL,
    label: NAV_LABEL,
    onOpenChange: fn(),
  },
  parameters: {
    docs: {
      source: { code: usage },
      description: {
        component:
          'Open the current page in another language.',
      },
      usage: `### Options and variants
- Supply native-name labels, page URLs, and language tags in \`options\`. Each link gets \`lang\`, \`hreflang\`, and \`dir="auto"\`. The current option gets \`aria-current\`.
- \`value\` identifies the current language. Navigation follows the option's URL, rather than changing a local selection. An unmatched value warns in development.
- \`menu\` is the default. Its trigger shows the current language. Supply a localized \`triggerLabel\` naming the action, such as "Change language". Assistive technology reads it before the current label, and it names the menu.
- \`swap\` shows one link to the other language on a two-language site. Other option counts warn in development and use the first noncurrent option. With no noncurrent option, it renders no link.
- \`inline\` lists all options in a navigation landmark. Supply its accessible name with \`label\`. The current language is plain text, not a tab stop.
- \`pills\` lists all options like \`inline\`, in a bordered pill group. The current language is filled with the accent.
- Set an option's \`ariaLabel\` to its native name when \`label\` is a short code, such as \`ES\`. The visible label is then hidden from assistive tech and the native name is what it reads; interactive parts (links, the menu trigger) take it as their accessible name.
- Use an option's \`render\` callback for router links. Spread every supplied prop, including the ref and event handlers, onto the returned link.

### Menu state
- Control the menu with \`open\` and \`onOpenChange\`, or set its initial state with \`defaultOpen\`.

### Keyboard
- On the menu trigger, Enter, Space, or ArrowDown opens on the first item. ArrowUp opens on the last.
- In the menu, arrows move and wrap. Home and End jump to the first and last items. Type a native name to move to its option.
- Enter follows the focused link. Space clicks it. Escape closes and returns focus to the trigger. Tab closes and lets focus move on.
- Inline, pills, and swap links follow native Tab order.`,
    },
    // Floating UI's focus guards are aria-hidden spans with tabindex=0 that forward focus
    // immediately; axe flags them as aria-hidden-focus (known false positive).
    a11y: {
      config: {
        rules: [{ id: 'aria-hidden-focus', selector: '[aria-hidden="true"]:not([data-floating-ui-focus-guard])' }],
      },
    },
  },
} satisfies Meta<typeof LocaleSwitcher>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Portaled content lives in the story document's body, outside the canvas. */
function bodyOf(canvasElement: HTMLElement) {
  return within(canvasElement.ownerDocument.body);
}

const callValues = (spy: unknown) => (spy as Mock).mock.calls.map(([value]) => value);

function mediaRuleSets(element: Element, query: string, property: string, expected: string) {
  return Array.from(element.ownerDocument.styleSheets).some((sheet) =>
    Array.from(sheet.cssRules).some(
      (rule) =>
        rule instanceof CSSMediaRule &&
        rule.conditionText.includes(query) &&
        Array.from(rule.cssRules).some(
          (inner) =>
            inner instanceof CSSStyleRule &&
            element.matches(inner.selectorText) &&
            inner.style.getPropertyValue(property).toLowerCase() === expected,
        ),
    ),
  );
}

function getTrigger(canvasElement: HTMLElement) {
  return within(canvasElement).getByRole('button', { name: TRIGGER_NAME });
}

async function expectFocused(canvasElement: HTMLElement, name: string) {
  await waitFor(() =>
    expect(canvasElement.ownerDocument.activeElement).toBe(bodyOf(canvasElement).getByRole('menuitem', { name })),
  );
}

async function expectClosed(canvasElement: HTMLElement) {
  await waitFor(() => expect(bodyOf(canvasElement).queryByRole('menu')).toBeNull());
  const trigger = within(canvasElement).getByRole('button', { name: new RegExp(`^${TRIGGER_LABEL}`) });
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
}

async function expectOptionLink(link: HTMLElement, option: LocaleSwitcherOption, current: boolean) {
  await expect(link.tagName).toBe('A');
  await expect(link).toHaveAttribute('href', option.href);
  await expect(link).toHaveAttribute('lang', option.lang);
  await expect(link).toHaveAttribute('hreflang', option.lang);
  await expect(link).toHaveAttribute('dir', 'auto');
  await expect(link).toHaveAttribute('data-ui', 'locale-switcher-option');
  if (current) await expect(link).toHaveAttribute('aria-current', 'true');
  else await expect(link).not.toHaveAttribute('aria-current');
}

export const Menu: Story = {
  play: async ({ canvasElement }) => {
    const trigger = getTrigger(canvasElement);
    await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    await expect(trigger).toHaveAttribute('data-ui', 'locale-switcher-trigger');
    // The visible text is the current language; the name leads with the action.
    await expect(trigger).toHaveTextContent(`${TRIGGER_LABEL}English`);
    await expect(within(trigger).getByText('English')).toHaveAttribute('lang', 'en');
    await expect(trigger.closest('[data-ui="locale-switcher"]')).toHaveAttribute('data-variant', 'menu');

    await userEvent.click(trigger);
    const menu = await bodyOf(canvasElement).findByRole('menu', { name: TRIGGER_LABEL });
    await expect(menu).toHaveAttribute('data-ui', 'locale-switcher-menu');
    const items = within(menu).getAllByRole('menuitem');
    await expect(items.map((item) => item.textContent?.replace('✓', ''))).toEqual(OPTIONS.map((option) => option.label));
    for (const [index, item] of items.entries()) await expectOptionLink(item, OPTIONS[index]!, index === 0);
    await expect(menu.querySelectorAll('button, select')).toHaveLength(0);
    // Pointer open focuses the first item.
    await expectFocused(canvasElement, 'English');

    navigate.mockClear();
    await userEvent.click(items[1]!);
    await expect(callValues(navigate)).toEqual(['/es/precios']);
    await expectClosed(canvasElement);
  },
};

export const MenuKeyboard: Story = {
  play: async ({ args, canvasElement }) => {
    navigate.mockClear();
    const trigger = getTrigger(canvasElement);
    await userEvent.tab();
    await expect(trigger).toHaveFocus();

    await userEvent.keyboard('{Enter}');
    await expectFocused(canvasElement, 'English');
    const traversal = [
      ['{ArrowDown}', 'Español'],
      ['{End}', 'العربية'],
      ['{ArrowDown}', 'English'],
      ['{ArrowUp}', 'العربية'],
      ['{Home}', 'English'],
      ['f', 'Français'],
    ] as const;
    for (const [key, name] of traversal) {
      await userEvent.keyboard(key);
      await expectFocused(canvasElement, name);
    }

    // Enter follows the focused link like any anchor, then focus returns to the trigger.
    await userEvent.keyboard('{Enter}');
    await expect(callValues(navigate)).toEqual(['/fr/tarifs']);
    await expectClosed(canvasElement);
    await waitFor(() => expect(trigger).toHaveFocus());

    // Space clicks the focused link too.
    await userEvent.keyboard('{ArrowDown}');
    await expectFocused(canvasElement, 'English');
    await userEvent.keyboard('{ArrowDown}');
    await expectFocused(canvasElement, 'Español');
    await userEvent.keyboard(' ');
    await expect(callValues(navigate)).toEqual(['/fr/tarifs', '/es/precios']);
    await expectClosed(canvasElement);

    // Escape closes without navigating and returns focus to the trigger.
    await waitFor(() => expect(trigger).toHaveFocus());
    await userEvent.keyboard('{Enter}');
    await expectFocused(canvasElement, 'English');
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
    await waitFor(() => expect(trigger).toHaveFocus());
    await expect(navigate).toHaveBeenCalledTimes(2);
    await expect(callValues(args.onOpenChange)).toEqual([true, false, true, false, true, false]);
  },
};

export const MenuOpen: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  play: async ({ canvasElement }) => {
    // Persistent open state so the axe gate sees the portaled menu.
    const menu = await bodyOf(canvasElement).findByRole('menu', { name: TRIGGER_LABEL });
    await expect(within(menu).getByRole('menuitem', { name: 'English' })).toHaveAttribute('aria-current', 'true');
  },
};

export const MenuLightTheme: Story = { ...MenuOpen, decorators: [withLightTheme] };

const popoverOpenChange = fn<(open: boolean) => void>();

export const MenuInsidePopover: Story = {
  tags: ['!autodocs'],
  render: (args) => (
    <Popover defaultOpen onOpenChange={popoverOpenChange}>
      <Popover.Trigger>Settings</Popover.Trigger>
      <Popover.Content aria-label="Settings">
        <LocaleSwitcher {...args} />
      </Popover.Content>
    </Popover>
  ),
  play: async ({ canvasElement }) => {
    popoverOpenChange.mockClear();
    const popover = await bodyOf(canvasElement).findByRole('dialog', { name: 'Settings' });
    const trigger = within(popover).getByRole('button', { name: TRIGGER_NAME });
    await userEvent.click(trigger);
    await expectFocused(canvasElement, 'English');

    // Escape closes the menu alone and returns focus to its trigger.
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(bodyOf(canvasElement).queryByRole('menu')).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
    await expect(popover).toBeVisible();
    await expect(popoverOpenChange).not.toHaveBeenCalled();

    // The next Escape closes the popover.
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(bodyOf(canvasElement).queryByRole('dialog')).toBeNull());
    await expect(callValues(popoverOpenChange)).toEqual([false]);
  },
};

export const Swap: Story = {
  args: { variant: 'swap', options: PAIR },
  play: async ({ canvas }) => {
    navigate.mockClear();
    const [link, ...others] = canvas.getAllByRole('link');
    await expect(others).toHaveLength(0);
    await expect(link).toHaveAccessibleName('Español');
    await expectOptionLink(link!, PAIR[1]!, false);
    await expect(canvas.queryByRole('button')).toBeNull();
    await expect(link!.closest('[data-ui="locale-switcher"]')).toHaveAttribute('data-variant', 'swap');
    await userEvent.click(link!);
    await expect(callValues(navigate)).toEqual(['/es/precios']);
  },
};

// Three options: development warns; the link targets the first option that is not current.
export const SwapWithThreeOptions: Story = {
  args: { variant: 'swap', options: OPTIONS.slice(0, 3), value: 'es' },
  beforeEach: () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {});
    return () => warn.mockRestore();
  },
  play: async ({ canvas }) => {
    const [link, ...others] = canvas.getAllByRole('link');
    await expect(others).toHaveLength(0);
    await expectOptionLink(link!, OPTIONS[0], false);
    await waitFor(() =>
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('swap variant expects exactly two options')),
    );
  },
};

export const Inline: Story = {
  args: { variant: 'inline' },
  play: async ({ canvas }) => {
    navigate.mockClear();
    const nav = canvas.getByRole('navigation', { name: NAV_LABEL });
    await expect(nav).toHaveAttribute('data-ui', 'locale-switcher');
    await expect(within(nav).getAllByRole('listitem')).toHaveLength(OPTIONS.length);

    const current = within(nav).getByText('English');
    await expect(current.tagName).toBe('SPAN');
    await expect(current).toHaveAttribute('aria-current', 'true');
    await expect(current).toHaveAttribute('lang', 'en');
    await expect(current).toHaveAttribute('dir', 'auto');
    await expect(current).not.toHaveAttribute('href');

    const links = within(nav).getAllByRole('link');
    await expect(links).toHaveLength(OPTIONS.length - 1);
    for (const [index, link] of links.entries()) await expectOptionLink(link, OPTIONS[index + 1]!, false);

    // The current label is not a tab stop; the links follow in order.
    for (const link of links) {
      await userEvent.tab();
      await expect(link).toHaveFocus();
      await expect(getComputedStyle(link).outlineStyle).not.toBe('none');
    }
    await userEvent.keyboard('{Enter}');
    await expect(callValues(navigate)).toEqual(['/ar/pricing']);
  },
};

export const InlineLightTheme: Story = { ...Inline, decorators: [withLightTheme] };

export const Pills: Story = {
  args: { variant: 'pills', options: SHORT_PAIR },
  play: async ({ canvas }) => {
    navigate.mockClear();
    const nav = canvas.getByRole('navigation', { name: NAV_LABEL });
    await expect(nav).toHaveAttribute('data-variant', 'pills');
    // The visible text is the short code; the name keeps it and adds the native name.
    const options = within(nav)
      .getAllByRole('listitem')
      .map((item) => item.querySelector('[data-ui="locale-switcher-option"]') as HTMLElement);
    await expect(options).toHaveLength(2);
    await expect(options[0]).toHaveTextContent(/^ES Español$/);
    await expect(options[1]).toHaveTextContent(/^EN English$/);

    const current = options[1]!;
    await expect(current.tagName).toBe('SPAN');
    await expect(current).toHaveAttribute('aria-current', 'true');
    await expect(current).not.toHaveAttribute('href');
    await expect(getComputedStyle(current).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');

    const [link, ...others] = within(nav).getAllByRole('link');
    await expect(others).toHaveLength(0);
    await expect(link).toHaveTextContent('ES');
    await expect(link).toHaveAccessibleName('ES Español');
    await expectOptionLink(link!, SHORT_PAIR[0], false);

    await userEvent.tab();
    await expect(link).toHaveFocus();
    await expect(getComputedStyle(link!).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{Enter}');
    await expect(callValues(navigate)).toEqual(['/es/precios']);
  },
};

export const PillsLightTheme: Story = { ...Pills, decorators: [withLightTheme] };

export const PillsSizes: Story = {
  args: { variant: 'pills', options: SHORT_PAIR },
  render: (args) => (
    <div style={stackStyle}>
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <LocaleSwitcher {...args} key={size} size={size} label={`${NAV_LABEL} ${size}`} />
      ))}
    </div>
  ),
  play: async ({ canvas }) => {
    // The pill matches the menu trigger heights.
    const heights = canvas.getAllByRole('list').map((list) => list.getBoundingClientRect().height);
    await expect(heights[0]).toBeGreaterThanOrEqual(32);
    await expect(heights[1]).toBeGreaterThanOrEqual(40);
    await expect(heights[2]).toBeGreaterThanOrEqual(48);
  },
};

// `ariaLabel` names the option in every variant, including the menu trigger's current label.
export const AriaLabels: Story = {
  args: { options: SHORT_PAIR },
  render: (args) => (
    <div style={stackStyle}>
      <LocaleSwitcher {...args} />
      <LocaleSwitcher {...args} variant="swap" />
      <LocaleSwitcher {...args} variant="inline" />
    </div>
  ),
  play: async ({ canvasElement, canvas }) => {
    const trigger = canvas.getByRole('button', { name: `${TRIGGER_LABEL} EN English` });
    await expect(trigger).toHaveAccessibleName(`${TRIGGER_LABEL} EN English`);
    for (const link of canvas.getAllByRole('link')) await expect(link).toHaveAccessibleName('ES Español');
    const inlineCurrent = canvas
      .getByRole('navigation')
      .querySelector('[aria-current="true"]') as HTMLElement;
    await expect(inlineCurrent).toHaveTextContent('EN');
    await expect(inlineCurrent).toHaveTextContent('English');

    await userEvent.click(trigger);
    const menu = await bodyOf(canvasElement).findByRole('menu', { name: TRIGGER_LABEL });
    const items = within(menu).getAllByRole('menuitem');
    await expect(items).toHaveLength(2);
    await expect(items[0]).toHaveAccessibleName('ES Español');
    await expect(items[1]).toHaveAccessibleName('EN English');
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
  },
};

export const Semantics: Story = {
  render: (args) => (
    <div style={stackStyle}>
      <LocaleSwitcher {...args} />
      <LocaleSwitcher {...args} variant="swap" options={PAIR} />
      <LocaleSwitcher {...args} variant="inline" />
      <LocaleSwitcher {...args} variant="pills" label={SECOND_NAV_LABEL} />
    </div>
  ),
  play: async ({ canvasElement, canvas }) => {
    const roots = Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-ui="locale-switcher"]'));
    await expect(roots.map((root) => root.dataset.variant)).toEqual(['menu', 'swap', 'inline', 'pills']);
    // The menu trigger is the only button; links are never buttons.
    await expect(canvas.getAllByRole('button')).toHaveLength(1);
    await expect(canvasElement.querySelectorAll('select, [role="button"]:not(button)')).toHaveLength(0);
    await expect(FLAG_GLYPHS.test(canvasElement.textContent ?? '')).toBe(false);

    // Hover transitions stop under reduced motion.
    const link = canvas.getAllByRole('link')[0]!;
    await expect(mediaRuleSets(link, 'prefers-reduced-motion', 'transition-duration', '0s')).toBe(true);
    const chevron = getTrigger(canvasElement).lastElementChild!;
    await expect(mediaRuleSets(chevron, 'prefers-reduced-motion', 'transition-duration', '0s')).toBe(true);
  },
};

export const Rtl: Story = {
  args: { dir: 'rtl' },
  render: (args) => (
    <div style={stackStyle}>
      <LocaleSwitcher {...args} />
      <LocaleSwitcher {...args} variant="inline" />
      <LocaleSwitcher {...args} variant="pills" label={SECOND_NAV_LABEL} />
    </div>
  ),
  play: async ({ canvasElement, canvas }) => {
    // Logical properties: the trigger and the lists flow from the inline start (the right).
    const trigger = getTrigger(canvasElement);
    const label = within(trigger).getByText('English');
    const chevron = trigger.lastElementChild!;
    await expect(chevron.getBoundingClientRect().right).toBeLessThanOrEqual(label.getBoundingClientRect().left);
    for (const name of [NAV_LABEL, SECOND_NAV_LABEL]) {
      const [first, second] = within(canvas.getByRole('navigation', { name })).getAllByRole('listitem');
      await expect(second!.getBoundingClientRect().right).toBeLessThanOrEqual(first!.getBoundingClientRect().left);
    }
  },
};

export const Sizes: Story = {
  render: (args) => (
    <div style={stackStyle}>
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <LocaleSwitcher {...args} key={size} size={size} />
      ))}
    </div>
  ),
  play: async ({ canvas }) => {
    const heights = canvas.getAllByRole('button').map((trigger) => trigger.getBoundingClientRect().height);
    await expect(heights[0]).toBeGreaterThanOrEqual(32);
    await expect(heights[1]).toBeGreaterThanOrEqual(40);
    await expect(heights[2]).toBeGreaterThanOrEqual(48);
  },
};

const ROUTED_OPTIONS = OPTIONS.map((option) => ({
  ...option,
  // Stands in for a router's Link: it receives every prop and must spread them.
  render: (props: LocaleSwitcherLinkProps) => <a {...props} data-router-link="" />,
})) satisfies LocaleSwitcherOption[];

export const RouterLinks: Story = {
  args: { options: ROUTED_OPTIONS },
  render: (args) => (
    <div style={stackStyle}>
      <LocaleSwitcher {...args} />
      <LocaleSwitcher {...args} variant="inline" />
    </div>
  ),
  play: async ({ canvasElement, canvas }) => {
    navigate.mockClear();
    const inlineLinks = within(canvas.getByRole('navigation')).getAllByRole('link');
    for (const [index, link] of inlineLinks.entries()) {
      await expectOptionLink(link, OPTIONS[index + 1]!, false);
      await expect(link).toHaveAttribute('data-router-link');
    }

    await userEvent.click(getTrigger(canvasElement));
    const items = within(await bodyOf(canvasElement).findByRole('menu')).getAllByRole('menuitem');
    for (const [index, item] of items.entries()) {
      await expectOptionLink(item, OPTIONS[index]!, index === 0);
      await expect(item).toHaveAttribute('data-router-link');
    }
    await userEvent.keyboard('{ArrowDown}');
    await expectFocused(canvasElement, 'Español');
    await userEvent.keyboard('{Enter}');
    await expect(callValues(navigate)).toEqual(['/es/precios']);
    await expectClosed(canvasElement);
  },
};
