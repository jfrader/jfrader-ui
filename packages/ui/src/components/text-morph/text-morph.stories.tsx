import { StrictMode, useState, type ComponentPropsWithRef } from 'react';
import { MotionConfig } from 'motion/react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, spyOn, waitFor } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '../../styling/styled';
import { settleMotion } from '../../testing/motion-assertions';
import { withLightTheme } from '../../testing/story-decorators';
import { Button } from '../button';
import { TextMorph, type TextMorphProps, type TextMorphPartProps } from './index';
import { resolveReelEase } from './reel';

const Row = styled.div({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[4],
});
const Column = styled.div({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'start',
  gap: vars.space[4],
});
const Headline = styled.h2({
  margin: 0,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize['3xl'],
  fontWeight: vars.fontWeight.semibold,
});
const LargeText = styled(TextMorph)({ fontSize: vars.textSize['3xl'] });
const Narrow = styled.div({ maxInlineSize: '12em' });
const FontFrame = styled.div({
  fontSize: vars.textSize.md,
  '&[data-large="true"]': { fontSize: vars.textSize['3xl'] },
});

const meta = {
  title: 'Data display/TextMorph',
  component: TextMorph,
  tags: ['autodocs'],
  args: { children: 'Save' },
  parameters: {
    docs: {
      description: {
        component:
          'Animate short labels with shared letters, rolling slots, or sand particles. Keep the surrounding button, heading or status in your own markup.',
      },
      usage: `**Values**

Pass a string as children, or a string/number through value. Text is caller-owned: there is no editable state or defaultValue/onValueChange pair. Numbers use Intl.NumberFormat; pass the same locale during SSR and hydration. Empty strings and zero are valid.

**Variants**

auto matches Latin graphemes and uses a whole-label crossfade when either the current or previous text needs joining-script shaping or RTL. A Latin label following shaped or RTL text may therefore crossfade as a whole label. glyph forces segmentation. crossfade preserves browser shaping. slot rolls localized numeric digits and replaces other graphemes vertically; RTL and complex strings keep whole-label shaping. SandText and SlotText are variants, not separate exports.

Use variant="sand" for decorative short headings. The real text stays visible and selectable beneath the transient grains. sand configures intro, interactive, grainSize, interactionRadius, maxCells, maxPixelRatio and onRenderFallback. Pointer effects do not handle touch gestures. Reduced motion, forced colors, pause and canvas failure leave static text.

**Keyboard and announcements**

Text has no APG widget pattern, keyboard commands or focus target. Use Button for activation. All decoration is aria-hidden; the complete current label updates immediately. Set announce only for unsolicited updates, or supply aria-live on the root. A root live policy suppresses the inner live region. Empty button labels need another accessible name.

**Customization and limits**

component is shorthand for slots.root; slots.root wins. Replace root, text, frame, glyph or canvas with adapters that forward props/ref and className. slotProps accepts native props and css; root sx applies last. In crossfade the glyph slot wraps the whole label; in slot it repeats across wheel cells. Semantics belong in wrappers, not replacement element tricks.

Short, single-line text only. More than 80 graphemes uses whole-label decoration. Slot durationMs is clamped to 0–2000ms, staggerMs to 0–160ms with a 400ms total cap, and spins to 0–3. Numeric wheels retarget from their current fractional position. Use paused to stop decoration. Sand has fixed allocation and 900ms settling budgets; oversize text falls back to real text. No timers, paragraph animation, particle library or editable-text behavior.`,
      source: { code: "<TextMorph>{saved ? 'Saved' : 'Save'}</TextMorph>", language: 'tsx' },
    },
  },
} satisfies Meta<typeof TextMorph>;
export default meta;
type Story = StoryObj<typeof meta>;

