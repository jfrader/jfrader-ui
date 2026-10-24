import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '../../styling/styled';
import { withLightTheme } from '../../testing/story-decorators';
import { Flex } from '../flex';
import { sceneSource } from '../scene';
import { StatusDot, type StatusDotSize, type StatusDotStatus } from './index';
import { expectPulseCycle, expectPulseFromDot, expectPulseHiddenForMedia, mediaRules } from './status-dot-assertions';

const STATUSES = ['online', 'away', 'busy', 'offline', 'neutral'] as const satisfies readonly StatusDotStatus[];
const PRESENCE = ['online', 'away', 'busy', 'offline'] as const satisfies readonly StatusDotStatus[];
const SIZES = ['sm', 'md', 'lg'] as const satisfies readonly StatusDotSize[];
const SIZE_PX = { sm: 8, md: 12, lg: 16 } as const;
const LABELS: Record<StatusDotStatus, string> = {
  online: 'Online',
  away: 'Away',
  busy: 'Busy',
  offline: 'Offline',
  neutral: 'Unknown',
};

const PresenceRow = styled('span')({
  display: 'inline-flex',
  alignItems: 'center',
  gap: vars.space[2],
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  color: vars.color.text,
});

const PhotoFrame = styled('span')({ position: 'relative', display: 'inline-block' });

const Photo = styled('img')({
  display: 'block',
  inlineSize: `calc(${vars.space[12]} * 3)`,
  blockSize: `calc(${vars.space[12]} * 2)`,
  borderRadius: vars.radius.md,
  objectFit: 'cover',
});

const PhotoDot = styled(StatusDot)({
  position: 'absolute',
  insetBlockStart: vars.space[2],
  insetInlineEnd: vars.space[2],
});

const meta = {
  title: 'Data display/StatusDot',
  component: StatusDot,
  parameters: {
    docs: {
      description: { component: 'Show presence or a state as a small dot, with an optional pulse.' },
      sections: [
        { title: 'Basic', stories: ['Default'] },
        { title: 'Naming', stories: ['Standalone'] },
        { title: 'Glyphs and color', stories: ['Glyphs', 'CustomColor'] },
        { title: 'Shape and size', stories: ['Variants', 'Sizes'] },
        { title: 'Pulse', stories: ['Pulse'] },
        { title: 'Over an image', stories: ['OverImage'] },
      ],
      usage: `### When to use
Show whether a person, device, or service is online, away, busy, or offline. Use Avatar's \`status\` for a person's portrait, Badge for counts, and Pill for a written status.

### Keyboard and accessibility

- Pair every dot with words. Next to visible text, or inside a named parent such as Avatar, set \`decorative\`. When the dot is the only cue, set \`label\`.
- Online, away, busy, and offline each draw a different glyph (solid, crescent, bar, hollow), so they also read in forced colors and for people who cannot tell the colors apart. \`neutral\` and \`color\` change only the color: show their meaning as text.
- The dot is not a live region. Announce changes that need attention with a separate status message.
- Reduced motion and forced colors hide the pulse ring; the dot stays.

### Customization

- \`color\` takes a color token name, for example \`info\`. The status glyph stays.
- The outline and glyph cut-outs use \`--status-dot-surface\`, which defaults to the \`bg\` token. Set it through \`sx\` when the dot sits on another surface: \`sx={{ '--status-dot-surface': vars.color.surface }}\`.`,
    },
  },
  args: { status: 'online', label: 'Online', size: 'md', variant: 'dot', pulse: false },
  argTypes: {
    status: { control: 'select', options: STATUSES },
    size: { control: 'radio', options: SIZES },
    variant: { control: 'radio', options: ['dot', 'square'] },
  },
} satisfies Meta<typeof StatusDot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Presence with text',
  parameters: { docs: {
    description: { story: 'Set `decorative` when visible text names the state.' },
    source: { language: 'tsx', code: `import { Flex, StatusDot, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const PresenceRow = styled('span')({ display: 'inline-flex', alignItems: 'center', gap: vars.space[2] });

<Flex direction="column" gap="sm">
  <PresenceRow><StatusDot status="online" decorative />Online</PresenceRow>
  <PresenceRow><StatusDot status="away" decorative />Away</PresenceRow>
  <PresenceRow><StatusDot status="busy" decorative />Busy</PresenceRow>
  <PresenceRow><StatusDot status="offline" decorative />Offline</PresenceRow>
</Flex>` },
  } },
  render: () => (
    <Flex direction="column" gap="sm">
      {PRESENCE.map((status) => (
        <PresenceRow key={status}><StatusDot status={status} decorative />{LABELS[status]}</PresenceRow>
      ))}
    </Flex>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryAllByRole('img')).toHaveLength(0);
    for (const status of PRESENCE) {
      const dot = canvasElement.querySelector<HTMLElement>(`[data-ui="status-dot"][data-status="${status}"]`)!;
      await expect(dot).toHaveAttribute('aria-hidden', 'true');
      await expect(dot).not.toHaveAttribute('role');
      await expect(dot.parentElement).toHaveTextContent(LABELS[status]);
    }
  },
};

