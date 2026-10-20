import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { withLightTheme } from '../../testing/story-decorators';
import { Prose } from './index';

const meta = {
  title: 'Data display/Prose', component: Prose, tags: ['autodocs'],
  parameters: { docs: {
    description: { component: 'Format longform text with headings, lists, quotes, code and tables.' },
    usage: `### Content
Pass semantic HTML as children. \`size\` sets the base text size. Headings scale with it. Native HTML elements are the styling hooks. \`sx\` can override descendant selectors. The wrapper is a \`div\` and does not choose heading levels. It does not trim the first or last child's outer margin. Set that in the surrounding layout.

### Keyboard
There is no separate APG pattern. Links keep native keyboard activation and visible keyboard focus. No other focus stops are added.

### Security
Prose styles its children only. Choose a parser, sanitize untrusted HTML and set link and image policies in your application. Prose does not parse Markdown, fetch resources or change link attributes.`,
  } },
  args: { children: <>
    <h2>Field notes</h2><p>A record of the expedition.</p>
    <h3>Equipment</h3><ul><li>Compass</li><li>Notebook</li></ul>
    <ol><li>Check supplies</li><li>Plan the route</li></ol>
    <blockquote>Leave the trail as you found it.</blockquote>
    <p>Run <code>collect()</code> to begin.</p><pre><code>{'const distance = 12;\nrecord(distance);'}</code></pre>
    <table><caption>Route distances</caption><thead><tr><th scope="col">Route</th><th scope="col">Distance</th></tr></thead><tbody><tr><td>North</td><td>12 km</td></tr></tbody></table>
    <p><a href="#field-notes">Read the field notes</a></p>
  </> },
} satisfies Meta<typeof Prose>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `<Prose>
  <h2>Field notes</h2>
  <p>A record of the expedition.</p>
  <ul>
    <li>Compass</li>
    <li>Notebook</li>
  </ul>
  <blockquote>Leave the trail as you found it.</blockquote>
  <p><a href="/field-notes">Read the field notes</a></p>
</Prose>`,
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const root = canvasElement.querySelector('[data-ui="prose"]')!;
    const heading = canvas.getByRole('heading', { name: 'Field notes' });
    await expect(parseFloat(getComputedStyle(heading).fontSize)).toBeGreaterThan(parseFloat(getComputedStyle(root).fontSize));
    const lists = canvas.getAllByRole('list');
    await expect(getComputedStyle(lists[0]!).listStyleType).toBe('disc');
    await expect(getComputedStyle(lists[1]!).listStyleType).toBe('decimal');
    const code = canvasElement.querySelector('code')!;
    await expect(getComputedStyle(code).fontFamily).toContain('monospace');
    await expect(getComputedStyle(canvasElement.querySelector('pre')!).overflowX).toBe('auto');
    await expect(getComputedStyle(canvas.getAllByRole('cell')[0]!).borderTopStyle).toBe('solid');
    await expect(getComputedStyle(canvas.getAllByRole('cell')[0]!).overflowWrap).toBe('normal');
    await expect(getComputedStyle(canvasElement.querySelector('blockquote')!).borderInlineStartWidth).toBe('3px');
    const link = canvas.getByRole('link');
    await expect(link).toHaveAttribute('href', '#field-notes');
    await expect(getComputedStyle(link).textDecorationLine).toBe('underline');
    await userEvent.tab();
    await expect(link).toHaveFocus();
    await expect(getComputedStyle(link).outlineStyle).toBe('solid');
  },
};
export const Small: Story = {
  args: { size: 'sm' },
  parameters: { docs: { source: { language: 'tsx', code: `import { Prose } from '@jfrader/ui';

<Prose size="sm">
  <h2>Field notes</h2><p>A record of the expedition.</p>
  <h3>Equipment</h3><ul><li>Compass</li><li>Notebook</li></ul>
  <ol><li>Check supplies</li><li>Plan the route</li></ol>
  <blockquote>Leave the trail as you found it.</blockquote>
  <p>Run <code>collect()</code> to begin.</p>
  <pre><code>{'const distance = 12;\\nrecord(distance);'}</code></pre>
  <table>
    <caption>Route distances</caption>
    <thead><tr><th scope="col">Route</th><th scope="col">Distance</th></tr></thead>
    <tbody><tr><td>North</td><td>12 km</td></tr></tbody>
  </table>
  <p><a href="#field-notes">Read the field notes</a></p>
</Prose>` } } },
};
export const Large: Story = {
  args: { size: 'lg' },
  parameters: { docs: { source: { language: 'tsx', code: `import { Prose } from '@jfrader/ui';

<Prose size="lg">
  <h2>Field notes</h2><p>A record of the expedition.</p>
  <h3>Equipment</h3><ul><li>Compass</li><li>Notebook</li></ul>
  <ol><li>Check supplies</li><li>Plan the route</li></ol>
  <blockquote>Leave the trail as you found it.</blockquote>
  <p>Run <code>collect()</code> to begin.</p>
  <pre><code>{'const distance = 12;\\nrecord(distance);'}</code></pre>
  <table>
    <caption>Route distances</caption>
    <thead><tr><th scope="col">Route</th><th scope="col">Distance</th></tr></thead>
    <tbody><tr><td>North</td><td>12 km</td></tr></tbody>
  </table>
  <p><a href="#field-notes">Read the field notes</a></p>
</Prose>` } } },
};
export const LightTheme: Story = {
  decorators: [withLightTheme],
  parameters: { docs: { source: { language: 'tsx', code: `import { Prose } from '@jfrader/ui';

<Prose>
  <h2>Field notes</h2><p>A record of the expedition.</p>
  <h3>Equipment</h3><ul><li>Compass</li><li>Notebook</li></ul>
  <ol><li>Check supplies</li><li>Plan the route</li></ol>
  <blockquote>Leave the trail as you found it.</blockquote>
  <p>Run <code>collect()</code> to begin.</p>
  <pre><code>{'const distance = 12;\\nrecord(distance);'}</code></pre>
  <table>
    <caption>Route distances</caption>
    <thead><tr><th scope="col">Route</th><th scope="col">Distance</th></tr></thead>
    <tbody><tr><td>North</td><td>12 km</td></tr></tbody>
  </table>
  <p><a href="#field-notes">Read the field notes</a></p>
</Prose>` } } },
};