function label(element: HTMLElement) {
  return element.querySelector<HTMLElement>('[data-ui="text-morph-text"]')!;
}
function root(element: HTMLElement) {
  return element.querySelector<HTMLElement>('[data-ui~="text-morph"]')!;
}
function LabelDemo({ onClick, value: _value, ...props }: TextMorphProps) {
  const [saved, setSaved] = useState(false);
  return (
    <Row>
      <Button
        onClick={(event) => {
          onClick?.(event);
          setSaved(!saved);
        }}
      >
        <TextMorph {...props}>{saved ? 'Saved' : 'Save'}</TextMorph>
      </Button>
      <Button variant="outline">Next</Button>
    </Row>
  );
}
function SwapDemo({
  labels,
  ...props
}: Omit<TextMorphProps, 'children' | 'value'> & { labels: readonly string[] }) {
  const [index, setIndex] = useState(0);
  return (
    <Column>
      <TextMorph {...props}>{labels[index % labels.length]!}</TextMorph>
      <Button onClick={() => setIndex(index + 1)}>Change text</Button>
    </Column>
  );
}
function NumberDemo() {
  const [index, setIndex] = useState(0);
  const values = [99, 1000, 90, 0];
  return (
    <Row>
      <TextMorph
        variant="slot"
        value={values[index % values.length]!}
        locale="en-US"
        formatOptions={{ style: 'currency', currency: 'USD', maximumFractionDigits: 0 }}
      />
      <Button onClick={() => setIndex(index + 1)}>Change price</Button>
    </Row>
  );
}
function FamilyDemo() {
  const [next, setNext] = useState(false);
  const [paused, setPaused] = useState(false);
  return (
    <Column>
      <Row>
        <TextMorph paused={paused}>{next ? 'Following' : 'Follow'}</TextMorph>
        <TextMorph variant="slot" value={next ? 2027 : 2026} locale="en-US" paused={paused} />
        <Headline>
          <TextMorph variant="sand" paused={paused}>
            {next ? 'Dawn' : 'Dunes'}
          </TextMorph>
        </Headline>
      </Row>
      <Row>
        <Button onClick={() => setNext(!next)}>Change labels</Button>
        <Button variant="outline" onClick={() => setPaused(!paused)}>
          {paused ? 'Resume' : 'Pause'}
        </Button>
      </Row>
    </Column>
  );
}

/** Press Save to change the button's label. */
export const Default: Story = {
  args: { onClick: fn() },
  render: (args) => <LabelDemo {...args} />,
  parameters: {
    docs: {
      source: {
        code: "<Button onClick={save}><TextMorph>{saved ? 'Saved' : 'Save'}</TextMorph></Button>",
      },
    },
  },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const button = canvas.getByRole('button', { name: 'Save' });
    await userEvent.click(button);
    await expect(button).toHaveAccessibleName('Saved');
    await expect(label(canvasElement)).toHaveTextContent('Saved');
    await expect(args.onClick).toHaveBeenCalledTimes(1);
    await expect(root(canvasElement)).not.toHaveAttribute('aria-live');
    await expect(canvasElement.querySelector('[data-ui="text-morph-frame"]')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    await expect(getComputedStyle(label(canvasElement)).userSelect).toBe('text');
  },
};

