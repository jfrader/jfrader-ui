import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '../../styling/styled';
import { ThemeRoot } from '../theme-root';
import { withLightTheme } from '../../testing/story-decorators';
import { settleMotion } from '../../testing/motion-assertions';
import { PhoneInput, type PhoneInputProps, type PhoneCountryCode } from './index';

const Stack = styled.div({ display: 'grid', gap: vars.space[4], inlineSize: 'min(100%, 400px)', fontFamily: vars.font.sans, color: vars.color.text });
const Action = styled.button({ font: 'inherit', color: vars.color.text, backgroundColor: vars.color.surfaceRaised, border: `1px solid ${vars.color.borderControl}`, borderRadius: vars.radius.sm, minBlockSize: vars.space[8], paddingInline: vars.space[3] });
const Hidden = styled.span({ position: 'absolute', inlineSize: 1, blockSize: 1, overflow: 'hidden', clipPath: 'inset(50%)' });
const Form = styled.form({ display: 'grid', gap: vars.space[3] });
const ScopedSurface = styled.div({ backgroundColor: vars.color.bg, padding: vars.space[4] });
const meta = {
  title: 'Inputs/PhoneInput', component: PhoneInput, tags: ['autodocs'],
  args: { label: 'Phone number', defaultCountry: 'GB', locale: 'en-GB' },
  decorators: [(Story) => <Stack><Story /></Stack>],
  parameters: { docs: {
    description: { component: 'Enter a telephone number and choose its country.' },
    sections: [
      { title: 'Basic', stories: ['Default', 'Controlled'] },
      { title: 'Country picker and search', stories: ['CountrySearch', 'Restricted', 'NoCountry'] },
      { title: 'Formatting', stories: ['InternationalPaste', 'Valid'] },
      { title: 'Incomplete numbers and validation', stories: ['Incomplete', 'Error'] },
      { title: 'States', stories: ['Disabled', 'ReadOnly', 'Required'] },
      { title: 'Forms', stories: ['FormReset'] },
      { title: 'Right-to-left', stories: ['RTL'] },
      { title: 'Keyboard', stories: ['KeyboardNavigation'] },
    ],
    usage: `### When to use
Collect a telephone number with a country and national formatting. Use a TextField with type="tel" for unrestricted telephone text, extensions or non-geographic calling codes.

### Constraints and validation

An incomplete number is still an editable draft, not a valid E.164 number. Metadata validation does not verify ownership or deliverability. Validation runs on field exit by default; empty optional numbers are not invalid. Required checks nonempty text, not metadata validity.

Pasting an international number selects a country only when its calling code and metadata identify one. Shared calling codes alone do not identify a country. A number that disagrees with an explicit country remains international and invalid. Incomplete national numbers retain typed trunk prefixes until they can be normalized. There is no digit cap; unsupported punctuation, extensions and non-geographic numbers are rejected without discarding accepted digits.

### Keyboard and accessibility

Enter, Space or a vertical arrow on the country button opens search. Letters start a country search; plus in the number field starts a calling-code search. Arrows move one result, PageUp/PageDown move eight, and Home/End reach endpoints when search is empty. Navigation does not wrap; Enter selects.

Escape closes and returns focus to the country button. Tab, Shift+Tab and outside press close without restoring focus. Backspace/Delete beside formatting separators remove the adjacent digit; range selection, composition and modifier chords retain native editing behavior.

Supply localized messages and an explicit locale for deterministic server rendering. Country names use Intl.DisplayNames. In RTL layouts, the number stays left-to-right. Check screen-reader announcements and mobile telephone autofill in your application.`,
  } },
} satisfies Meta<typeof PhoneInput>;
export default meta;
type Story = StoryObj<typeof meta>;

