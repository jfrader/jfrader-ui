import { createRef, type ComponentPropsWithRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { ArticleList } from './index';
import { expectArticleHydration } from '../../testing/article-assertions';

const time = { dateTime: '2026-10-19T09:00:00Z', label: '09:00' };
const items = [{ id: 'river', headline: 'The river path opens for the weekend', href: '#river', time, label: 'The city', place: 'Northline' }, { id: 'station', headline: 'Work begins at the old station', href: '#station', time }] as const;
const meta = {
  title: 'Media/ArticleList', component: ArticleList, tags: ['autodocs'], args: { items },
  parameters: { docs: {
    description: { component: 'Show article headlines in time, topic, place or stacked rows.' },
    source: { language: 'tsx', code: `import { ArticleList } from '@jfrader/ui';

<ArticleList items={[
  { id: 'river', headline: 'The river path opens for the weekend', href: '#river', time: { dateTime: '2026-10-19T09:00:00Z', label: '09:00' }, label: 'The city', place: 'Northline' },
  { id: 'station', headline: 'Work begins at the old station', href: '#station', time: { dateTime: '2026-10-19T09:00:00Z', label: '09:00' } },
]} />` },
    sections: [
      { title: 'Headline rows', stories: ['Headlines', 'HeadlineTime', 'HeadlineTag', 'HeadlinePlace'] },
      { title: 'News feeds', stories: ['Wire', 'WireWithLabel', 'Stacked'] },
      { title: 'Density', stories: ['Small'] },
    ],
    usage: `### Rows and headings
Input order is preserved; sort and paginate in your app. Empty collections render nothing. Add heading semantics only when the headlines belong in the page outline. Prepare locale-aware time labels before rendering.

### Keyboard
Tab and Shift+Tab follow native link order; Enter follows links. Keep linked headlines free of nested links. A wire label is part of its headline link, while a topic label in a headline row is not.`,
  } },
} satisfies Meta<typeof ArticleList>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Headlines: Story = { name: 'Headline list', parameters: { docs: { description: { story: 'List linked headlines and their publication times without adding headings.' } } }, play: async ({ canvas, userEvent, canvasElement }) => {
  await expect(canvas.getAllByRole('listitem')).toHaveLength(2);
  await expect(canvas.queryByRole('heading')).not.toBeInTheDocument();
  await expect(canvasElement.querySelector('time')).toHaveAttribute('dateTime', time.dateTime);
  const links = canvas.getAllByRole('link');
  await userEvent.tab();
  await expect(links[0]!.ownerDocument.activeElement).toBe(links[0]);
  await expect(getComputedStyle(links[0]!).outlineStyle).not.toBe('none');
  await userEvent.tab();
  await expect(links[1]!.ownerDocument.activeElement).toBe(links[1]);
  await userEvent.tab({ shift: true });
  await expect(links[0]!.ownerDocument.activeElement).toBe(links[0]);
} };
export const HeadlineTime: Story = {
  name: 'Headline with time',
  args: { items: [{ ...items[0], variant: 'headline-time', level: 2 }] },
  parameters: {
    docs: {
      description: { story: 'Give a timed headline a place in the page outline.' },
      source: {
        language: 'tsx',
        code: `import { ArticleList } from '@jfrader/ui';

<ArticleList
  items={[
    {
      id: 'river',
      headline: 'The river path opens for the weekend',
      href: '#river',
      time: { dateTime: '2026-10-19T09:00:00Z', label: '09:00' },
      label: 'The city',
      place: 'Northline',
      variant: 'headline-time',
      level: 2,
    },
  ]}
/>`,
      },
    },
  },
};
export const HeadlineTag: Story = {
  name: 'Headline with topic',
  args: { items: [{ ...items[0], variant: 'headline-tag', level: 2 }] },
  parameters: {
    docs: {
      description: { story: 'Place a topic label outside the linked headline.' },
      source: {
        language: 'tsx',
        code: `import { ArticleList } from '@jfrader/ui';

<ArticleList
  items={[
    {
      id: 'river',
      headline: 'The river path opens for the weekend',
      href: '#river',
      time: { dateTime: '2026-10-19T09:00:00Z', label: '09:00' },
      label: 'The city',
      place: 'Northline',
      variant: 'headline-tag',
      level: 2,
    },
  ]}
/>`,
      },
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('link')).not.toHaveTextContent('The city');
  },
};
export const HeadlinePlace: Story = {
  name: 'Headline with place',
  args: { items: [{ ...items[0], variant: 'headline-place', level: 3 }] },
  parameters: {
    docs: {
      description: { story: 'Align a place label beside a linked headline on wider screens.' },
      source: {
        language: 'tsx',
        code: `import { ArticleList } from '@jfrader/ui';

<ArticleList
  items={[
    {
      id: 'river',
      headline: 'The river path opens for the weekend',
      href: '#river',
      time: { dateTime: '2026-10-19T09:00:00Z', label: '09:00' },
      label: 'The city',
      place: 'Northline',
      variant: 'headline-place',
      level: 3,
    },
  ]}
/>`,
      },
    },
  },
};
export const Wire: Story = {
  name: 'News wire',
  args: { variant: 'wire', items: [{ ...items[0], label: undefined }] },
  parameters: {
    docs: {
      description: { story: 'Put a timestamp before a headline in a news-wire row.' },
      source: {
        language: 'tsx',
        code: `import { ArticleList } from '@jfrader/ui';

<ArticleList
  variant="wire"
  items={[
    {
      id: 'river',
      headline: 'The river path opens for the weekend',
      href: '#river',
      time: { dateTime: '2026-10-19T09:00:00Z', label: '09:00' },
      place: 'Northline',
    },
  ]}
/>`,
      },
    },
  },
};
export const WireWithLabel: Story = {
  name: 'Labeled news wire',
  args: { variant: 'wire' },
  parameters: {
    docs: {
      description: { story: 'Include a topic label inside a wire headline’s link.' },
      source: {
        language: 'tsx',
        code: `import { ArticleList } from '@jfrader/ui';

<ArticleList
  variant="wire"
  items={[
    {
      id: 'river',
      headline: 'The river path opens for the weekend',
      href: '#river',
      time: { dateTime: '2026-10-19T09:00:00Z', label: '09:00' },
      label: 'The city',
      place: 'Northline',
    },
    {
      id: 'station',
      headline: 'Work begins at the old station',
      href: '#station',
      time: { dateTime: '2026-10-19T09:00:00Z', label: '09:00' },
    },
  ]}
/>`,
      },
    },
  },
  play: async ({ canvas }) => { await expect(canvas.getAllByRole('link')[0]).toHaveTextContent('The city'); },
};
export const Stacked: Story = {
  name: 'Stacked headlines',
  args: { variant: 'stacked' },
  parameters: {
    docs: {
      description: { story: 'Place topic and time metadata above each headline.' },
      source: {
        language: 'tsx',
        code: `import { ArticleList } from '@jfrader/ui';

<ArticleList
  variant="stacked"
  items={[
    {
      id: 'river',
      headline: 'The river path opens for the weekend',
      href: '#river',
      time: { dateTime: '2026-10-19T09:00:00Z', label: '09:00' },
      label: 'The city',
      place: 'Northline',
    },
    {
      id: 'station',
      headline: 'Work begins at the old station',
      href: '#station',
      time: { dateTime: '2026-10-19T09:00:00Z', label: '09:00' },
    },
  ]}
/>`,
      },
    },
  },
};
export const Small: Story = {
  name: 'Compact headlines',
  args: { size: 'sm' },
  parameters: {
    docs: {
      description: { story: 'Use smaller headline text in a compact list.' },
      source: {
        language: 'tsx',
        code: `import { ArticleList } from '@jfrader/ui';

<ArticleList
  size="sm"
  items={[
    {
      id: 'river',
      headline: 'The river path opens for the weekend',
      href: '#river',
      time: { dateTime: '2026-10-19T09:00:00Z', label: '09:00' },
      label: 'The city',
      place: 'Northline',
    },
    {
      id: 'station',
      headline: 'Work begins at the old station',
      href: '#station',
      time: { dateTime: '2026-10-19T09:00:00Z', label: '09:00' },
    },
  ]}
/>`,
      },
    },
  },
};
export const Medium: Story = {
  args: { size: 'md' },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { ArticleList } from '@jfrader/ui';

<ArticleList
  size="md"
  items={[
    {
      id: 'river',
      headline: 'The river path opens for the weekend',
      href: '#river',
      time: { dateTime: '2026-10-19T09:00:00Z', label: '09:00' },
      label: 'The city',
      place: 'Northline',
    },
    {
      id: 'station',
      headline: 'Work begins at the old station',
      href: '#station',
      time: { dateTime: '2026-10-19T09:00:00Z', label: '09:00' },
    },
  ]}
/>`,
      },
    },
  },
};
export const MissingFields: Story = {
  args: { variant: 'stacked', items: [{ id: 'bare', headline: 'The river path opens for the weekend', href: '#river' }] },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { ArticleList } from '@jfrader/ui';

<ArticleList
  variant="stacked"
  items={[
    {
      id: 'bare',
      headline: 'The river path opens for the weekend',
      href: '#river',
    },
  ]}
/>`,
      },
    },
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-ui~="article-list-meta"]')).toBeNull();
  },
};
export const Empty: Story = {
  args: { items: [] },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { ArticleList } from '@jfrader/ui';

<ArticleList items={[]} />`,
      },
    },
  },
  play: async ({ canvas }) => { await expect(canvas.queryByRole('list')).not.toBeInTheDocument(); },
};
export const Zero: Story = {
  args: { items: [{ id: 'zero', headline: 0, label: 0, time: { ...time, label: 0 }, variant: 'stacked' }] },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { ArticleList } from '@jfrader/ui';

<ArticleList
  items={[
    {
      id: 'zero',
      headline: 0,
      label: 0,
      time: { dateTime: '2026-10-19T09:00:00Z', label: 0 },
      variant: 'stacked',
    },
  ]}
/>`,
      },
    },
  },
};
export const LongHeadlines: Story = {
  args: { items: [{ id: 'long', headline: 'A long headline follows the river from the first bridge to the last station without shortening the story', href: '#long' }, { id: 'unbroken', headline: 'Northline'.repeat(24), href: '#unbroken' }] },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { ArticleList } from '@jfrader/ui';

<ArticleList
  items={[
    {
      id: 'long',
      headline: 'A long headline follows the river from the first bridge to the last station without shortening the story',
      href: '#long',
    },
    {
      id: 'unbroken',
      headline: 'Northline'.repeat(24),
      href: '#unbroken',
    },
  ]}
/>`,
      },
    },
  },
};
export const RTL: Story = {
  args: { dir: 'rtl', variant: 'wire', items: [{ ...items[0], headline: 'Northline المنطقة' }] },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { ArticleList } from '@jfrader/ui';

<ArticleList
  dir="rtl"
  variant="wire"
  items={[
    {
      id: 'river',
      headline: 'Northline المنطقة',
      href: '#river',
      time: { dateTime: '2026-10-19T09:00:00Z', label: '09:00' },
      label: 'The city',
      place: 'Northline',
    },
  ]}
/>`,
      },
    },
  },
};
export const Light: Story = { globals: { theme: 'light' } };