/** Change the three labels together; Pause stops every decoration. */
export const FamilyOverview: Story = {
  render: () => <FamilyDemo />,
  parameters: {
    docs: {
      source: {
        code: `<TextMorph>{following ? 'Following' : 'Follow'}</TextMorph>
<TextMorph variant="slot" value={year} locale="en-US" />
<h2><TextMorph variant="sand" paused={paused}>Dunes</TextMorph></h2>`,
      },
    },
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Change labels' }));
    await expect(canvas.getByRole('heading', { name: 'Dawn' })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Pause' }));
    await expect(canvasElement.querySelector('[data-ui="text-morph-canvas"]')).toBeNull();
    await expect(canvasElement.querySelector('[data-ui="text-morph-frame"]')).toBeNull();
  },
};

/** The same family on a light surface. */
export const Light: Story = {
  ...FamilyOverview,
  globals: { theme: 'light' },
  decorators: [withLightTheme],
};

/** Repeated letter occurrences keep independent identities. */
export const RepeatedLetters: Story = {
  render: () => <SwapDemo variant="glyph" labels={['letter', 'better', 'letter']} />,
  parameters: { docs: { source: { code: '<TextMorph variant="glyph">{label}</TextMorph>' } } },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const letters = Array.from(
      canvasElement.querySelectorAll('[data-ui="text-morph-glyph"]'),
    ).filter((glyph) => glyph.textContent === 't');
    await expect(letters).toHaveLength(2);
    await userEvent.click(canvas.getByRole('button', { name: 'Change text' }));
    await expect(letters[0]).toBeInTheDocument();
    await expect(letters[1]).toBeInTheDocument();
    await expect(label(canvasElement)).toHaveTextContent('better');
  },
};

/** Arabic and mixed scripts keep the browser's whole-label shaping. */
export const JoiningScript: Story = {
  render: () => <SwapDemo dir="rtl" labels={['مرحبا', 'أهلا بالعالم']} />,
  parameters: { docs: { source: { code: '<TextMorph dir="rtl">مرحبا</TextMorph>' } } },
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(canvasElement.querySelectorAll('[data-ui="text-morph-glyph"]')).toHaveLength(1),
    );
    await expect(root(canvasElement)).toHaveAttribute('dir', 'rtl');
  },
};

/** Emoji and combining marks remain whole graphemes. */
export const Graphemes: Story = {
  args: { children: 'é👩🏽‍💻', variant: 'glyph' },
  parameters: { docs: { source: { code: '<TextMorph variant="glyph">é👩🏽‍💻</TextMorph>' } } },
  play: async ({ canvasElement }) => {
    const cells = canvasElement.querySelectorAll('[data-ui="text-morph-glyph"]');
    await expect(cells).toHaveLength(2);
    await expect(cells[1]).toHaveTextContent('👩🏽‍💻');
  },
};

/** Keep complete labels together during a fade. */
export const Crossfade: Story = {
  render: () => <SwapDemo variant="crossfade" labels={['Open', 'Close']} />,
  parameters: { docs: { source: { code: '<TextMorph variant="crossfade">{label}</TextMorph>' } } },
};

/** Currency formatting and rising or falling digit wheels. */
export const Slot: Story = {
  render: () => <NumberDemo />,
  parameters: {
    docs: {
      source: {
        code: '<TextMorph variant="slot" value={price} locale="en-US" formatOptions={{ style: \'currency\', currency: \'USD\', maximumFractionDigits: 0 }} />',
      },
    },
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await expect(label(canvasElement)).toHaveTextContent('$99');
    await expect(resolveReelEase('cubic-bezier(0.2, -0.5, 0.8, 1)')).toEqual([0.2, -0.5, 0.8, 1]);
    for (const easing of ['ease', 'linear', 'cubic-bezier(0, , 1, 1)', 'cubic-bezier(2, 0, 1, 1)']) {
      await expect(resolveReelEase(easing)).toBe('linear');
    }
    await userEvent.click(canvas.getByRole('button', { name: 'Change price' }));
    await expect(label(canvasElement)).toHaveTextContent('$1,000');
    await expect(canvasElement.querySelector('[data-direction="up"]')).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Change price' }));
    await expect(label(canvasElement)).toHaveTextContent('$90');
    await expect(canvasElement.querySelector('[data-direction="down"]')).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Change price' }));
    await expect(label(canvasElement)).toHaveTextContent('$0');
  },
};

/** Words use the same slot variant without an alphabet dataset. */
export const SlotWords: Story = {
  render: () => <SwapDemo variant="slot" labels={['Start', 'Ready', 'Go']} />,
  parameters: { docs: { source: { code: '<TextMorph variant="slot">{label}</TextMorph>' } } },
};