function ControlledExample(props: PhoneInputProps) {
  const [value, setValue] = useState(props.defaultValue ?? '');
  const [country, setCountry] = useState<PhoneCountryCode | null>(props.defaultCountry === undefined ? 'GB' : props.defaultCountry);
  const [open, setOpen] = useState(false);
  return <PhoneInput {...props} value={value} country={country} open={open} onValueChange={(next, details) => { props.onValueChange?.(next, details); setValue(next); }} onCountryChange={(next) => { props.onCountryChange?.(next); setCountry(next); }} onOpenChange={(next) => { props.onOpenChange?.(next); setOpen(next); }} />;
}
function CountryExample(props: PhoneInputProps) {
  const [country, setCountry] = useState<PhoneCountryCode | null>('GB');
  return <PhoneInput {...props} country={country} onCountryChange={setCountry} />;
}
function ExternalExample(props: PhoneInputProps) {
  const [value, setValue] = useState('');
  return <><PhoneInput {...props} value={value} /><Action onClick={() => setValue('+442079460018')}>Load contact</Action></>;
}
function ResetExample(props: PhoneInputProps) {
  return <Form aria-label="Contact"><PhoneInput {...props} /><Action type="reset">Reset</Action></Form>;
}
function portal(element: HTMLElement) { return within(element.ownerDocument.body); }
async function expectFocused(element: HTMLElement) {
  await expect(element.ownerDocument.activeElement).toBe(element);
  await expect(getComputedStyle(element).outlineStyle).not.toBe('none');
}

