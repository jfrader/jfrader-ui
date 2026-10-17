import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '../../styling/styled';
import { PageCurl } from './index';

const Frame = styled.div({ maxInlineSize: '44rem', inlineSize: '100%' });
const Heading = styled.h2({
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.lg,
  margin: 0,
});
const Paragraph = styled.p({
  fontFamily: vars.font.sans,
  lineHeight: vars.lineHeight.base,
});
const pages = [
  { id: 'cover', label: 'Cover', content: <Heading>Field notes</Heading> },
  {
    id: 'coast',
    label: 'Coast',
    content: (
      <>
        <Heading>Coast</Heading>
        <Paragraph>Low tide leaves a new shoreline.</Paragraph>
      </>
    ),
  },
  {
    id: 'forest',
    label: 'Forest',
    content: (
      <>
        <Heading>Forest</Heading>
        <Paragraph>The path follows the river.</Paragraph>
      </>
    ),
  },
  {
    id: 'back',
    label: 'Back cover',
    content: <Heading>End of the trail</Heading>,
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
        <Story />
      </Frame>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          'Turn through a short sequence of editorial pages with previous and next controls.',
      },
      usage: `### Pages\nSupply stable unique page ids. The cover sits alone at the logical end, followed by facing pairs. An even final page sits alone at the logical start. Only the accepted spread is mounted. Page content remains selectable.\n\n### Keyboard\nFocus the named book group. Left/Right turn with RTL reversal; PageUp/PageDown always move backward/forward. Home/End select the first/last spread. Nested page controls keep their native keys. Native navigation buttons work with Enter/Space.\n\n### Motion and limits\nDrag the Next button horizontally toward the spine to preview a paper flap; release past the midpoint or flick to request the next spread. Escape cancels. Previous navigation is button/keyboard only. Reduced motion swaps pages immediately. This compact presentation does not implement physical SVG crease geometry, corner handles, or an introductory tease. Optional renderFold supplies noninteractive artwork, not a duplicate mount of page content.\n\n### State\nvalue/defaultValue is the zero-based spread index. Controlled requests do not change page content until accepted. Invalid spread indices clamp for rendering without notifying.`,
      source: {
        language: 'tsx',
        code: `<PageCurl label="Portfolio" pages={[
  { id: 'cover', content: <h2>Selected work</h2> },
  { id: 'detail', content: <p>Coastal studies</p> },
]} />`,
      },
    },
  },
} satisfies Meta<typeof PageCurl>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Interior: Story = { args: { defaultValue: 1 } };
export const BackCover: Story = { args: { defaultValue: 2 } };
export const OddPages: Story = {
  args: { pages: pages.slice(0, 3), defaultValue: 1 },
};
export const Empty: Story = { args: { pages: [] } };
export const OnePage: Story = { args: { pages: pages.slice(0, 1) } };
export const HintZero: Story = { args: { hint: 0 } };
export const LightTheme: Story = {
  globals: { theme: 'light' },
  args: { defaultValue: 1 },
};
export const RightToLeft: Story = { args: { dir: 'rtl', defaultValue: 1 } };
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
  args: { value: 100 },
  play: async ({ canvas, args }) => {
    await expect(canvas.getByRole('button', { name: 'Next' })).toBeDisabled();
    await expect(
      canvas.getByRole('group', { name: 'Back cover' }),
    ).toBeVisible();
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