/** Localized digits, grouping and separators come from Intl. */
export const LocalizedNumber: Story = {
  args: {
    children: undefined,
    variant: 'slot',
    value: -1234.5,
    locale: 'ar-EG',
    dir: 'rtl',
    formatOptions: { style: 'currency', currency: 'EGP' },
  },
  parameters: {
    docs: {
      source: {
        code: '<TextMorph variant="slot" value={-1234.5} locale="ar-EG" dir="rtl" formatOptions={{ style: \'currency\', currency: \'EGP\' }} />',
      },
    },
  },
  play: async ({ canvasElement }) => {
    await expect(label(canvasElement).textContent).toBe(
      new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP' }).format(-1234.5),
    );
  },
};

/** An explicit formatter overrides built-in numeric formatting. */
export const CustomFormat: Story = {
  args: {
    children: undefined,
    value: 0,
    variant: 'slot',
    format: (value) => new Intl.NumberFormat('en-US', { style: 'percent' }).format(value),
  },
  parameters: {
    docs: {
      source: {
        code: "<TextMorph variant=\"slot\" value={ratio} format={value => new Intl.NumberFormat('en-US', { style: 'percent' }).format(value)} />",
      },
    },
  },
  play: async ({ canvasElement }) => {
    await expect(label(canvasElement).textContent).toBe('0%');
  },
};

/** Sand grains follow the heading's resolved font and color. */
export const Sand: Story = {
  render: () => (
    <Headline>
      <TextMorph variant="sand">Dunes</TextMorph>
    </Headline>
  ),
  parameters: {
    docs: { source: { code: '<h2><TextMorph variant="sand">Dunes</TextMorph></h2>' } },
  },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole('heading', { name: 'Dunes' })).toBeVisible();
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-ui="text-morph-canvas"]')).toHaveAttribute(
        'aria-hidden',
        'true',
      ),
    );
    await expect(getComputedStyle(label(canvasElement)).color).not.toBe('rgba(0, 0, 0, 0)');
    const selection = canvasElement.ownerDocument.getSelection()!;
    const range = canvasElement.ownerDocument.createRange();
    range.selectNodeContents(label(canvasElement));
    selection.removeAllRanges();
    selection.addRange(range);
    await expect(selection.toString()).toBe('Dunes');
    selection.removeAllRanges();
  },
};

/** The heading stays readable when canvas is unavailable. */
export const CanvasUnavailable: Story = {
  tags: ['!autodocs'],
  args: { sand: { onRenderFallback: fn() } },
  beforeEach: () => {
    const mocked = spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    return () => mocked.mockRestore();
  },
  render: (args) => (
    <Headline>
      <TextMorph variant="sand" sand={args.sand}>
        Dunes
      </TextMorph>
    </Headline>
  ),
  play: async ({ canvasElement, args }) => {
    await expect(label(canvasElement)).toHaveTextContent('Dunes');
    await expect(getComputedStyle(label(canvasElement)).color).not.toBe('rgba(0, 0, 0, 0)');
    await waitFor(() => expect(args.sand?.onRenderFallback).toHaveBeenCalledWith('canvas'));
    await expect(args.sand?.onRenderFallback).toHaveBeenCalledTimes(1);
  },
};

/** Stop particles and label transitions without changing the content. */
export const Paused: Story = {
  args: { variant: 'sand', paused: true, children: 'Still' },
  parameters: { docs: { source: { code: '<TextMorph variant="sand" paused>Still</TextMorph>' } } },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('canvas')).toBeNull();
  },
};