export const Standalone: Story = {
  name: 'Dot as the only cue',
  parameters: { docs: {
    description: { story: 'Set `label` when nothing else names the state.' },
    source: { language: 'tsx', code: `import { StatusDot } from '@jfrader/ui';

<StatusDot status="busy" label="Busy" />` },
  } },
  args: { status: 'busy', label: 'Busy' },
  play: async ({ canvasElement }) => {
    const dot = within(canvasElement).getByRole('img', { name: 'Busy' });
    await expect(dot).toHaveAttribute('data-ui', 'status-dot');
    await expect(dot).not.toHaveAttribute('aria-hidden');
    await expect(dot.tabIndex).toBe(-1);
  },
};

export const Glyphs: Story = {
  name: 'Status glyphs',
  parameters: { docs: {
    description: { story: 'Compare the solid, crescent, bar, and hollow glyphs, and the neutral dot.' },
    source: { language: 'tsx', code: `import { Flex, StatusDot } from '@jfrader/ui';

<Flex align="center" gap="md">
  <StatusDot status="online" label="Online" size="lg" />
  <StatusDot status="away" label="Away" size="lg" />
  <StatusDot status="busy" label="Busy" size="lg" />
  <StatusDot status="offline" label="Offline" size="lg" />
  <StatusDot status="neutral" label="Unknown" size="lg" />
</Flex>` },
  } },
  render: () => (
    <Flex align="center" gap="md">
      {STATUSES.map((status) => <StatusDot key={status} status={status} label={LABELS[status]} size="lg" />)}
    </Flex>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const glyphs = new Set<string>();
    for (const status of PRESENCE) {
      const dot = canvas.getByRole('img', { name: LABELS[status] });
      glyphs.add(getComputedStyle(dot).backgroundImage);
    }
    // Four presence statuses, four different glyphs: removing one glyph leaves color as the only cue.
    await expect(glyphs.size).toBe(PRESENCE.length);
    await expect(getComputedStyle(canvas.getByRole('img', { name: 'Online' })).backgroundImage).toBe('none');
    const tones = new Set(STATUSES.map((status) =>
      getComputedStyle(canvas.getByRole('img', { name: LABELS[status] })).getPropertyValue('--status-dot-tone').trim()));
    await expect(tones.size).toBe(STATUSES.length);
  },
};

export const CustomColor: Story = {
  name: 'Token color',
  parameters: { docs: {
    description: { story: 'Pass a color token name to `color`; keep the meaning in visible text.' },
    source: { language: 'tsx', code: `import { StatusDot, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const PresenceRow = styled('span')({ display: 'inline-flex', alignItems: 'center', gap: vars.space[2] });

<PresenceRow><StatusDot color="info" decorative />Syncing</PresenceRow>` },
  } },
  render: () => (
    <Flex direction="column" gap="sm">
      <PresenceRow><StatusDot color="info" decorative />Syncing</PresenceRow>
      <PresenceRow><StatusDot status="busy" color="accent" decorative />Recording</PresenceRow>
    </Flex>
  ),
  play: async ({ canvasElement }) => {
    const [info, accent] = canvasElement.querySelectorAll<HTMLElement>('[data-ui="status-dot"]');
    const probe = canvasElement.ownerDocument.createElement('span');
    canvasElement.append(probe);
    try {
      probe.style.backgroundColor = vars.color.info;
      await expect(getComputedStyle(info!).backgroundColor).toBe(getComputedStyle(probe).backgroundColor);
      probe.style.backgroundColor = vars.color.accent;
      await expect(getComputedStyle(accent!).backgroundImage).toContain('linear-gradient');
      await expect(getComputedStyle(accent!).backgroundColor).toBe(getComputedStyle(probe).backgroundColor);
    } finally { probe.remove(); }
  },
};

