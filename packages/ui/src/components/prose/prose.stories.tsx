import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { withLightTheme } from '../../testing/story-decorators';
import { Prose } from './index';

const meta = {
  title: 'Data display/Prose', component: Prose, tags: ['autodocs'],
  parameters: { docs: {
    sections: [
      { title: 'Article content', stories: ['Default'] },
      { title: 'Reading sizes', stories: ['Small', 'Large'] },
    ],
    description: { component: 'Format longform text with headings, lists, quotes, code and tables.' },
    usage: `### Content
Use semantic HTML and choose heading levels that fit the page outline. Allow space for the first and last child's outer margins in the surrounding layout.

### Keyboard and accessibility

Links keep native keyboard activation and visible keyboard focus. No other focus stops are added.

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
  name: 'Field notes',
  parameters: {
    docs: {
      description: { story: 'Format an article with lists, a quotation, code and a data table.' },
      source: {
        language: 'tsx',
        code: `import { Prose } from '@jfrader/ui';

<Prose>
  <h2>Field notes</h2>
  <p>A record of the expedition.</p>
  <h3>Equipment</h3>
  <ul>
    <li>Compass</li>
    <li>Notebook</li>
  </ul>
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
  name: 'Compact reading',
  args: { size: 'sm' },
  parameters: { docs: { description: { story: 'Use smaller text for a compact article.' }, source: { language: 'tsx', code: `import { Prose } from '@jfrader/ui';

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
  name: 'Large reading',
  args: { size: 'lg' },
  parameters: { docs: { description: { story: 'Increase the text and heading scale for reading.' }, source: { language: 'tsx', code: `import { Prose } from '@jfrader/ui';

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