/** All variants show the latest static label under reduced motion. */
export const ReducedMotion: Story = {
  decorators: [
    (Story) => (
      <MotionConfig reducedMotion="always">
        <Story />
      </MotionConfig>
    ),
  ],
  render: () => <FamilyDemo />,
  parameters: {
    docs: {
      source: {
        code: '<MotionConfig reducedMotion="always"><TextMorph variant="slot" value={2026} /></MotionConfig>',
      },
    },
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Change labels' }));
    await expect(canvasElement.querySelector('[data-ui="text-morph-frame"]')).toBeNull();
    await expect(canvasElement.querySelector('canvas')).toBeNull();
    for (const text of canvasElement.querySelectorAll<HTMLElement>('[data-ui="text-morph-text"]')) {
      await expect(getComputedStyle(text).position).toBe('static');
      await expect(getComputedStyle(text).color).not.toBe('rgba(0, 0, 0, 0)');
    }
  },
};

/** The full current text is the only live announcement. */
export const Announce: Story = {
  args: { announce: true, children: 'Upload complete' },
  parameters: { docs: { source: { code: '<TextMorph announce>Upload complete</TextMorph>' } } },
  play: async ({ canvasElement }) => {
    await expect(label(canvasElement)).toHaveAttribute('aria-live', 'polite');
    await expect(label(canvasElement)).toHaveAttribute('aria-atomic', 'true');
  },
};

/** A root live policy takes precedence over announce. */
export const ExternalLiveRegion: Story = {
  args: { 'aria-live': 'off', announce: true, children: 'Complete' },
  parameters: {
    docs: { source: { code: '<TextMorph aria-live="off" announce>Complete</TextMorph>' } },
  },
  play: async ({ canvasElement }) => {
    await expect(root(canvasElement)).toHaveAttribute('aria-live', 'off');
    await expect(label(canvasElement)).not.toHaveAttribute('aria-live');
  },
};

/** Text does not add a focus stop or intercept button keys. */
export const KeyboardComposition: Story = {
  ...Default,
  args: { onClick: fn() },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const button = canvas.getByRole('button', { name: 'Save' });
    await userEvent.tab();
    await expect(button.ownerDocument.activeElement).toBe(button);
    await expect(getComputedStyle(button).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{Enter}');
    await expect(button).toHaveAccessibleName('Saved');
    await userEvent.keyboard(' ');
    await expect(button).toHaveAccessibleName('Save');
    await expect(args.onClick).toHaveBeenCalledTimes(2);
    await userEvent.tab();
    await expect(button.ownerDocument.activeElement).toBe(
      canvas.getByRole('button', { name: 'Next' }),
    );
    await userEvent.tab({ shift: true });
    await expect(button.ownerDocument.activeElement).toBe(button);
    await expect(root(canvasElement)).not.toHaveAttribute('tabindex');
  },
};

/** A refused parent update leaves the label unchanged. */
export const ParentRejectsChange: Story = {
  args: { onClick: fn() },
  render: (args) => (
    <Button onClick={args.onClick}>
      <TextMorph>Save</TextMorph>
    </Button>
  ),
  parameters: {
    docs: {
      source: { code: '<Button onClick={requestSave}><TextMorph>Save</TextMorph></Button>' },
    },
  },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    await expect(args.onClick).toHaveBeenCalledTimes(1);
    await expect(label(canvasElement)).toHaveTextContent('Save');
  },
};

/** Rapid updates end at the latest label and intrinsic width. */
export const InterruptedWidth: Story = {
  render: () => <SwapDemo labels={['A', 'Following', 'Go', '']} />,
  parameters: { docs: { source: { code: '<TextMorph>{label}</TextMorph>' } } },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const button = canvas.getByRole('button', { name: 'Change text' });
    await userEvent.click(button);
    await userEvent.click(button);
    await expect(label(canvasElement)).toHaveTextContent('Go');
    await waitFor(() =>
      expect(
        Math.abs(
          root(canvasElement).getBoundingClientRect().width -
            label(canvasElement).getBoundingClientRect().width,
        ),
      ).toBeLessThan(1),
    );
    await userEvent.click(button);
    await expect(label(canvasElement).textContent).toBe('');
    await waitFor(() => expect(root(canvasElement).getBoundingClientRect().width).toBeLessThan(1));
  },
};

