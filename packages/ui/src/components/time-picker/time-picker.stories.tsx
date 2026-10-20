import { act, useState } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, spyOn, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { Button } from '../button';
import { ThemeRoot } from '../theme-root';
import { TimePicker, type TimePickerProps, type TimePickerMinuteStep } from './index';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';

const LightThemeFrame = styled.div({ backgroundColor: vars.color.bg, padding: vars.space[4] });

const ExampleGrid = styled.div({ display: 'grid', gap: vars.space[4] });

export const LocaleHydration: Story = {
  tags: ['!autodocs'],
  args: { locale: undefined },
  play: async ({ canvasElement }) => {
    const language = spyOn(navigator, 'language', 'get').mockReturnValue('en-US');
    const host = canvasElement.ownerDocument.createElement('div');
    canvasElement.append(host);
    const onRecoverableError = fn();
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      const element = <TimePicker label="Hydrated time" defaultValue="09:00" />;
      const server = renderToString(element);
      language.mockReturnValue('de-DE');
      await expect(renderToString(element)).toBe(server);
      host.innerHTML = server;
      await act(async () => {
        root = hydrateRoot(host, element, { onRecoverableError });
      });
      await expect(onRecoverableError).not.toHaveBeenCalled();
      await expect(within(host).getByRole('combobox')).toHaveTextContent('9:00 AM');
    } finally {
      await act(async () => root?.unmount());
      host.remove();
      language.mockRestore();
    }
  },
};

const meta = {
  title: 'Inputs/TimePicker',
  component: TimePicker,
  tags: ['autodocs'],
  args: {
    label: 'Start time',
    locale: 'en-GB',
    onValueChange: fn(),
    onOpenChange: fn(),
  },
  parameters: {
    docs: {
      description: {
        component:
          'Choose a time of day, stored as HH:mm.',
      },
      usage: `- Pair with DatePicker and resolve the timestamp, time zone and daylight-saving changes in your app.
- Supply \`locale\` for matching server and client output.
- Values between steps display without rounding. \`minuteStep=1\` mounts all 1,440 options; measure performance before using it across many fields.
- \`required\` is announced to assistive technology. The hidden field does not enforce browser constraint validation.
- Check screen readers, forced colors and reduced motion manually.

### Dial presentation
- Set \`presentation="dial"\` to drag a 24-hour face. Release to select the nearest available time and close; cancelling a gesture leaves the value unchanged.
- The dial is a pointer-only enhancement, hidden from assistive technology with \`aria-hidden\`. The parallel listbox and its options stay visible and exposed to screen readers; focus remains on the combobox trigger through \`aria-activedescendant\`.
- Use the same keyboard keys with either presentation, including in RTL; the clock runs clockwise.
- Values remain civil HH:mm. Dates, time-zone comparisons, DST conversion and working-hour bands belong to the app.

### Keyboard
- Focus stays on the Select trigger. Arrows wrap, Home and End jump, and typing searches.
- Enter or Space selects. Escape or Tab closes.`,
      source: {
        code: '<TimePicker label="Start time" locale="en-GB" minuteStep={30}\n  value={time} onValueChange={setTime} placeholder="Choose a time" />',
      },
    },
  },
} satisfies Meta<typeof TimePicker>;
export default meta;
type Story = StoryObj<typeof meta>;
const body = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body);
const active = (trigger: HTMLElement) =>
  trigger.ownerDocument.getElementById(trigger.getAttribute('aria-activedescendant') ?? '');
async function expectActive(trigger: HTMLElement, time: string) {
  await waitFor(async () => {
    await expect(active(trigger)).toHaveAttribute('data-time', time);
    await expect(active(trigger)).toHaveAttribute('data-active');
  });
  await expect(trigger.ownerDocument.activeElement).toBe(trigger);
}
async function closed(canvasElement: HTMLElement) {
  await waitFor(async () => {
    await expect(body(canvasElement).queryByRole('listbox')).toBeNull();
  });
}
const format = (value: string, locale = 'en-GB', hourCycle?: 'h12' | 'h23') =>
  new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
    ...(hourCycle ? { hourCycle } : {}),
  }).format(new Date(`2000-01-01T${value}:00Z`));

