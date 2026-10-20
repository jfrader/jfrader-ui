import type { Meta, StoryObj } from '@storybook/react-vite';
import { StrictMode, useState } from 'react';
import { expect, fn, mocked } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '../../styling/styled';
import { PageCurl } from './index';
import { Button } from '../button';

const Frame = styled.div({
  inlineSize: `min(720px, calc(100vw - ${vars.space[4]} * 2))`,
  maxInlineSize: '100%',
  boxSizing: 'border-box',
  padding: vars.space[5],
  borderRadius: vars.radius.xl,
  background: vars.color.surfaceInset,
  border: `1px solid ${vars.color.border}`,
  display: 'grid',
  gap: vars.space[5],
});
const JournalLabel = styled.p({
  margin: 0,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
});
const Heading = styled.h2({
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.lg,
  margin: 0,
  color: vars.color.text,
});
const Paragraph = styled.p({
  fontFamily: vars.font.sans,
  lineHeight: vars.lineHeight.base,
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
});
const Landscape = styled.svg({
  display: 'block',
  inlineSize: '100%',
  marginBlock: vars.space[5],
  color: vars.color.accentText,
});

function TrailDrawing() {
  return (
    <Landscape
      viewBox="0 0 240 180"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <circle cx="180" cy="38" r="18" />
      <path d="M10 130 72 48 120 110 154 74 230 140M10 148Q70 126 120 148T230 148M10 163Q70 141 120 163T230 163M50 102 72 73 95 103" />
    </Landscape>
  );
}
const pages = [
  {
    id: 'cover',
    label: 'Cover',
    content: (
      <>
        <JournalLabel>VOL. 04 / AUTUMN</JournalLabel>
        <TrailDrawing />
        <Heading>Field notes</Heading>
        <Paragraph>A walking journal from the coast to the river.</Paragraph>
      </>
    ),
  },
  {
    id: 'coast',
    label: 'Coast',
    content: (
      <>
        <Heading>Coast</Heading>
        <TrailDrawing />
        <Paragraph>Low tide leaves a new shoreline.</Paragraph>
        <Paragraph>
          At the headland, the trail turns inland. Salt grass gives way to pine
          and the sound of the sea falls behind us.
        </Paragraph>
      </>
    ),
  },
  {
    id: 'forest',
    label: 'Forest',
    content: (
      <>
        <Heading>Forest</Heading>
        <TrailDrawing />
        <Paragraph>The path follows the river.</Paragraph>
        <Paragraph>
          We stop beneath the canopy to sketch the ridge. The last light catches
          the water between the trees.
        </Paragraph>
      </>
    ),
  },
  {
    id: 'back',
    label: 'Back cover',
    content: (
      <>
        <TrailDrawing />
        <Heading>End of the trail</Heading>
        <Paragraph>Four days. Two coastlines. One notebook filled.</Paragraph>
      </>
    ),
  },
];
const meta = {
  title: 'Media/PageCurl',
  component: PageCurl,
  tags: ['autodocs'],
  args: { pages, label: 'Field notes', locale: 'en-GB', onValueChange: fn() },
  decorators: [
    (Story) => (
      <Frame>
        <JournalLabel>THE WALKING JOURNAL / FIELD NOTES</JournalLabel>
        <Story />
      </Frame>
    ),
  ],
  parameters: {
    docs: {
      sections: [
        { title: 'Reading a journal', stories: ['Default', 'Interior', 'BackCover'] },
        { title: 'Short books', stories: ['OnePage'] },
      ],
      description: {
        component:
          'Turn through a short sequence of editorial pages with previous and next controls.',
      },
      usage: `### Reading order
Use stable, unique page ids. The cover sits alone at the logical end, followed by facing pairs. An even final page sits alone at the logical start. Only the accepted spread is mounted; page content remains selectable.

### Keyboard
Focus the named book group. Left/Right turn with RTL reversal; PageUp/PageDown always move backward/forward. Home/End select the first/last spread. Nested page controls keep their native keys. Navigation buttons work with Enter/Space.

### Turning pages
Drag Next horizontally toward the spine to preview a paper flap. Release past the midpoint or flick to request the next spread; Escape cancels. Previous navigation is button/keyboard only. Reduced motion swaps pages immediately. The fold is noninteractive artwork, not another mount of the page content.

### State
Controlled requests leave page content unchanged until accepted. Out-of-range spread indices clamp for rendering without notifying.`,
    },
  },
} satisfies Meta<typeof PageCurl>;
export default meta;
type Story = StoryObj<typeof meta>;
export const RootRefs: Story = {
  tags: ['!autodocs'],
  args: {
    ref: fn((node: HTMLDivElement | null) => (node ? fn() : undefined)),
    slotProps: {
      root: {
        ref: fn((node: HTMLDivElement | null) => (node ? fn() : undefined)),
      },
    },
  },
  render: function RootRefsFixture(args) {
    const [visible, setVisible] = useState(true);
    return (
      <StrictMode>
        <Button onClick={() => setVisible(false)}>Unmount book</Button>
        {visible && <PageCurl {...args} />}
      </StrictMode>
    );
  },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const root = canvasElement.querySelector('[data-ui="page-curl"]');
    const refs = [args.ref, args.slotProps?.root?.ref];
    for (const ref of refs) {
      await expect(ref).toHaveBeenCalledWith(root);
    }
    await userEvent.click(canvas.getByRole('button', { name: 'Unmount book' }));
    await expect(root).not.toBeInTheDocument();
    for (const ref of refs) {
      if (typeof ref !== 'function') throw new Error('Expected a callback ref');
      for (const result of mocked(ref).mock.results) {
        if (result.type === 'return' && typeof result.value === 'function') {
          await expect(result.value).toHaveBeenCalledTimes(1);
        }
      }
    }
  },
};
const standalonePagesSource = `import { PageCurl, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const JournalLabel = styled.p({
  margin: 0,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
});
const Heading = styled.h2({
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.lg,
  margin: 0,
  color: vars.color.text,
});
const Paragraph = styled.p({
  fontFamily: vars.font.sans,
  lineHeight: vars.lineHeight.base,
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
});
const Landscape = styled.svg({
  display: 'block',
  inlineSize: '100%',
  marginBlock: vars.space[5],
  color: vars.color.accentText,
});

function TrailDrawing() {
  return (
    <Landscape
      viewBox="0 0 240 180"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <circle cx="180" cy="38" r="18" />
      <path d="M10 130 72 48 120 110 154 74 230 140M10 148Q70 126 120 148T230 148M10 163Q70 141 120 163T230 163M50 102 72 73 95 103" />
    </Landscape>
  );
}

const pages = [
  {
    id: 'cover',
    label: 'Cover',
    content: (
      <>
        <JournalLabel>VOL. 04 / AUTUMN</JournalLabel>
        <TrailDrawing />
        <Heading>Field notes</Heading>
        <Paragraph>A walking journal from the coast to the river.</Paragraph>
      </>
    ),
  },
  {
    id: 'coast',
    label: 'Coast',
    content: (
      <>
        <Heading>Coast</Heading>
        <TrailDrawing />
        <Paragraph>Low tide leaves a new shoreline.</Paragraph>
        <Paragraph>
          At the headland, the trail turns inland. Salt grass gives way to pine
          and the sound of the sea falls behind us.
        </Paragraph>
      </>
    ),
  },
  {
    id: 'forest',
    label: 'Forest',
    content: (
      <>
        <Heading>Forest</Heading>
        <TrailDrawing />
        <Paragraph>The path follows the river.</Paragraph>
        <Paragraph>
          We stop beneath the canopy to sketch the ridge. The last light catches
          the water between the trees.
        </Paragraph>
      </>
    ),
  },
  {
    id: 'back',
    label: 'Back cover',
    content: (
      <>
        <TrailDrawing />
        <Heading>End of the trail</Heading>
        <Paragraph>Four days. Two coastlines. One notebook filled.</Paragraph>
      </>
    ),
  },
];`;