export const Variants: Story = {
  name: 'Dot and square',
  parameters: { docs: {
    description: { story: 'Use the square for devices, bots, or services beside round people.' },
    source: { language: 'tsx', code: `import { Flex, StatusDot } from '@jfrader/ui';

<Flex align="center" gap="md">
  <StatusDot status="online" label="Online" />
  <StatusDot status="online" label="Service online" variant="square" />
  <StatusDot status="busy" label="Service busy" variant="square" />
</Flex>` },
  } },
  render: () => (
    <Flex align="center" gap="md">
      <StatusDot status="online" label="Online" />
      <StatusDot status="online" label="Service online" variant="square" />
      <StatusDot status="busy" label="Service busy" variant="square" />
    </Flex>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const round = canvas.getByRole('img', { name: 'Online' });
    const square = canvas.getByRole('img', { name: 'Service online' });
    await expect(Number.parseFloat(getComputedStyle(square).borderTopLeftRadius)).toBe(SIZE_PX.md / 4);
    await expect(Number.parseFloat(getComputedStyle(round).borderTopLeftRadius)).toBeGreaterThanOrEqual(SIZE_PX.md / 2);
  },
};

export const Sizes: Story = {
  name: 'Dot sizes',
  parameters: { docs: {
    description: { story: 'Compare the 8px, 12px, and 16px dots.' },
    source: { language: 'tsx', code: `import { Flex, StatusDot } from '@jfrader/ui';

<Flex align="center" gap="md">
  <StatusDot status="online" label="Small" size="sm" />
  <StatusDot status="online" label="Medium" size="md" />
  <StatusDot status="online" label="Large" size="lg" />
</Flex>` },
  } },
  render: () => (
    <Flex align="center" gap="md">
      {SIZES.map((size) => <StatusDot key={size} status="online" label={`Size ${size}`} size={size} />)}
    </Flex>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const size of SIZES) {
      const rect = canvas.getByRole('img', { name: `Size ${size}` }).getBoundingClientRect();
      await expect(rect.width).toBe(SIZE_PX[size]);
      await expect(rect.height).toBe(SIZE_PX[size]);
    }
  },
};

export const Pulse: Story = {
  name: 'Pulsing dot',
  parameters: { docs: {
    description: { story: 'Add `pulse` to repeat a ring from the dot’s edge.' },
    source: { language: 'tsx', code: `import { Flex, StatusDot } from '@jfrader/ui';

<Flex align="center" gap="lg">
  <StatusDot status="online" label="Online" size="sm" pulse />
  <StatusDot status="online" label="Online" size="md" pulse />
  <StatusDot status="online" label="Online" size="lg" pulse />
  <StatusDot status="busy" label="Recording" variant="square" size="lg" pulse />
</Flex>` },
  } },
  render: () => (
    <Flex align="center" gap="lg">
      {SIZES.map((size) => <StatusDot key={size} status="online" label={`Online ${size}`} size={size} pulse />)}
      <StatusDot status="busy" label="Recording" variant="square" size="lg" pulse />
    </Flex>
  ),
  play: async ({ canvasElement }) => {
    const dots = within(canvasElement).getAllByRole('img');
    await expect(dots).toHaveLength(SIZES.length + 1);
    for (const dot of dots) {
      await expect(dot).toHaveAttribute('data-pulse');
      await expectPulseFromDot(dot);
      await expectPulseCycle(dot);
    }
    const square = within(canvasElement).getByRole('img', { name: 'Recording' });
    await expect(getComputedStyle(square, '::after').borderTopLeftRadius).toBe(getComputedStyle(square).borderTopLeftRadius);
  },
};