/** Sand keeps real text under constrained and invalid geometry budgets. */
export const SandBudget: Story = {
  render: () => (
    <Narrow>
      <LargeText
        variant="sand"
        sand={{ maxCells: 1, maxPixelRatio: Infinity, grainSize: NaN, interactionRadius: -1 }}
      >
        Bounded
      </LargeText>
    </Narrow>
  ),
  parameters: {
    docs: {
      source: {
        code: '<TextMorph variant="sand" sand={{ maxCells: 1000, maxPixelRatio: 1 }}>Bounded</TextMorph>',
      },
    },
  },
  play: async ({ canvasElement }) => {
    await expect(label(canvasElement)).toHaveTextContent('Bounded');
    await waitFor(() => expect(canvasElement.querySelector('canvas')).not.toBeNull());
    const canvas = canvasElement.querySelector('canvas')!;
    await expect(canvas.width * canvas.height).toBeLessThanOrEqual(1048576);
  },
};

function ReplacementRoot(props: TextMorphPartProps) {
  return <span {...props} data-replaced-root="" />;
}
function ReplacementText(props: TextMorphPartProps) {
  return <span {...props} data-replaced-text="" />;
}
function ReplacementFrame(props: TextMorphPartProps) {
  return <span {...props} data-replaced-frame="" />;
}
function ReplacementGlyph(props: TextMorphPartProps) {
  return <span {...props} data-replaced-glyph="" />;
}
function ReplacementCanvas(props: ComponentPropsWithRef<'canvas'>) {
  return <canvas {...props} data-replaced-canvas="" />;
}
/** Replace anatomy while keeping the family styles and ref target. */
export const ReplacementSlots: Story = {
  render: () => (
    <StrictMode>
      <Row>
        <TextMorph
          component={ReplacementText}
          slots={{
            root: ReplacementRoot,
            text: ReplacementText,
            frame: ReplacementFrame,
            glyph: ReplacementGlyph,
          }}
          slotProps={{
            root: { title: 'Root slot', css: { fontWeight: vars.fontWeight.medium } },
            glyph: { title: 'Glyph slot' },
          }}
          sx={{ fontWeight: vars.fontWeight.semibold }}
        >
          Save
        </TextMorph>
        <TextMorph variant="sand" slots={{ canvas: ReplacementCanvas }}>
          Sand
        </TextMorph>
      </Row>
    </StrictMode>
  ),
  parameters: {
    docs: {
      source: {
        code: "<TextMorph slots={{ root: LabelRoot, text: LabelText }} slotProps={{ root: { title: 'Save status' } }} sx={{ fontWeight: theme.fontWeight.semibold }}>Save</TextMorph>",
      },
    },
  },
  play: async ({ canvasElement }) => {
    const first = root(canvasElement);
    await expect(first).toHaveAttribute('data-replaced-root');
    await expect(first).not.toHaveAttribute('data-replaced-text');
    await expect(first).toHaveAttribute('title', 'Root slot');
    await expect(label(canvasElement)).toHaveAttribute('data-replaced-text');
    await expect(first.querySelector('[data-replaced-frame]')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    await expect(first.querySelector('[data-replaced-glyph]')).toHaveAttribute(
      'title',
      'Glyph slot',
    );
    await expect(getComputedStyle(first).fontWeight).toBe('600');
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-replaced-canvas]')).toHaveAttribute(
        'aria-hidden',
        'true',
      ),
    );
  },
};