export const Default: Story = {
  name: 'Walking journal',
  parameters: { docs: {
    description: { story: 'Turn from the cover through a four-page illustrated journal.' },
    source: { language: 'tsx', code: `${standalonePagesSource}

<PageCurl label="Field notes" locale="en-GB" pages={pages} />` },
  } },
  play: async ({ canvas }) => {
    const cover = canvas.getByRole('group', { name: 'Cover' });
    await expect(cover.getBoundingClientRect().width).toBeGreaterThan(250);
    await expect(canvas.getByRole('heading', { name: 'Field notes' })).toBeVisible();
    await expect(canvas.getByText('A walking journal from the coast to the river.')).toBeVisible();
  },
};

export const Interior: Story = {
  name: 'Facing pages',
  args: { defaultValue: 1 },
  parameters: {
    docs: {
      description: { story: 'Start at the coast and forest spread.' },
      source: {
        language: 'tsx',
        code: `${standalonePagesSource}

<PageCurl
  label="Field notes"
  locale="en-GB"
  pages={pages}
  defaultValue={1}
/>`,
      },
    },
  },
};
export const BackCover: Story = {
  name: 'Final page',
  args: { defaultValue: 2 },
  parameters: {
    docs: {
      description: { story: 'Finish with the back cover on its own.' },
      source: {
        language: 'tsx',
        code: `${standalonePagesSource}

<PageCurl
  label="Field notes"
  locale="en-GB"
  pages={pages}
  defaultValue={2}
/>`,
      },
    },
  },
};
export const OddPages: Story = {
  args: { pages: pages.slice(0, 3), defaultValue: 1 },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `${standalonePagesSource}

<PageCurl
  label="Field notes"
  locale="en-GB"
  pages={pages.slice(0, 3)}
  defaultValue={1}
/>`,
      },
    },
  },
};
export const Empty: Story = { args: { pages: [] } };
export const OnePage: Story = {
  name: 'Single-page book',
  args: { pages: pages.slice(0, 1) },
  parameters: {
    docs: {
      description: { story: 'Show a cover without any following spreads.' },
      source: {
        language: 'tsx',
        code: `${standalonePagesSource}

<PageCurl
  label="Field notes"
  locale="en-GB"
  pages={pages.slice(0, 1)}
/>`,
      },
    },
  },
};
export const HintZero: Story = {
  args: { hint: 0 },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `${standalonePagesSource}

<PageCurl
  label="Field notes"
  locale="en-GB"
  pages={pages}
  hint={0}
/>`,
      },
    },
  },
};
export const LightTheme: Story = {
  globals: { theme: 'light' },
  args: { defaultValue: 1 },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `${standalonePagesSource}

<PageCurl
  label="Field notes"
  locale="en-GB"
  pages={pages}
  defaultValue={1}
/>`,
      },
    },
  },
};
export const RightToLeft: Story = {
  args: { dir: 'rtl', defaultValue: 1 },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `${standalonePagesSource}

<PageCurl
  label="Field notes"
  locale="en-GB"
  pages={pages}
  dir="rtl"
  defaultValue={1}
/>`,
      },
    },
  },
};
export const KeyboardNavigation: Story = {
  tags: ['!autodocs'],
  play: async ({ canvas, userEvent, args }) => {
    const book = canvas.getByRole('group', { name: 'Field notes' });
    await userEvent.tab();
    await expect(book.ownerDocument.activeElement).toBe(book);
    await expect(
      book.ownerDocument.defaultView!.getComputedStyle(book).outlineStyle,
    ).not.toBe('none');
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('group', { name: 'Coast' })).toBeVisible();
    await expect(canvas.getByRole('group', { name: 'Forest' })).toBeVisible();
    await userEvent.keyboard('{End}');
    await expect(
      canvas.getByRole('group', { name: 'Back cover' }),
    ).toBeVisible();
    await userEvent.keyboard('{PageUp}{Home}{ArrowLeft}');
    await expect(canvas.getByRole('group', { name: 'Cover' })).toBeVisible();
    await expect(args.onValueChange).toHaveBeenCalledTimes(4);
    await expect(
      canvas.getByRole('button', { name: 'Previous' }),
    ).toBeDisabled();
    await userEvent.tab();
    await userEvent.keyboard(' ');
    await expect(args.onValueChange).toHaveBeenCalledTimes(5);
    await expect(book.ownerDocument.activeElement).toBe(
      canvas.getByRole('button', { name: 'Next' }),
    );
  },
};
export const RejectedTurn: Story = {
  tags: ['!autodocs'],
  args: { value: 0 },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }));
    await expect(args.onValueChange).toHaveBeenCalledWith(1);
    await expect(canvas.getByRole('group', { name: 'Cover' })).toBeVisible();
    await expect(canvas.getByRole('status')).toHaveTextContent('1 / 4');
  },
};
export const RtlKeyboard: Story = {
  tags: ['!autodocs'],
  args: { dir: 'rtl' },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.keyboard('{ArrowLeft}{PageDown}');
    await expect(args.onValueChange).toHaveBeenLastCalledWith(2);
    await expect(
      canvas.getByRole('group', { name: 'Back cover' }),
    ).toBeVisible();
  },
};
export const ClampedValue: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `${standalonePagesSource}

<PageCurl
  label="Field notes"
  locale="en-GB"
  pages={pages}
  value={100}
/>`,
      },
    },
  },
  args: { value: 100 },
  play: async ({ canvas, args }) => {
    await expect(canvas.getByRole('button', { name: 'Next' })).toBeDisabled();
    await expect(
      canvas.getByRole('group', { name: 'Back cover' }),
    ).toBeVisible();
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
