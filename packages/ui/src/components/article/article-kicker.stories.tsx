import { createRef, type ComponentPropsWithRef, type MouseEvent } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import { Article } from './index';
import { expectArticleHydration } from '../../testing/article-assertions';

const items = [{ id: 'section', label: 'The city', href: '#city' }, { id: 'place', label: 'Northline' }];
const meta = {
  title: 'Media/Article', component: Article.Kicker, tags: ['!autodocs'], args: { items },
  parameters: { docs: {
    description: { component: 'Label an article with wrapping section, topic or place links.' },
    source: { code: `import { Article } from '@jfrader/ui';

<Article.Kicker items={[{ id: 'city', label: 'The city', href: '#city' }, { id: 'place', label: 'Northline' }]} />` },
    sections: [
      { title: 'Tones', stories: ['KickerAccent', 'KickerNeutral', 'KickerWrapping'] },
      { title: 'Composition', stories: ['KickerCompound', 'KickerItemSlots', 'KickerReplacementSlots'] },
    ],
    usage: `### Content
Supply presentation items or compose Article.Kicker.Item children, not both. Labels and destinations belong to your app. There is no section vocabulary or fallback label.

### Links and customization
Tab and Shift+Tab move between native links; Enter follows them. Use href or a leaf renderLink adapter that forwards all supplied props and ref. Do not combine renderLink with slots.link.

Use sx on public parts. component is sugar for slots.root; slots.root wins. --article-font-label falls back to the sans font token.`,
  } },
} satisfies Meta<typeof Article.Kicker>;
export default meta;
type Story = StoryObj<typeof meta>;

export const KickerAccent: Story = { play: async ({ canvas, userEvent }) => {
  const link = canvas.getByRole('link', { name: 'The city' });
  await userEvent.tab();
  await expect(link.ownerDocument.activeElement).toBe(link);
  await expect(getComputedStyle(link).outlineStyle).not.toBe('none');
} };
export const KickerNeutral: Story = {
  args: { tone: 'neutral' },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { Article } from '@jfrader/ui';

<Article.Kicker
  tone="neutral"
  items={[
    { id: 'section', label: 'The city', href: '#city' },
    { id: 'place', label: 'Northline' },
  ]}
/>`,
      },
    },
  },
};
export const KickerWrapping: Story = {
  args: { items: [...items, { id: 'long', label: 'A long topic label that wraps naturally across narrow columns', href: '#topic' }] },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { Article } from '@jfrader/ui';

<Article.Kicker
  items={[
    { id: 'section', label: 'The city', href: '#city' },
    { id: 'place', label: 'Northline' },
    { id: 'long', label: 'A long topic label that wraps naturally across narrow columns', href: '#topic' },
  ]}
/>`,
      },
    },
  },
};
export const KickerEmpty: Story = {
  args: { items: [] },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { Article } from '@jfrader/ui';

<Article.Kicker items={[]} />`,
      },
    },
  },
  play: async ({ canvasElement }) => { await expect(canvasElement.querySelector('p')).toBeNull(); },
};
export const KickerZero: Story = {
  args: { items: [{ id: 'zero', label: 0 }] },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { Article } from '@jfrader/ui';

<Article.Kicker items={[{ id: 'zero', label: 0 }]} />`,
      },
    },
  },
};
export const KickerRTL: Story = {
  args: { dir: 'rtl', items: [{ id: 'place', label: 'المنطقة Northline', href: '#place' }] },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { Article } from '@jfrader/ui';

<Article.Kicker
  dir="rtl"
  items={[{ id: 'place', label: 'المنطقة Northline', href: '#place' }]}
/>`,
      },
    },
  },
};
export const KickerLight: Story = { globals: { theme: 'light' } };
const clicked = fn((event: MouseEvent<HTMLAnchorElement>) => event.preventDefault());
const linkRef = createRef<HTMLAnchorElement>();
function Root(props: ComponentPropsWithRef<'p'>) { return <p {...props} data-replacement="root" />; }
function Item(props: ComponentPropsWithRef<'span'> | ComponentPropsWithRef<'a'>) { return 'href' in props ? <a {...props as ComponentPropsWithRef<'a'>} data-replacement="item" /> : <span {...props as ComponentPropsWithRef<'span'>} data-replacement="item" />; }
export const KickerCompound: Story = {
  render: () => <Article.Kicker><Article.Kicker.Item href="#city">The city</Article.Kicker.Item><Article.Kicker.Item>Northline</Article.Kicker.Item></Article.Kicker>,
  parameters: { docs: { source: { code: `import { Article } from '@jfrader/ui';

<Article.Kicker><Article.Kicker.Item href="#city">The city</Article.Kicker.Item><Article.Kicker.Item>Northline</Article.Kicker.Item></Article.Kicker>` } } },
};
export const KickerReplacementSlots: Story = {
  render: () => <Article.Kicker slots={{ root: Root, item: Item }} slotProps={{ item: { id: 'must-not-repeat' } }}><Article.Kicker.Item ref={linkRef} href="#city" target="_blank" rel="author" onClick={clicked} renderLink={(props) => <a {...props} data-router="true" />}>The city</Article.Kicker.Item><Article.Kicker.Item>Northline</Article.Kicker.Item></Article.Kicker>,
  parameters: { docs: { source: { code: `import { Article } from '@jfrader/ui';

<Article.Kicker><Article.Kicker.Item href="#city" renderLink={(props) => <a {...props} />}>The city</Article.Kicker.Item></Article.Kicker>` } } },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const link = canvas.getByRole('link');
    await expect(linkRef.current).toBe(link);
    await expect(link).toHaveAttribute('rel', 'author noopener noreferrer');
    await expect(canvasElement.querySelector('#must-not-repeat')).toBeNull();
    await userEvent.click(link);
    await expect(clicked).toHaveBeenCalledTimes(1);
    await expectArticleHydration(<Article.Kicker items={items} />, canvasElement);
  },
};
function Span(props: ComponentPropsWithRef<'span'>) { return <span {...props} data-replacement="plain" />; }
function Link(props: ComponentPropsWithRef<'a'>) { return <a {...props} data-replacement="link" />; }
export const KickerItemSlots: Story = {
  render: () => <Article.Kicker><Article.Kicker.Item slots={{ root: Span }}>Northline</Article.Kicker.Item><Article.Kicker.Item href="#city" slots={{ link: Link }}>The city</Article.Kicker.Item></Article.Kicker>,
  parameters: { docs: { source: { code: `import { Article } from '@jfrader/ui';

<Article.Kicker><Article.Kicker.Item>Northline</Article.Kicker.Item><Article.Kicker.Item href="#city">The city</Article.Kicker.Item></Article.Kicker>` } } },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole('link')).toHaveAttribute('data-replacement', 'link');
    await expect(canvasElement.querySelector('[data-replacement="plain"]')).toHaveTextContent('Northline');
  },
};