export const StaticDot: Story = {
  tags: ['!autodocs'],
  args: { pulse: false },
  play: async ({ canvasElement }) => {
    const dot = within(canvasElement).getByRole('img', { name: 'Online' });
    await expect(dot).not.toHaveAttribute('data-pulse');
    await expect(getComputedStyle(dot, '::after').content).toBe('none');
    await expect(dot.getAnimations({ subtree: true })).toHaveLength(0);
  },
};

export const OverImage: Story = {
  name: 'Dot over an image',
  parameters: { docs: {
    description: { story: 'Place a dot on a photo; its outline in the page color keeps the edge visible.' },
    source: { language: 'tsx', code: `import { StatusDot, styled } from '@jfrader/ui';
import { sceneSource } from '@jfrader/ui/scene';
import { vars } from '@jfrader/tokens/vars';

const PhotoFrame = styled('span')({ position: 'relative', display: 'inline-block' });
const Photo = styled('img')({ display: 'block', inlineSize: \`calc(\${vars.space[12]} * 3)\`,
  blockSize: \`calc(\${vars.space[12]} * 2)\`, borderRadius: vars.radius.md, objectFit: 'cover' });
const PhotoDot = styled(StatusDot)({ position: 'absolute',
  insetBlockStart: vars.space[2], insetInlineEnd: vars.space[2] });

<PhotoFrame>
  <Photo src={sceneSource('studio-camera')} alt="Studio camera" />
  <PhotoDot status="online" label="Camera online" size="lg" pulse />
</PhotoFrame>` },
  } },
  render: () => (
    <PhotoFrame>
      <Photo src={sceneSource('studio-camera')} alt="Studio camera" />
      <PhotoDot status="online" label="Camera online" size="lg" pulse />
    </PhotoFrame>
  ),
  play: async ({ canvasElement }) => {
    const dot = within(canvasElement).getByRole('img', { name: 'Camera online' });
    const style = getComputedStyle(dot);
    const probe = canvasElement.ownerDocument.createElement('span');
    probe.style.backgroundColor = vars.color.bg;
    canvasElement.append(probe);
    try {
      await expect(style.outlineStyle).toBe('solid');
      await expect(style.outlineWidth).toBe('2px');
      await expect(style.outlineColor).toBe(getComputedStyle(probe).backgroundColor);
    } finally { probe.remove(); }
    await expectPulseFromDot(dot);
  },
};

export const LightTheme: Story = {
  ...Glyphs,
  name: 'Status glyphs in light theme',
  decorators: [withLightTheme],
};

export const ReducedMotionRule: Story = {
  tags: ['!autodocs'],
  args: { pulse: true },
  play: async ({ canvasElement }) => {
    const dot = within(canvasElement).getByRole('img', { name: 'Online' });
    await expectPulseHiddenForMedia(dot, 'prefers-reduced-motion: reduce');
    await expect(dot.getBoundingClientRect().width).toBe(SIZE_PX.md);
  },
};

export const ForcedColorsRule: Story = {
  ...Glyphs,
  tags: ['!autodocs'],
  name: 'Forced colors rule',
  play: async ({ canvasElement }) => {
    const dots = within(canvasElement).getAllByRole('img');
    const rules = mediaRules(canvasElement.ownerDocument, 'forced-colors: active');
    for (const dot of dots) {
      const selectors = Array.from(dot.classList, (name) => `.${name}`);
      const rule = rules.find((item) => selectors.includes(item.selectorText) && item.style.forcedColorAdjust === 'none');
      await expect(rule?.style.getPropertyValue('--status-dot-ink').trim()).toBe('CanvasText');
      await expect(rule?.style.getPropertyValue('--status-dot-cut').trim()).toBe('Canvas');
      await expectPulseHiddenForMedia(dot, 'forced-colors: active');
    }
  },
};