export const PanelPlacement: Story = {
  args: { defaultOpen: true, defaultValue: '+447911123456' },
  tags: ['!autodocs'],
  play: async ({ canvasElement }) => {
    const page = portal(canvasElement);
    const panel = await page.findByRole('dialog', { name: 'Countries' });
    const trigger = canvasElement.querySelector(
      '[data-ui="phone-input"] button',
    ) as HTMLElement;
    const triggerBox = trigger.getBoundingClientRect();
    const panelBox = panel.getBoundingClientRect();
    const below = Math.abs(panelBox.top - (triggerBox.bottom + 8));
    const above = Math.abs(triggerBox.top - (panelBox.bottom + 8));
    await expect(Math.min(below, above)).toBeLessThan(2);
    await expect(panelBox.top).toBeGreaterThan(16);
    // The panel never grows past 20rem, so it stays anchored instead of being clamped to the edge.
    await expect(panelBox.height).toBeLessThanOrEqual(321);
  },
};
export const Default: Story = {
  name: 'Enter a phone number',
  parameters: { docs: {
    description: { story: 'Enter a national number or choose another country before typing.' },
    source: { language: 'tsx', code: `import { PhoneInput } from '@jfrader/ui';

<PhoneInput label="Phone number" defaultCountry="GB" locale="en-GB" />` },
  } },
  play: async ({ canvas }) => {
    const input = canvas.getByRole('textbox', { name: 'Phone number' });
    await expect(input).toHaveAttribute('type', 'tel');
    await expect(canvas.getByRole('button', { name: 'United Kingdom +44' })).toHaveAttribute('aria-expanded', 'false');
  },
};
export const MouseSelectsCountry: Story = {
  tags: ['!autodocs'],
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: 'United Kingdom +44' });
    await userEvent.click(trigger);
    const page = portal(canvasElement);
    const spain = await page.findByRole('option', { name: /Spain/ });
    // A real mousedown must not blur the field, or the panel closes before the click.
    const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    spain.dispatchEvent(down);
    await expect(down.defaultPrevented).toBe(true);
    await userEvent.click(spain);
    await expect(trigger).toHaveAccessibleName(/Spain/);
    await expect(
      page.queryByRole('dialog', { name: 'Countries' }),
    ).not.toBeInTheDocument();
  },
};
/** All three control heights share the same country picker. */
export const Sizes: Story = {
  render: (args) => <>{(['sm', 'md', 'lg'] as const).map((size) => <PhoneInput {...args} key={size} size={size} label={`Phone ${size}`} />)}</>,
  play: async ({ canvas }) => {
    for (const [size, height] of [['sm', 32], ['md', 40], ['lg', 48]] as const) {
      await expect(canvas.getByRole('textbox', { name: `Phone ${size}` }).parentElement!.getBoundingClientRect().height).toBeCloseTo(height, 0);
    }
  },
};
export const Controlled: Story = {
  name: 'Keep a number draft',
  parameters: { docs: {
    description: { story: 'Keep number, country and picker state in your application as the number is edited.' },
    source: { language: 'tsx', code: `import { useState } from 'react';
import { PhoneInput, type PhoneCountryCode } from '@jfrader/ui';

export function ContactPhone() {
  const [value, setValue] = useState('');
  const [country, setCountry] = useState<PhoneCountryCode | null>('GB');
  const [open, setOpen] = useState(false);
  return <PhoneInput label="Phone number" locale="en-GB" defaultCountry="GB"
    value={value} onValueChange={setValue} country={country}
    onCountryChange={setCountry} open={open} onOpenChange={setOpen} />;
}` },
  } },
  render: (args) => <ControlledExample {...args} />, args: { onValueChange: fn(), onChange: fn() },
  play: async ({ canvas, userEvent, args }) => {
    const input = canvas.getByRole('textbox');
    await userEvent.type(input, '02079460018');
    await expect(input).toHaveValue('020 7946 0018');
    await expect(args.onValueChange).toHaveBeenLastCalledWith('+442079460018', expect.objectContaining({ valid: true, country: 'GB' }));
    await expect(args.onChange).toHaveBeenCalledTimes(11);
    await expect(args.onValueChange).toHaveBeenCalledTimes(11);
  },
};
export const CountryControlled: Story = { render: (args) => <CountryExample {...args} /> };
export const InternationalPaste: Story = {
  name: 'Paste an international number',
  parameters: { docs: {
    description: { story: 'Paste +44 20 7946 0018 to select the United Kingdom and apply national formatting.' },
    source: { language: 'tsx', code: `import { PhoneInput } from '@jfrader/ui';

<PhoneInput label="Phone number" defaultCountry={null} locale="en-GB" />` },
  } },
  args: { defaultCountry: null, onValueChange: fn(), onCountryChange: fn(), onPaste: fn() },
  play: async ({ canvas, userEvent, args }) => {
    const input = canvas.getByRole('textbox');
    await userEvent.click(input);
    await userEvent.paste('+44');
    await expect(args.onValueChange).toHaveBeenLastCalledWith('+44', expect.objectContaining({ status: 'incomplete', valid: false }));
    await userEvent.clear(input);
    await userEvent.paste('+44 20 7946 0018');
    await expect(input).toHaveValue('020 7946 0018');
    await expect(args.onCountryChange).toHaveBeenLastCalledWith('GB');
    await expect(args.onPaste).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('+442079460018', expect.objectContaining({ valid: true }));
  },
};
/** Restrict the picker to countries accepted by your service. */
export const Restricted: Story = {
  name: 'Limit available countries',
  parameters: { docs: {
    description: { story: 'Choose from the United Kingdom, Ireland and France, with the United Kingdom suggested first.' },
    source: { language: 'tsx', code: `import { PhoneInput } from '@jfrader/ui';

<PhoneInput label="Phone number" defaultCountry="GB" locale="en-GB"
  countries={['GB', 'IE', 'FR']} preferredCountries={['GB']} />` },
  } },
  args: { countries: ['GB', 'IE', 'FR'], preferredCountries: ['GB'] },
};
/** Suggested countries appear once, before the remaining countries. */
export const Preferred: Story = {
  args: { preferredCountries: ['IE', 'GB', 'IE'], defaultOpen: true }, tags: ['!autodocs'],
  play: async ({ canvasElement }) => {
    const page = portal(canvasElement);
    await settleMotion(page.getByRole('dialog', { name: 'Countries' }));
    await expect(page.getAllByRole('option', { name: /United Kingdom/ })).toHaveLength(1);
    await expect(page.getByRole('group', { name: 'Suggested countries' })).toBeVisible();
  },
};
export const NoCountry: Story = {
  name: 'Start without a country',
  parameters: { docs: {
    description: { story: 'Choose a country explicitly or paste an international number to begin.' },
    source: { language: 'tsx', code: `import { PhoneInput } from '@jfrader/ui';

<PhoneInput label="Phone number" defaultCountry={null} locale="en-GB"
  description="Choose a country or paste an international number." />` },
  } },
  args: { defaultCountry: null, description: 'Choose a country or paste an international number.' },
};
export const EmptyCountries: Story = { args: { countries: [], defaultCountry: null, defaultOpen: true }, tags: ['!autodocs'],
  play: async ({ canvasElement }) => {
    await settleMotion(portal(canvasElement).getByRole('dialog', { name: 'Countries' }));
    await expect(portal(canvasElement).getByText('No countries found')).toBeVisible();
    await expect(portal(canvasElement).getByRole('combobox')).not.toHaveAttribute('aria-activedescendant');
  },
};
export const Disabled: Story = { args: { disabled: true, defaultValue: '+442079460018', name: 'phone' }, render: (args) => <ResetExample {...args} />,
  name: 'Disabled number',
  parameters: { docs: {
    description: { story: 'Show a disabled number that is omitted from form submission.' },
    source: { language: 'tsx', code: `import { PhoneInput, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Form = styled.form({ display: 'grid', gap: vars.space[3] });
const Action = styled.button({ font: 'inherit', color: vars.color.text,
  backgroundColor: vars.color.surfaceRaised, border: \`1px solid \${vars.color.borderControl}\`,
  borderRadius: vars.radius.sm, minBlockSize: vars.space[8], paddingInline: vars.space[3] });

<Form aria-label="Contact">
  <PhoneInput label="Phone number" locale="en-GB" defaultCountry="GB"
    defaultValue="+442079460018" name="phone" disabled />
  <Action type="reset">Reset</Action>
</Form>` },
  } },
  play: async ({ canvas }) => { await expect(new FormData(canvas.getByRole('form', { name: 'Contact' }) as HTMLFormElement).has('phone')).toBe(false); },
};
export const ReadOnly: Story = {
  name: 'Read-only number',
  parameters: { docs: {
    description: { story: 'Keep an existing number readable without allowing changes.' },
    source: { language: 'tsx', code: `import { PhoneInput } from '@jfrader/ui';

<PhoneInput label="Phone number" defaultCountry="GB" locale="en-GB"
  defaultValue="+442079460018" readOnly />` },
  } },
  args: { readOnly: true, defaultValue: '+442079460018' },
};
export const Required: Story = {
  name: 'Required number',
  parameters: { docs: {
    description: { story: 'Require a nonempty number before form submission; validate the number separately.' },
    source: { language: 'tsx', code: `import { PhoneInput } from '@jfrader/ui';

<PhoneInput label="Phone number" defaultCountry="GB" locale="en-GB" required />` },
  } },
  args: { required: true }, play: async ({ canvas }) => { await expect(canvas.getByRole('textbox')).toBeRequired(); },
};
export const Error: Story = {
  name: 'Application validation feedback',
  parameters: { docs: {
    description: { story: 'Show an application error beside an incomplete number and its field description.' },
    source: { language: 'tsx', code: `import { PhoneInput } from '@jfrader/ui';

<PhoneInput label="Phone number" defaultCountry="GB" locale="en-GB"
  defaultValue="+4420" description="Include an area code." error="Check the telephone number." />` },
  } },
  args: { defaultValue: '+4420', description: 'Include an area code.', error: 'Check the telephone number.' },
};
export const BlurInvalid: Story = {
  args: { defaultValue: '+4420' },
  render: (args) => <><PhoneInput {...args} /><Action>Continue</Action></>,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('textbox'));
    await userEvent.click(canvas.getByRole('button', { name: 'Continue' }));
    await expect(canvas.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
    await expect(canvas.getByRole('alert')).toHaveTextContent('Enter a valid phone number for United Kingdom');
  },
};
export const ValidationOff: Story = { ...BlurInvalid, args: { validateOnBlur: false, defaultValue: '+4420' }, play: async ({ canvas, userEvent }) => {
  await userEvent.click(canvas.getByRole('textbox')); await userEvent.click(canvas.getByRole('button', { name: 'Continue' })); await expect(canvas.queryByRole('alert')).toBeNull();
} };
export const Valid: Story = {
  name: 'Format a stored international number',
  parameters: { docs: {
    description: { story: 'Display a stored E.164 number in national format with validity feedback.' },
    source: { language: 'tsx', code: `import { PhoneInput } from '@jfrader/ui';

<PhoneInput label="Phone number" defaultCountry="GB" locale="en-GB"
  defaultValue="+442079460018" />` },
  } },
  args: { defaultValue: '+442079460018' }, play: async ({ canvas }) => { await expect(canvas.getByRole('status')).toHaveTextContent('Valid phone number for United Kingdom'); },
};
export const HiddenLabel: Story = { args: { hideLabel: true } };
export const ExternalAria: Story = {
  args: { label: 'Phone', description: 'Include an area code.', error: 'Check this number.', 'aria-describedby': 'phone-help', 'aria-labelledby': 'phone-contact', 'aria-invalid': 'grammar' },
  render: (args) => <><Hidden id="phone-help">Contact details</Hidden><Hidden id="phone-contact">Emergency</Hidden><PhoneInput {...args} /></>,
  play: async ({ canvas }) => {
    const input = canvas.getByRole('textbox', { name: 'Emergency Phone' });
    await expect(input).toHaveAccessibleDescription('Contact details Include an area code. Check this number.');
    await expect(input).toHaveAttribute('aria-invalid', 'true');
  },
};
export const BooleanAndZeroNodes: Story = {
  render: (args) => <><PhoneInput {...args} label={0} description={0} error={0} /><PhoneInput {...args} label={false} description={false} error={false} aria-label="Other phone" /></>,
  play: async ({ canvas }) => { await expect(canvas.getByRole('textbox', { name: '0' })).toHaveAccessibleDescription('0 0'); await expect(canvas.getAllByRole('alert')).toHaveLength(1); },
};
export const PersistentOpen: Story = { args: { defaultOpen: true }, tags: ['!autodocs'], play: async ({ canvas, canvasElement }) => {
  const panel = portal(canvasElement).getByRole('dialog', { name: 'Countries' });
  await settleMotion(panel);
  const bounds = panel.getBoundingClientRect();
  const viewport = panel.ownerDocument.documentElement;
  await expect(bounds.left).toBeGreaterThanOrEqual(0);
  await expect(bounds.top).toBeGreaterThanOrEqual(0);
  await expect(bounds.right).toBeLessThanOrEqual(viewport.clientWidth);
  await expect(bounds.bottom).toBeLessThanOrEqual(viewport.clientHeight);
  await expect(bounds.width).toBeCloseTo(canvas.getByRole('textbox').parentElement!.getBoundingClientRect().width, 0);
} };
export const EmptyResults: Story = { args: { defaultOpen: true }, tags: ['!autodocs'], play: async ({ canvasElement, userEvent }) => {
  const page = portal(canvasElement); await userEvent.type(page.getByRole('combobox'), 'zzzzzz'); await expect(page.getByText('No countries found')).toBeVisible(); await expect(page.getByRole('combobox')).not.toHaveAttribute('aria-activedescendant');
} };
export const LightTheme: Story = { globals: { theme: 'light' }, decorators: [withLightTheme], args: { defaultValue: '+442079460018' } };
export const ScopedThemePortal: Story = { args: { defaultOpen: true }, tags: ['!autodocs'], render: (args) => <ThemeRoot theme="light"><ScopedSurface><PhoneInput {...args} /></ScopedSurface></ThemeRoot>, play: async ({ canvasElement }) => {
  const panel = portal(canvasElement).getByRole('listbox').closest('[data-ui="phone-input-panel"]')!;
  await expect(panel.closest('[data-theme="light"]')).not.toBeNull();
} };
export const RTL: Story = { args: { dir: 'rtl', defaultValue: '+442079460018' }, play: async ({ canvas }) => {
  const input = canvas.getByRole('textbox'); await expect(input).toHaveAttribute('dir', 'ltr'); await expect(getComputedStyle(input.closest('[data-ui="phone-input"]')!).direction).toBe('rtl');
}, name: 'Right-to-left layout', parameters: { docs: {
  description: { story: 'Place the country control in an RTL layout while keeping the number left-to-right.' },
  source: { language: 'tsx', code: `import { PhoneInput } from '@jfrader/ui';

<PhoneInput label="Phone number" defaultCountry="GB" locale="en-GB"
  defaultValue="+442079460018" dir="rtl" />` },
} } };
/** Enable Windows forced colors to check the control borders and active-option outline. */
export const ForcedColors: Story = { args: { defaultOpen: true }, tags: ['!autodocs'] };
/** Enable reduced motion to remove the picker fade. Focus and selection remain immediate. */
export const ReducedMotion: Story = { args: { defaultOpen: true }, tags: ['!autodocs'] };
export const Keyboard: Story = {
  args: { countries: ['GB', 'FR', 'IE'], onOpenChange: fn(), onCountryChange: fn(), onValueChange: fn() }, tags: ['!autodocs'],
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const page = portal(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'United Kingdom +44' });
    await userEvent.tab(); await expectFocused(trigger);
    await userEvent.keyboard('{Enter}');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    const search = page.getByRole('combobox', { name: 'Search countries' });
    await expectFocused(search);
    await expect(search).toHaveAttribute('aria-controls', page.getByRole('listbox', { name: 'Countries' }).id);
    await userEvent.keyboard('{Home}');
    const first = search.getAttribute('aria-activedescendant');
    await userEvent.keyboard('{ArrowUp}'); await expect(search).toHaveAttribute('aria-activedescendant', first!);
    await userEvent.keyboard('{PageDown}'); const last = search.getAttribute('aria-activedescendant');
    await userEvent.keyboard('{ArrowDown}{End}'); await expect(search).toHaveAttribute('aria-activedescendant', last!);
    await userEvent.keyboard('{PageUp}{ArrowDown}'); await expectFocused(search);
    await userEvent.keyboard('{Escape}'); await expectFocused(trigger);
    await userEvent.keyboard(' '); await expect(args.onOpenChange).toHaveBeenCalledTimes(3); await expectFocused(page.getByRole('combobox'));
    await userEvent.keyboard('{Home}{Enter}');
    await expectFocused(canvas.getByRole('textbox'));
    await expect(args.onCountryChange).toHaveBeenLastCalledWith('FR');
    await userEvent.keyboard('+');
    await expect(page.getByRole('combobox')).toHaveValue('+');
    await userEvent.keyboard('{Escape}');
    await userEvent.keyboard('i');
    await expect(page.getByRole('combobox')).toHaveValue('i');
    await userEvent.keyboard('{Control>}a{/Control}zzzz{Enter}');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}{ArrowUp}');
    await expectFocused(page.getByRole('combobox'));
    await userEvent.keyboard('{Tab}');
    await expect(page.queryByRole('combobox')).toBeNull();
  },
};
export const ControlledReject: Story = {
  args: { value: '+442079460018', country: 'GB', open: false, onValueChange: fn(), onCountryChange: fn(), onOpenChange: fn() },
  play: async ({ canvas, userEvent, args }) => {
    const input = canvas.getByRole('textbox');
    await userEvent.click(input); await userEvent.keyboard('{Control>}a{/Control}'); await userEvent.paste('+33 1 42 68 53 00');
    await expect(input).toHaveValue('020 7946 0018');
    await expect(args.onCountryChange).toHaveBeenLastCalledWith('FR');
    const trigger = canvas.getByRole('button', { name: 'United Kingdom +44' });
    await userEvent.click(trigger);
    await expect(trigger.ownerDocument.activeElement).toBe(trigger);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  },
};
export const RejectedCountryAndClose: Story = {
  args: { country: 'GB', value: '+442079460018', open: true, countries: ['GB', 'FR'], onCountryChange: fn(), onValueChange: fn(), onOpenChange: fn() }, tags: ['!autodocs'],
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const page = portal(canvasElement);
    const search = page.getByRole('combobox');
    await userEvent.click(search); await userEvent.keyboard('{Home}{Enter}');
    await expect(args.onCountryChange).toHaveBeenCalledTimes(1);
    await expect(args.onCountryChange).toHaveBeenCalledWith('FR');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(search.ownerDocument.activeElement).toBe(search);
    await expect(page.getByRole('option', { name: /United Kingdom/ })).toHaveAttribute('aria-selected', 'true');
    await expect(canvas.getByRole('textbox')).toHaveValue('020 7946 0018');
    await userEvent.keyboard('{Escape}'); await expect(search.ownerDocument.activeElement).toBe(search);
  },
};
export const FormReset: Story = {
  name: 'Reset a contact form',
  parameters: { docs: {
    description: { story: 'Edit the number or country, then reset both to the stored contact details.' },
    source: { language: 'tsx', code: `import { PhoneInput, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Form = styled.form({ display: 'grid', gap: vars.space[3] });
const Action = styled.button({ font: 'inherit', color: vars.color.text,
  backgroundColor: vars.color.surfaceRaised, border: \`1px solid \${vars.color.borderControl}\`,
  borderRadius: vars.radius.sm, minBlockSize: vars.space[8], paddingInline: vars.space[3] });

<Form aria-label="Contact">
  <PhoneInput label="Phone number" locale="en-GB" defaultCountry="GB"
    defaultValue="+442079460018" name="phone" />
  <Action type="reset">Reset</Action>
</Form>` },
  } },
  render: (args) => <ResetExample {...args} />, args: { defaultValue: '+442079460018', name: 'phone', onValueChange: fn(), onCountryChange: fn(), onOpenChange: fn() },
  play: async ({ canvas, userEvent, args }) => {
    const form = canvas.getByRole('form', { name: 'Contact' }) as HTMLFormElement;
    const input = canvas.getByRole('textbox');
    await userEvent.clear(input); await userEvent.paste('+33 1 42 68 53 00');
    await expect(new FormData(form).get('phone')).toBe('+33142685300');
    await userEvent.click(canvas.getByRole('button', { name: 'Reset' }));
    await expect(input).toHaveValue('020 7946 0018');
    await expect(new FormData(form).get('phone')).toBe('+442079460018');
    await expect(args.onCountryChange).toHaveBeenLastCalledWith('GB');
  },
};
export const ExternalUpdates: Story = { render: (args) => <ExternalExample {...args} />, args: { onValueChange: fn() }, play: async ({ canvas, userEvent, args }) => {
  await userEvent.click(canvas.getByRole('button', { name: 'Load contact' })); await expect(canvas.getByRole('textbox')).toHaveValue('020 7946 0018'); await expect(args.onValueChange).not.toHaveBeenCalled();
} };
export const Editing: Story = {
  args: { defaultCountry: 'US', defaultValue: '+12025550123', onValueChange: fn() },
  play: async ({ canvas, userEvent, args }) => {
    const input = canvas.getByRole('textbox') as HTMLInputElement;
    await userEvent.click(input);
    input.setSelectionRange(5, 5);
    await userEvent.keyboard('{Backspace}');
    await expect(args.onValueChange).toHaveBeenLastCalledWith('+1205550123', expect.anything());
    await expect(input.selectionStart).toBe(3);
    fireEvent.change(input, { target: { value: '(202) 555-0123' } });
    input.setSelectionRange(9, 9);
    await userEvent.keyboard('{Delete}');
    await expect(args.onValueChange).toHaveBeenLastCalledWith('+1202555123', expect.anything());
    await userEvent.clear(input); await userEvent.paste('+120255501231234567890');
    await expect(args.onValueChange).toHaveBeenLastCalledWith('+120255501231234567890', expect.objectContaining({ status: 'invalid' }));
    const accepted = input.value;
    await userEvent.paste(' ext 12');
    await expect(input).toHaveValue(accepted);
    await expect(canvas.getByRole('alert')).toBeVisible();
  },
};
export const CountryMismatch: Story = { args: { country: 'GB', defaultValue: '+33142685300' }, play: async ({ canvas }) => { await expect(canvas.getByRole('textbox')).toHaveValue('+33 1 42 68 53 00'); await expect(canvas.getByRole('status')).not.toHaveTextContent('Valid'); } };
export const SharedCallingCode: Story = { args: { defaultCountry: null, onCountryChange: fn(), onValueChange: fn() }, play: async ({ canvas, userEvent, args }) => {
  const input = canvas.getByRole('textbox'); await userEvent.click(input); await userEvent.paste('+1'); await expect(args.onCountryChange).not.toHaveBeenCalled(); await expect(args.onValueChange).toHaveBeenLastCalledWith('+1', expect.objectContaining({ country: null, valid: false }));
  await userEvent.clear(input); await userEvent.paste('+1 416 555 0123'); await expect(args.onCountryChange).toHaveBeenLastCalledWith('CA');
} };
const selectionCountry = fn();
const selectionValue = fn();
const selectionOpen = fn();
export const CountrySelectionOrder: Story = {
  args: { defaultCountry: null, defaultValue: '+33142685300', countries: ['FR', 'GB'], onCountryChange: selectionCountry, onValueChange: selectionValue, onOpenChange: selectionOpen },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button'));
    await userEvent.type(portal(canvasElement).getByRole('combobox'), 'United');
    await userEvent.keyboard('{Enter}');
    await expect(args.onCountryChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith('+44142685300', expect.objectContaining({ country: 'GB' }));
    const countryOrder = selectionCountry.mock.invocationCallOrder[0]!;
    const valueOrder = selectionValue.mock.invocationCallOrder[0]!;
    const closeOrder = selectionOpen.mock.invocationCallOrder[1]!;
    await expect(countryOrder).toBeLessThan(valueOrder);
    await expect(valueOrder).toBeLessThan(closeOrder);
  },
};
export const ControlledOpenArrow: Story = {
  args: { open: false, country: null, value: '', onOpenChange: fn() },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    const trigger = canvas.getByRole('button');
    await userEvent.keyboard('{ArrowDown}');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(trigger.ownerDocument.activeElement).toBe(trigger);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(canvas.getByRole('textbox')).toHaveValue('');
  },
};
export const RangeAndMiddleEditing: Story = {
  args: { defaultCountry: 'US', defaultValue: '+12025550123', onValueChange: fn() },
  play: async ({ canvas, userEvent, args }) => {
    const input = canvas.getByRole('textbox') as HTMLInputElement;
    await userEvent.click(input);
    input.setSelectionRange(6, 9);
    await userEvent.keyboard('6');
    await expect(args.onValueChange).toHaveBeenLastCalledWith('+120260123', expect.anything());
    await expect(input.selectionStart).toBe(7);
    input.setSelectionRange(7, 7);
    await userEvent.keyboard('7');
    await expect(args.onValueChange).toHaveBeenLastCalledWith('+1202670123', expect.anything());
    await expect(input.selectionStart).toBe(8);
  },
};
export const UnsupportedNumbers: Story = {
  args: { defaultCountry: null, onValueChange: fn() },
  play: async ({ canvas, userEvent, args }) => {
    const input = canvas.getByRole('textbox');
    await userEvent.click(input); await userEvent.paste('+800');
    await expect(input).toHaveValue(''); await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.paste('+44 20 7946 0018 ext 12');
    await expect(input).toHaveValue(''); await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.paste('+٤٤٢٠٧٩٤٦٠٠١٨');
    await expect(args.onValueChange).toHaveBeenCalledWith('+442079460018', expect.objectContaining({ valid: true }));
  },
};
export const ControlledCaret: Story = { ...RangeAndMiddleEditing, render: (args) => <ControlledExample {...args} /> };
export const ExternalInvalid: Story = { args: { 'aria-invalid': 'grammar' }, play: async ({ canvas }) => { await expect(canvas.getByRole('textbox')).toHaveAttribute('aria-invalid', 'grammar'); } };
export const OutsideAndBackwardTab: Story = {
  args: { countries: ['GB', 'FR'] }, tags: ['!autodocs'],
  render: (args) => <><Action>Before phone</Action><PhoneInput {...args} /><Action>After phone</Action></>,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: 'United Kingdom +44' });
    await userEvent.click(trigger);
    await expect(portal(canvasElement).getByRole('combobox').ownerDocument.activeElement).toBe(portal(canvasElement).getByRole('combobox'));
    await userEvent.tab({ shift: true });
    await expect(portal(canvasElement).queryByRole('combobox')).toBeNull();
    await expect(trigger.ownerDocument.activeElement).toBe(canvas.getByRole('textbox'));
    await userEvent.click(trigger);
    await userEvent.click(canvas.getByRole('button', { name: 'After phone' }));
    await expect(portal(canvasElement).queryByRole('combobox')).toBeNull();
    await expect(trigger.ownerDocument.activeElement).toBe(canvas.getByRole('button', { name: 'After phone' }));
  },
};