function List(props: ComponentPropsWithRef<'ul'>) { return <ul {...props} data-replacement="root" />; }
function Item(props: ComponentPropsWithRef<'li'>) { return <li {...props} data-replacement="item" />; }
function MetaRow(props: ComponentPropsWithRef<'div'>) { return <div {...props} data-replacement="meta" />; }
function Span(props: ComponentPropsWithRef<'span'>) { return <span {...props} data-replacement="span" />; }
function Time(props: ComponentPropsWithRef<'time'>) { return <time {...props} data-replacement="time" />; }
function Link(props: ComponentPropsWithRef<'a'>) { return <a {...props} data-replacement="link" />; }
function Headline({ level, ...props }: ComponentPropsWithRef<'h2'> & { level?: 1 | 2 | 3 | 4 | 5 | 6 }) { const Heading = level ? `h${level}` as const : 'span'; return <Heading {...props} data-replacement="headline" />; }
const listRef = createRef<HTMLUListElement>();
const itemRef = createRef<HTMLLIElement>();
export const ReplacementSlots: Story = {
  render: () => <ArticleList ref={listRef} slots={{ root: List, item: Item }} slotProps={{ item: { id: 'must-not-repeat' } }}>
    <ArticleList.Item ref={itemRef} {...items[0]} variant="stacked" slots={{ root: Item, meta: MetaRow, time: Time, label: Span, headline: Headline, link: Link }} />
    <ArticleList.Item {...items[0]} variant="headline-place" level={3} slots={{ place: Span }} />
  </ArticleList>,
  parameters: { docs: { source: { code: `<ArticleList><ArticleList.Item headline="The river path opens for the weekend" href="#river" level={3} variant="headline-place" place="Northline" /></ArticleList>` } } },
  play: async ({ canvas, canvasElement }) => {
    await expect(listRef.current).toBe(canvas.getByRole('list'));
    await expect(itemRef.current).toBe(canvas.getAllByRole('listitem')[0]);
    await expect(canvasElement.querySelector('#must-not-repeat')).toBeNull();
    await expect(canvasElement.querySelectorAll('a a')).toHaveLength(0);
    await expectArticleHydration(<ArticleList items={items} />, canvasElement);
  },
};