export const Default: Story = {
  play: async ({ canvas, args, userEvent, canvasElement }) => {
    const trigger = canvas.getByRole('combobox', { name: 'Start time' });
    await expect(trigger).toHaveTextContent(format('09:00'));
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onOpenChange).not.toHaveBeenCalled();
    await userEvent.click(trigger);
    const popup = await body(canvasElement).findByRole('listbox', {
      name: 'Start time',
    });
    await expect(trigger).toHaveAttribute('aria-controls', popup.id);
    await expect(within(popup).getAllByRole('option')).toHaveLength(96);
    await userEvent.click(within(popup).getByRole('option', { name: format('10:00') }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('10:00');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await expect(args.onOpenChange).toHaveBeenNthCalledWith(1, true);
    await expect(args.onOpenChange).toHaveBeenNthCalledWith(2, false);
    await expect(trigger.ownerDocument.activeElement).toBe(trigger);
    await expect(trigger).toHaveTextContent(format('10:00'));
    await closed(canvasElement);
  },
};
export const Empty: Story = {
  args: { value: '', placeholder: 'Choose a time' },
  play: async ({ canvas, args, userEvent, canvasElement }) => {
    const trigger = canvas.getByRole('combobox');
    await expect(trigger).toHaveTextContent('Choose a time');
    await userEvent.tab();
    await userEvent.keyboard('{ArrowUp}');
    await expectActive(trigger, '23:45');
    await userEvent.keyboard('{Escape}');
    await closed(canvasElement);
    await userEvent.keyboard('{ArrowDown}');
    await expectActive(trigger, '00:00');
    await userEvent.keyboard('{Escape}');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(trigger).toHaveTextContent('Choose a time');
  },
};
function ControlledExample(args: TimePickerProps) {
  const [value, setValue] = useState('09:00');
  const [open, setOpen] = useState(false);
  return (
    <>
      <TimePicker
        {...args}
        value={value}
        open={open}
        onValueChange={(next) => {
          setValue(next);
          args.onValueChange?.(next);
        }}
        onOpenChange={(next) => {
          setOpen(next);
          args.onOpenChange?.(next);
        }}
      />
      <Button onClick={() => setValue('12:00')}>Set noon</Button>
    </>
  );
}
export const Controlled: Story = {
  render: (args) => <ControlledExample {...args} />,
  play: async ({ canvas, args, userEvent, canvasElement }) => {
    const trigger = canvas.getByRole('combobox');
    await userEvent.click(trigger);
    await userEvent.click(await body(canvasElement).findByRole('option', { name: format('10:00') }));
    await expect(trigger).toHaveTextContent(format('10:00'));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('10:00');
    await userEvent.click(canvas.getByRole('button', { name: 'Set noon' }));
    await expect(trigger).toHaveTextContent(format('12:00'));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
  },
};
const steps: TimePickerMinuteStep[] = [1, 5, 10, 15, 30];
export const EveryStep: Story = {
  render: (args) => (
    <ExampleGrid>
      {steps.map((minuteStep) => (
        <TimePicker
          {...args}
          key={minuteStep}
          minuteStep={minuteStep}
          label={`Every ${minuteStep} minutes`}
        />
      ))}
    </ExampleGrid>
  ),
  play: async ({ canvas, userEvent, canvasElement }) => {
    for (const [index, trigger] of canvas.getAllByRole('combobox').entries()) {
      const step = steps[index]!;
      await userEvent.click(trigger);
      const popup = await body(canvasElement).findByRole('listbox');
      const options = within(popup).getAllByRole('option');
      await expect(options).toHaveLength(1440 / step);
      await expect(options[0]).toHaveAttribute('data-time', '00:00');
      await expect(options.at(-1)).toHaveAttribute('data-time', `23:${String(60 - step).padStart(2, '0')}`);
      await expect(popup.querySelector('[data-time="24:00"]')).toBeNull();
      await userEvent.keyboard('{Escape}');
    }
  },
};
export const Hour12: Story = {
  tags: ['!autodocs'],
  args: { hourCycle: 'h12', defaultOpen: true },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole('combobox')).toHaveTextContent(format('09:00', 'en-GB', 'h12'));
    await expect(
      await body(canvasElement).findByRole('option', {
        name: format('00:00', 'en-GB', 'h12'),
      }),
    ).toHaveAttribute('data-time', '00:00');
  },
};
export const Hour24: Story = {
  args: { hourCycle: 'h23' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('combobox')).toHaveTextContent(format('09:00', 'en-GB', 'h23'));
  },
};
export const LocaleDefault: Story = {
  tags: ['!autodocs'],
  args: { locale: 'ar-EG', defaultOpen: true },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole('combobox')).toHaveTextContent(format('09:00', 'ar-EG'));
    await expect(
      await body(canvasElement).findByRole('option', {
        name: format('23:45', 'ar-EG'),
      }),
    ).toHaveAttribute('data-time', '23:45');
  },
};
export const Sizes: Story = {
  render: (args) => (
    <ExampleGrid>
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <TimePicker {...args} key={size} size={size} label={`Start time ${size}`} />
      ))}
    </ExampleGrid>
  ),
  play: async ({ canvas }) => {
    for (const [index, trigger] of canvas.getAllByRole('combobox').entries())
      await expect(trigger.getBoundingClientRect().height).toBeGreaterThanOrEqual([32, 40, 48][index]!);
  },
};
export const OffStepValue: Story = {
  args: { defaultValue: '09:07' },
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    const trigger = canvas.getByRole('combobox');
    await expect(trigger).toHaveTextContent(format('09:07'));
    await userEvent.click(trigger);
    await expectActive(trigger, '09:15');
    const popup = body(canvasElement).getByRole('listbox');
    await expect(popup.querySelector('[aria-selected="true"]')).toBeNull();
    await userEvent.keyboard('{Escape}');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(trigger).toHaveTextContent(format('09:07'));
  },
};
export const OffStepTypeahead: Story = {
  args: { defaultValue: '09:07' },
  play: async ({ canvas, args, userEvent }) => {
    const trigger = canvas.getByRole('combobox');
    await userEvent.tab();
    await userEvent.keyboard('7');
    await expectActive(trigger, '07:00');
    await expect(trigger).toHaveTextContent(format('09:07'));
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
  },
};
export const InvalidValue: Story = {
  render: (args) => (
    <ExampleGrid>
      {['24:00', '09:60', '9:00', 'invalid'].map((value) => (
        <TimePicker {...args} key={value} value={value} label={`Time ${value}`} placeholder="Choose a time" />
      ))}
    </ExampleGrid>
  ),
  play: async ({ canvas, args }) => {
    for (const trigger of canvas.getAllByRole('combobox')) {
      await expect(trigger).toHaveAttribute('aria-invalid', 'true');
      await expect(trigger).toHaveTextContent('Choose a time');
    }
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const Bounds: Story = {
  args: { min: '09:07', max: '10:05', defaultValue: '09:07' },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByRole('combobox');
    await userEvent.click(trigger);
    await expectActive(trigger, '09:15');
    const options = body(canvasElement).getAllByRole('option');
    await expect(options).toHaveLength(4);
    await expect(options.at(-1)).toHaveAttribute('data-time', '10:00');
    await new Promise<void>((resolve) => trigger.ownerDocument.defaultView!.requestAnimationFrame(() => resolve()));
    await userEvent.keyboard('{Home}');
    await expectActive(trigger, '09:15');
    await userEvent.keyboard('{ArrowUp}');
    await expectActive(trigger, '10:00');
    await userEvent.keyboard('{Escape}');
  },
};
export const EmptyBounds: Story = {
  args: { min: '12:00', max: '09:00' },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const trigger = canvas.getByRole('combobox');
    await expect(trigger).toHaveAttribute('aria-invalid', 'true');
    await userEvent.click(trigger);
    await userEvent.keyboard('{Enter}{ArrowDown}');
    await expect(trigger).not.toHaveAttribute('aria-activedescendant');
    await closed(canvasElement);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onOpenChange).not.toHaveBeenCalled();
  },
};
export const Disabled: Story = {
  tags: ['!autodocs'],
  args: { disabled: true, open: true },
  play: async ({ canvas, canvasElement, args }) => {
    await expect(canvas.getByRole('combobox')).toBeDisabled();
    await closed(canvasElement);
    await expect(args.onOpenChange).not.toHaveBeenCalled();
  },
};
export const ReadOnly: Story = {
  tags: ['!autodocs'],
  args: { readOnly: true, open: true },
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    const trigger = canvas.getByRole('combobox');
    await userEvent.tab();
    await expect(trigger.ownerDocument.activeElement).toBe(trigger);
    await expect(trigger).toHaveAttribute('aria-readonly', 'true');
    await userEvent.keyboard('{Enter}{ArrowDown}');
    await userEvent.click(trigger);
    await closed(canvasElement);
    await expect(args.onOpenChange).not.toHaveBeenCalled();
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const Required: Story = {
  args: { required: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('combobox')).toHaveAttribute('aria-required', 'true');
  },
};
export const Error: Story = {
  args: {
    error: 'Choose a time during opening hours',
    description: 'Opening hours: 09:00–17:00',
  },
};
export const FalsyLabel: Story = {
  render: (args) => (
    <ExampleGrid>
      {[false, null, 0, ''].map((node, index) => (
        <TimePicker
          {...args}
          key={index}
          label={node}
          description={node}
          error={node}
          icon={node}
          placeholder={node}
          value=""
          aria-label={`Time ${index}`}
        />
      ))}
    </ExampleGrid>
  ),
  play: async ({ canvas }) => {
    for (const [index, trigger] of canvas.getAllByRole('combobox').entries()) {
      const root = trigger.closest('[data-ui="time-picker"]')!;
      const renders = index >= 2;
      await expect(root.querySelector('label') !== null).toBe(renders);
      await expect(root.querySelector('[role="alert"]') !== null).toBe(renders);
      await expect(root.querySelector('[aria-hidden="true"]')?.textContent).toBe(
        renders ? (index === 2 ? '0' : '') : '▾',
      );
      if (renders) {
        const ids = trigger.getAttribute('aria-describedby')!.split(' ');
        await expect(ids).toHaveLength(2);
        for (const id of ids) await expect(trigger.ownerDocument.getElementById(id)).not.toBeNull();
      } else {
        await expect(trigger).not.toHaveAttribute('aria-describedby');
        await expect(trigger).not.toHaveAttribute('aria-labelledby');
      }
    }
  },
};
export const RTL: Story = {
  args: { dir: 'rtl', locale: 'ar-EG' },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByRole('combobox');
    await userEvent.tab();
    await userEvent.keyboard('{ArrowDown}{ArrowUp}');
    await expectActive(trigger, '08:45');
    await expect(getComputedStyle(trigger).direction).toBe('rtl');
    await expect(getComputedStyle(body(canvasElement).getByRole('listbox')).direction).toBe('rtl');
    await userEvent.keyboard('{Escape}');
  },
};
export const Light: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  globals: { theme: 'light' },
  decorators: [withLightTheme],
};
export const PersistentOpen: Story = { tags: ['!autodocs'], args: { open: true } };
export const OpenSelected: Story = { tags: ['!autodocs'], args: { open: true, value: '15:30' } };
export const OpenError: Story = {
  tags: ['!autodocs'],
  args: { open: true, error: 'Choose an available time' },
};
export const ThemeRootPortal: Story = {
  tags: ['!autodocs'],
  render: (args) => (
    <ThemeRoot theme="light"><LightThemeFrame>
      <TimePicker {...args} open />
    </LightThemeFrame></ThemeRoot>
  ),
  play: async ({ canvasElement }) => {
    const popup = await body(canvasElement).findByRole('listbox');
    await expect(popup.closest('[data-theme="light"]')).not.toBeNull();
  },
};
export const Keyboard: Story = {
  render: (args) => (
    <>
      <Button>Before</Button>
      <TimePicker {...args} />
      <Button>After</Button>
    </>
  ),
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const trigger = canvas.getByRole('combobox');
    await userEvent.tab();
    await userEvent.tab();
    await expect(trigger.ownerDocument.activeElement).toBe(trigger);
    await expect(getComputedStyle(trigger).outlineStyle).not.toBe('none');
    await expect(Math.abs(parseFloat(getComputedStyle(trigger).outlineWidth) - 2)).toBeLessThan(1.1);
    await userEvent.keyboard('{Enter}');
    await expectActive(trigger, '09:00');
    const pageScroll = trigger.ownerDocument.defaultView!.scrollY;
    await userEvent.keyboard('{Home}');
    await expectActive(trigger, '00:00');
    await userEvent.keyboard('{ArrowUp}');
    await expectActive(trigger, '23:45');
    await userEvent.keyboard('{ArrowDown}');
    await expectActive(trigger, '00:00');
    await userEvent.keyboard('{End}');
    await expectActive(trigger, '23:45');
    await userEvent.keyboard('9');
    await expectActive(trigger, '09:00');
    await expect(trigger.ownerDocument.defaultView!.scrollY).toBe(pageScroll);
    await userEvent.keyboard('{Escape}');
    await closed(canvasElement);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.keyboard(' ');
    await expectActive(trigger, '09:00');
    await userEvent.keyboard('{ArrowDown}');
    await expectActive(trigger, '09:15');
    await userEvent.keyboard(' ');
    await closed(canvasElement);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('09:15');
    await expect(args.onValueChange!.mock.invocationCallOrder[0]!).toBeLessThan(
      args.onOpenChange!.mock.invocationCallOrder[3]!,
    );
    await userEvent.keyboard('{Enter}{Enter}');
    await closed(canvasElement);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.tab();
    await closed(canvasElement);
    await expect(trigger.ownerDocument.activeElement).toBe(canvas.getByRole('button', { name: 'After' }));
    await userEvent.tab({ shift: true });
    await userEvent.keyboard('{ArrowUp}');
    await userEvent.tab({ shift: true });
    await closed(canvasElement);
    await expect(trigger.ownerDocument.activeElement).toBe(canvas.getByRole('button', { name: 'Before' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};
export const ControlledRejects: Story = {
  tags: ['!autodocs'],
  args: { value: '09:00', open: true },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const trigger = canvas.getByRole('combobox');
    await userEvent.click(await body(canvasElement).findByRole('option', { name: format('10:00') }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('10:00');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await expect(trigger).toHaveTextContent(format('09:00'));
    await expect(body(canvasElement).getByRole('option', { name: format('09:00') })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(body(canvasElement).getByRole('option', { name: format('10:00') })).toHaveAttribute(
      'aria-selected',
      'false',
    );
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  },
};
export const MinuteStress: Story = {
  args: { minuteStep: 1 },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByRole('combobox');
    const start = performance.now();
    await userEvent.click(trigger);
    const popup = await body(canvasElement).findByRole('listbox');
    await expect(within(popup).getAllByRole('option')).toHaveLength(1440);
    await expectActive(trigger, '09:00');
    await waitFor(async () => {
      await expect(popup.scrollTop).toBeGreaterThan(0);
    });
    await userEvent.keyboard('{End}');
    await expectActive(trigger, '23:59');
    await expect(performance.now() - start).toBeLessThan(10_000);
    await userEvent.keyboard('{Escape}');
  },
};
export const AriaComposition: Story = {
  render: (args) => (
    <>
      <span id="external-name">Schedule</span>
      <span id="external-help">Office hours</span>
      <TimePicker
        {...args}
        aria-label="Clock"
        aria-labelledby="external-name unresolved-name"
        aria-describedby="external-help unresolved-help"
        description="Choose a start"
        error="Time unavailable"
      />
      <TimePicker {...args} label="End time" />
    </>
  ),
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole('combobox', {
      name: 'Schedule Start time',
    });
    await expect(trigger).toHaveAttribute('aria-label', 'Clock');
    await expect(trigger.getAttribute('aria-labelledby')).toContain('external-name unresolved-name');
    await expect(trigger.getAttribute('aria-describedby')).toContain('external-help unresolved-help');
    await expect(trigger).toHaveAttribute('aria-invalid', 'true');
    const ids = trigger.getAttribute('aria-describedby')!.split(' ');
    await expect(ids).toHaveLength(4);
    await expect(trigger.ownerDocument.getElementById(ids[2]!)).toHaveTextContent('Choose a start');
    await expect(trigger.ownerDocument.getElementById(ids[3]!)).toHaveAttribute('role', 'alert');
    await expect(canvas.getAllByRole('combobox')[1]!.id).not.toBe(trigger.id);
  },
};
export const FormReset: Story = {
  render: (args) => (
    <form>
      <TimePicker {...args} name="time" />
      <TimePicker {...args} name="disabled-time" disabled label="Disabled time" />
      <Button type="reset">Reset</Button>
    </form>
  ),
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const trigger = canvas.getByRole('combobox', {
      name: 'Start time',
    }) as HTMLButtonElement;
    await userEvent.click(trigger);
    await userEvent.click(await body(canvasElement).findByRole('option', { name: format('10:00') }));
    await expect(new FormData(trigger.form!).get('time')).toBe('10:00');
    await expect(new FormData(trigger.form!).has('disabled-time')).toBe(false);
    await userEvent.click(canvas.getByRole('button', { name: 'Reset' }));
    await waitFor(async () => {
      await expect(trigger).toHaveTextContent(format('09:00'));
    });
    await expect(new FormData(trigger.form!).get('time')).toBe('09:00');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};
// This story tests the documented css/slot API and native style merging.
export const RefAndSlots: Story = {
  tags: ['!autodocs'],
  args: {
    ref: fn(),
    defaultOpen: true,
    slotProps: {
      control: { sx: { borderStyle: 'dashed' } },
      content: { sx: { borderStyle: 'dotted' } },
      option: { sx: { fontStyle: 'italic' } },
    },
    sx: { gap: vars.space[3] },
  },
  play: async ({ canvas, canvasElement, args }) => {
    const trigger = canvas.getByRole('combobox');
    await expect(args.ref).toHaveBeenCalledWith(trigger);
    await expect(getComputedStyle(trigger).borderStyle).toBe('dashed');
    const popup = await body(canvasElement).findByRole('listbox');
    await expect(getComputedStyle(popup).borderStyle).toBe('dotted');
    await expect(getComputedStyle(within(popup).getAllByRole('option')[0]!).fontStyle).toBe('italic');
    const expectedWidth = Math.min(
      trigger.getBoundingClientRect().width,
      trigger.ownerDocument.defaultView!.innerWidth - 16,
    );
    await waitFor(async () => {
      await expect(Math.abs(popup.getBoundingClientRect().width - expectedWidth)).toBeLessThan(1.1);
    });
  },
};
export const ControlledReset: Story = {
  args: { value: '10:00' },
  render: (args) => (
    <form>
      <TimePicker {...args} name="time" />
      <Button type="reset">Reset</Button>
    </form>
  ),
  play: async ({ canvas, args, userEvent }) => {
    const trigger = canvas.getByRole('combobox') as HTMLButtonElement;
    await userEvent.click(canvas.getByRole('button', { name: 'Reset' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('09:00');
    await expect(trigger).toHaveTextContent(format('10:00'));
    await expect(new FormData(trigger.form!).get('time')).toBe('10:00');
  },
};
export const ExternalForm: Story = {
  render: (args) => (
    <>
      <form id="time-picker-external-form" />
      <TimePicker {...args} name="time" form="time-picker-external-form" />
      <TimePicker
        {...args}
        label="End time"
        name="end-time"
        slotProps={{ control: { form: 'time-picker-external-form' } }}
      />
    </>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByRole('combobox', { name: 'Start time' }) as HTMLButtonElement;
    await expect(new FormData(trigger.form!).get('time')).toBe('09:00');
    await expect(new FormData(trigger.form!).get('end-time')).toBe('09:00');
    await userEvent.click(trigger);
    await userEvent.click(await body(canvasElement).findByRole('option', { name: format('10:00') }));
    await expect(new FormData(trigger.form!).get('time')).toBe('10:00');
    trigger.form!.reset();
    await waitFor(() => expect(new FormData(trigger.form!).get('time')).toBe('09:00'));
  },
};
export const RejectedValueAcceptedClose: Story = {
  args: { value: '09:00' },
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    const trigger = canvas.getByRole('combobox');
    await userEvent.click(trigger);
    await userEvent.click(await body(canvasElement).findByRole('option', { name: format('10:00') }));
    await closed(canvasElement);
    await expect(trigger).toHaveTextContent(format('09:00'));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('10:00');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
  },
};
export const AcceptedValueRejectedClose: Story = {
  tags: ['!autodocs'],
  args: { open: true },
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    await userEvent.click(await body(canvasElement).findByRole('option', { name: format('10:00') }));
    await expect(canvas.getByRole('combobox')).toHaveTextContent(format('10:00'));
    await expect(body(canvasElement).getByRole('option', { name: format('10:00') })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(canvas.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('10:00');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
  },
};
export const NativeVeto: Story = {
  args: {
    onClick: fn((event) => event.preventDefault()),
    onKeyDown: fn((event) => event.preventDefault()),
  },
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    const trigger = canvas.getByRole('combobox');
    await userEvent.click(trigger);
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await closed(canvasElement);
    await expect(args.onOpenChange).not.toHaveBeenCalled();
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onClick).toHaveBeenCalledTimes(1);
    await expect(args.onKeyDown).toHaveBeenCalledTimes(2);
  },
};
export const ControlledTabRejects: Story = {
  tags: ['!autodocs'],
  args: { open: true },
  render: (args) => (
    <>
      <TimePicker {...args} />
      <Button>After</Button>
    </>
  ),
  play: async ({ canvas, args, userEvent }) => {
    const trigger = canvas.getByRole('combobox');
    await userEvent.tab();
    await expect(trigger.ownerDocument.activeElement).toBe(trigger);
    await userEvent.tab();
    await expect(trigger.ownerDocument.activeElement).toBe(canvas.getByRole('button', { name: 'After' }));
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const ForcedColors: Story = {
  tags: ['!autodocs'],
  args: { open: true },
  parameters: {
    docs: {
      description: {
        story:
          'Enable forced colors to check Canvas/CanvasText borders and Highlight outlines. This story checks structure only.',
      },
    },
  },
};
export const ReducedMotion: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  parameters: {
    docs: {
      description: {
        story:
          'Enable reduced motion to check that transitions take 0s. This story checks structure only; selection and scrolling are always immediate.',
      },
    },
  },
};

const dialSnippet = '<TimePicker label="Start time" presentation="dial" locale="en-GB"\n  defaultValue="09:00" minuteStep={15} />';

/** Drag the clock face or choose a time from the list. */
export const Dial: Story = {
  args: { presentation: 'dial' },
  parameters: { docs: { source: { code: dialSnippet } } },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const trigger = canvas.getByRole('combobox');
    await userEvent.tab();
    await expect(trigger.ownerDocument.activeElement).toBe(trigger);
    await expect(getComputedStyle(trigger).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{ArrowDown}{End}{Enter}');
    await expect(trigger).toHaveTextContent(format('23:45'));
    await expect(args.onValueChange).toHaveBeenLastCalledWith('23:45');
    await userEvent.keyboard('{ArrowDown}{Home}{Enter}');
    await expect(trigger).toHaveTextContent(format('00:00'));
    await userEvent.click(trigger);
    const dial = canvasElement.ownerDocument.querySelector<HTMLElement>('[data-ui="time-picker-dial"]')!;
    await expect(dial).toBeVisible();
    await expect(dial).toHaveAttribute('aria-hidden', 'true');
    const panel = body(canvasElement).getByRole('listbox');
    await expect(panel).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-controls', panel.id);
    await expect(within(panel).getAllByRole('option')).toHaveLength(96);
    await userEvent.keyboard('{ArrowDown}');
    await expectActive(trigger, '00:15');
    await expect(active(trigger)).toBeVisible();
    await expect(dial).toBeVisible();
    await expect(dial.getBoundingClientRect().left).toBeGreaterThanOrEqual(panel.getBoundingClientRect().left);
    await expect(dial.getBoundingClientRect().right).toBeLessThanOrEqual(panel.getBoundingClientRect().right);
    await userEvent.keyboard('{Escape}');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  },
};
export const DialLight: Story = {
  ...Dial,
  decorators: [withLightTheme],
  globals: { theme: 'light' },
};
/** Enable reduced motion: the hand snaps without a spring. */
export const DialReducedMotion: Story = {
  args: { presentation: 'dial', defaultOpen: true },
  tags: ['!autodocs'],
  parameters: { docs: { source: { code: dialSnippet } } },
  play: async ({ canvas, userEvent }) => {
    await expect(window.matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(true);
    const trigger = canvas.getByRole('combobox');
    await userEvent.tab();
    await userEvent.keyboard('{End}{Enter}');
    await expect(trigger).toHaveTextContent(format('23:45'));
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  },
};
export const DialRTL: Story = {
  ...Dial,
  args: { presentation: 'dial', dir: 'rtl' },
};
export const DialControlledGesture: Story = {
  args: { presentation: 'dial', value: '09:00', open: true, min: '06:00', max: '18:00' },
  tags: ['!autodocs'],
  parameters: { docs: { source: { code: '<TimePicker label="Start time" presentation="dial" locale="en-GB"\n  value={time} onValueChange={setTime} min="06:00" max="18:00" />' } } },
  play: async ({ canvas, canvasElement, args }) => {
    const dial = canvasElement.ownerDocument.querySelector<HTMLElement>('[data-ui="time-picker-dial"]')!;
    const capture = spyOn(dial, 'setPointerCapture').mockImplementation(() => {});
    const release = spyOn(dial, 'releasePointerCapture').mockImplementation(() => {});
    const rect = dial.getBoundingClientRect();
    const point = { pointerId: 1, button: 0, clientX: rect.left + rect.width / 2, clientY: rect.bottom };
    try {
      fireEvent.pointerDown(dial, point);
      fireEvent.pointerMove(dial, point);
      await expect(dial.querySelector('[data-ui="time-picker-dial-readout"]')).toHaveTextContent(format('12:00'));
      await expect(args.onValueChange).not.toHaveBeenCalled();
      fireEvent.pointerCancel(dial, point);
      await expect(within(dial).getByText(format('09:00'))).toBeVisible();
      await expect(args.onValueChange).not.toHaveBeenCalled();
      fireEvent.pointerDown(dial, point);
      fireEvent.pointerUp(dial, point);
      await expect(args.onValueChange).toHaveBeenCalledTimes(1);
      await expect(args.onValueChange).toHaveBeenLastCalledWith('12:00');
      await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
      await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
      await expect(canvas.getByRole('combobox')).toHaveTextContent(format('09:00'));
      await expect(canvas.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true');
      await expect(within(dial).getByText(format('09:00'))).toBeVisible();
    } finally {
      capture.mockRestore();
      release.mockRestore();
    }
  },
};
export const DialMidnightGesture: Story = {
  args: { presentation: 'dial', value: '09:00', open: true },
  tags: ['!autodocs'],
  parameters: { docs: { source: { code: dialSnippet } } },
  play: async ({ canvasElement, args }) => {
    const dial = canvasElement.ownerDocument.querySelector<HTMLElement>('[data-ui="time-picker-dial"]')!;
    const readout = dial.querySelector('[data-ui="time-picker-dial-readout"]');
    const capture = spyOn(dial, 'setPointerCapture').mockImplementation(() => {});
    const release = spyOn(dial, 'releasePointerCapture').mockImplementation(() => {});
    const rect = dial.getBoundingClientRect();
    const point = { pointerId: 1, button: 0, clientX: rect.left + rect.width / 2 - 1, clientY: rect.top };
    try {
      fireEvent.pointerDown(dial, point);
      await expect(readout).toHaveTextContent(format('00:00'));
      await expect(args.onValueChange).not.toHaveBeenCalled();
      fireEvent.pointerUp(dial, point);
      await expect(args.onValueChange).toHaveBeenCalledTimes(1);
      await expect(args.onValueChange).toHaveBeenLastCalledWith('00:00');
      await expect(readout).toHaveTextContent(format('09:00'));
    } finally {
      capture.mockRestore();
      release.mockRestore();
    }
  },
};
export const DialOpenLight: Story = {
  args: { presentation: 'dial', defaultOpen: true },
  decorators: [withLightTheme],
  globals: { theme: 'light' },
  tags: ['!autodocs'],
  parameters: { docs: { source: { code: dialSnippet } } },
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab();
    await expectActive(canvas.getByRole('combobox'), '09:00');
  },
};