function FontDemo() {
  const [large, setLarge] = useState(false);
  return (
    <Column>
      <FontFrame data-large={large}>
        <TextMorph>Following</TextMorph>
      </FontFrame>
      <Button onClick={() => setLarge(!large)}>Change font</Button>
    </Column>
  );
}
/** Font changes remeasure the current label without replaying an entrance. */
export const FontResize: Story = {
  render: () => <FontDemo />,
  parameters: {
    docs: {
      source: {
        code: "<TextMorph sx={{ fontSize: large ? theme.textSize['3xl'] : theme.textSize.md }}>Following</TextMorph>",
      },
    },
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const before = root(canvasElement).getBoundingClientRect().width;
    const glyph = canvasElement.querySelector('[data-ui="text-morph-glyph"]');
    await userEvent.click(canvas.getByRole('button', { name: 'Change font' }));
    await waitFor(() =>
      expect(root(canvasElement).getBoundingClientRect().width).toBeGreaterThan(before),
    );
    // The width spring settles asynchronously; a frame-cadence race must not read a mid-flight width.
    await settleMotion(canvasElement);
    await waitFor(() =>
      expect(
        Math.abs(
          root(canvasElement).getBoundingClientRect().width -
            label(canvasElement).getBoundingClientRect().width,
        ),
      ).toBeLessThan(1),
    );
    await expect(glyph).toBeInTheDocument();
  },
};

function RefDemo({ ref }: Pick<TextMorphProps, 'ref'>) {
  const [visible, setVisible] = useState(true);
  return (
    <StrictMode>
      <Column>
        {visible && (
          <TextMorph
            ref={ref}
            slotProps={{
              root: {
                ref: (element) => {
                  if (!element) return;
                  element.dataset.slotAttached = 'true';
                  return () => {
                    element.dataset.slotAttached = 'false';
                  };
                },
              },
            }}
          >
            Save
          </TextMorph>
        )}
        <Button onClick={() => setVisible(!visible)}>Toggle label</Button>
      </Column>
    </StrictMode>
  );
}
/** Root refs preserve React 19 cleanup through StrictMode and removal. */
export const RootRefCleanup: Story = {
  args: {
    ref: fn((element: HTMLSpanElement | null) => {
      if (!element) return;
      element.dataset.attached = 'true';
      return () => {
        element.dataset.attached = 'false';
      };
    }),
  },
  render: (args) => <RefDemo ref={args.ref} />,
  parameters: { docs: { source: { code: '<TextMorph ref={labelRef}>Save</TextMorph>' } } },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const element = root(canvasElement);
    await expect(element.tagName).toBe('SPAN');
    await expect(element).toHaveAttribute('data-attached', 'true');
    await expect(element).toHaveAttribute('data-slot-attached', 'true');
    await userEvent.click(canvas.getByRole('button', { name: 'Toggle label' }));
    await expect(element).toHaveAttribute('data-attached', 'false');
    await expect(element).toHaveAttribute('data-slot-attached', 'false');
    await expect(element).not.toBeInTheDocument();
  },
};

function ReduceDemo() {
  const [next, setNext] = useState(false);
  const [reduced, setReduced] = useState(false);
  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'user'}>
      <Row>
        <TextMorph variant="slot" value={next ? 1000 : 99} locale="en-US" />
        <Button onClick={() => setNext(!next)}>Change number</Button>
        <Button onClick={() => setReduced(true)}>Reduce motion</Button>
      </Row>
    </MotionConfig>
  );
}
/** Reducing motion during a roll immediately removes the wheel cells. */
export const ReduceDuringFlight: Story = {
  render: () => <ReduceDemo />,
  parameters: {
    docs: {
      source: {
        code: '<MotionConfig reducedMotion={reduced ? \'always\' : \'user\'}><TextMorph variant="slot" value={value} locale="en-US" /></MotionConfig>',
      },
    },
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Change number' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Reduce motion' }));
    await expect(label(canvasElement).textContent).toBe('1,000');
    await expect(canvasElement.querySelector('[data-ui="text-morph-reel"]')).toBeNull();
    await expect(getComputedStyle(label(canvasElement)).position).toBe('static');
  },
};