export const CountrySearch: Story = {
  name: 'Search countries and calling codes',
  args: { preferredCountries: ['IE', 'GB'] },
  parameters: { docs: {
    description: { story: 'Open the country picker and search by country name or calling code.' },
    source: { language: 'tsx', code: `import { PhoneInput } from '@jfrader/ui';

<PhoneInput label="Phone number" defaultCountry="GB" locale="en-GB"
  preferredCountries={['IE', 'GB']} />` },
  } },
};

export const Incomplete: Story = {
  name: 'Continue an incomplete number',
  args: { defaultValue: '+4420' },
  parameters: { docs: {
    description: { story: 'Continue editing an incomplete national number, then leave the field to check validity.' },
    source: { language: 'tsx', code: `import { PhoneInput } from '@jfrader/ui';

<PhoneInput label="Phone number" defaultCountry="GB" locale="en-GB" defaultValue="+4420" />` },
  } },
};

export const KeyboardNavigation: Story = {
  name: 'Choose a country with the keyboard',
  args: { countries: ['GB', 'FR', 'IE'] },
  parameters: { docs: {
    description: { story: 'Tab to the country button, open with Enter, move with arrows and select with Enter.' },
    source: { language: 'tsx', code: `import { PhoneInput } from '@jfrader/ui';

<PhoneInput label="Phone number" defaultCountry="GB" locale="en-GB"
  countries={['GB', 'FR', 'IE']} />` },
  } },
};