/** Nonfinite numbers remain literal, unfragmented Intl output. */
export const NonfiniteNumber: Story = {
  args: { children: undefined, value: NaN, variant: 'slot', locale: 'en-US' },
  parameters: {
    docs: { source: { code: '<TextMorph variant="slot" value={NaN} locale="en-US" />' } },
  },
  play: async ({ canvasElement }) => {
    await expect(label(canvasElement).textContent).toBe(new Intl.NumberFormat('en-US').format(NaN));
    await expect(canvasElement.querySelector('[data-ui="text-morph-reel"]')).toBeNull();
    await expect(canvasElement.querySelectorAll('[data-ui="text-morph-glyph"]')).toHaveLength(1);
  },
};

function FormattingDemo() {
  const [german, setGerman] = useState(false);
  return (
    <Row>
      <TextMorph variant="slot" value={1234.5} locale={german ? 'de-DE' : 'en-US'} />
      <Button onClick={() => setGerman(!german)}>Change locale</Button>
    </Row>
  );
}
/** Formatting-only changes settle the new separators and digits without a numeric roll. */
export const FormattingChange: Story = {
  render: () => <FormattingDemo />,
  parameters: {
    docs: { source: { code: '<TextMorph variant="slot" value={1234.5} locale={locale} />' } },
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const previousReel = canvasElement.querySelector('[data-ui="text-morph-reel"]');
    await userEvent.click(canvas.getByRole('button', { name: 'Change locale' }));
    await expect(label(canvasElement).textContent).toBe(
      new Intl.NumberFormat('de-DE').format(1234.5),
    );
    await expect(previousReel).not.toBeInTheDocument();
  },
};

/** Native ARIA and root attributes flow through replacement props. */
export const NativeAria: Story = {
  args: {
    id: 'text-morph-example',
    'aria-label': 'Save status',
    'aria-describedby': 'text-morph-description',
    title: 'Original title',
    slotProps: { root: { title: 'Slot title', 'data-ui': 'custom-label text-morph' } },
  },
  render: (args) => (
    <Column>
      <TextMorph {...args} />
      <span id="text-morph-description">Saved locally</span>
    </Column>
  ),
  parameters: {
    docs: {
      source: {
        code: '<TextMorph aria-label="Save status" aria-describedby="save-description">Save</TextMorph>',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const element = root(canvasElement);
    await expect(element).toHaveAttribute('id', 'text-morph-example');
    await expect(element).toHaveAttribute('aria-label', 'Save status');
    await expect(element).toHaveAttribute('aria-describedby', 'text-morph-description');
    await expect(element).toHaveAttribute('title', 'Slot title');
    await expect(element).toHaveAttribute('data-ui', 'text-morph custom-label');
  },
};

/** Currency names remain shaped, non-spinning Intl parts beside the digit wheels. */
export const LocalizedAffixes: Story = {
  args: {
    children: undefined,
    value: 1234.5,
    variant: 'slot',
    locale: 'ar-SA',
    dir: 'ltr',
    formatOptions: { style: 'currency', currency: 'SAR', currencyDisplay: 'name' },
  },
  parameters: {
    docs: {
      source: {
        code: "<TextMorph variant=\"slot\" value={1234.5} locale=\"ar-SA\" formatOptions={{ style: 'currency', currency: 'SAR', currencyDisplay: 'name' }} />",
      },
    },
  },
  play: async ({ canvasElement }) => {
    const formatter = new Intl.NumberFormat('ar-SA', {
      style: 'currency',
      currency: 'SAR',
      currencyDisplay: 'name',
    });
    const currency = formatter.formatToParts(1234.5).find((part) => part.type === 'currency')!;
    const currencyGlyph = Array.from(
      canvasElement.querySelectorAll('[data-ui="text-morph-glyph"]'),
    ).find((glyph) => glyph.textContent === currency.value);
    await expect(currencyGlyph).toBeInTheDocument();
    await expect(currencyGlyph?.parentElement).toHaveAttribute('data-ui', 'text-morph-track');
    await expect(label(canvasElement).textContent).toBe(formatter.format(1234.5));
  },
};
