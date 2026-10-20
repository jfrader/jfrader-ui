import type { ComponentPropsWithRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { Article, type ArticleMetaSlots } from './index';
import { expectArticleHydration } from '../../testing/article-assertions';

const published = { dateTime: '2026-10-19T09:00:00Z', label: '19 October · 09:00' };
const updated = { dateTime: '2026-10-19T10:00:00Z', label: '19 October · 10:00' };
const meta = {
  title: 'Media/Article', component: Article.Meta, tags: ['!autodocs'],
  args: { place: 'Northline', published },
  parameters: { docs: {
    description: { component: 'Show a place and publication or update times below an article headline.' },
    source: { code: `import { Article } from '@jfrader/ui';

<Article.Meta place="Northline" published={{ dateTime: '2026-10-19T09:00:00Z', label: '19 October · 09:00' }} />` },
    sections: [
      { title: 'Variants', stories: ['MetaInline', 'MetaRuled'] },
      { title: 'Time and place', stories: ['MetaMissingPlace', 'MetaUpdatedOnly', 'MetaPlaceAndUpdate'] },
      { title: 'Customization', stories: ['MetaReplacementSlots'] },
    ],
    usage: `### Dates and labels
Supply ISO dateTime values and already formatted labels. Publication and update labels are optional caller-owned text. No dates are parsed or compared.

### Customization
Use component or slots.root to replace the paragraph; slots.root wins. Every slot has matching slotProps. Replacements retain native semantics, refs, className and data-ui.

The inherited --article-font-label, --article-rule-color and --article-rule-soft-color variables fall back to typed theme tokens. Tab and Enter use native behavior for consumer-owned place links.`,
  } },
} satisfies Meta<typeof Article.Meta>;
export default meta;
type Story = StoryObj<typeof meta>;

export const MetaInline: Story = { play: async ({ canvasElement }) => {
  await expect(canvasElement.querySelector('time')).toHaveAttribute('dateTime', published.dateTime);
  await expect(canvasElement.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1);
} };
export const MetaRuled: Story = {
  args: { variant: 'ruled', publishedLabel: 'Published', updatedLabel: 'Updated', updated },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { Article } from '@jfrader/ui';

<Article.Meta
  variant="ruled"
  place="Northline"
  published={{ dateTime: '2026-10-19T09:00:00Z', label: '19 October · 09:00' }}
  publishedLabel="Published"
  updated={{ dateTime: '2026-10-19T10:00:00Z', label: '19 October · 10:00' }}
  updatedLabel="Updated"
/>`,
      },
    },
  },
};
export const MetaMissingPlace: Story = { args: { place: undefined }, play: async ({ canvasElement }) => {
  await expect(canvasElement.querySelector('[aria-hidden="true"]')).toBeNull();
} };
export const MetaUpdatedOnly: Story = { args: { place: undefined, published: undefined, updated, updatedLabel: 'Updated' }, play: async ({ canvasElement }) => {
  await expect(canvasElement.querySelector('[aria-hidden="true"]')).toBeNull();
  await expect(canvasElement.querySelector('time')).toHaveAttribute('dateTime', updated.dateTime);
} };
export const MetaPlaceAndUpdate: Story = { args: { published: undefined, updated }, play: async ({ canvasElement }) => {
  await expect(canvasElement.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1);
} };
export const MetaEmpty: Story = {
  args: { place: undefined, published: undefined },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { Article } from '@jfrader/ui';

<Article.Meta />`,
      },
    },
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-ui~="article-meta"]')).toBeNull();
  },
};
export const MetaZero: Story = { args: { place: 0, published: { ...published, label: 0 } } };
export const MetaRTL: Story = { args: { dir: 'rtl', place: 'Northline · المنطقة' } };
export const MetaLight: Story = { globals: { theme: 'light' }, args: { variant: 'ruled', updated } };

function Paragraph(props: ComponentPropsWithRef<'p'>) { return <p {...props} data-replacement="root" />; }
function Span(props: ComponentPropsWithRef<'span'>) { return <span {...props} data-replacement="span" />; }
function Time(props: ComponentPropsWithRef<'time'>) { return <time {...props} data-replacement="time" />; }
const slots: ArticleMetaSlots = { root: Paragraph, place: Span, published: Time, updated: Time, publishedLabel: Span, updatedLabel: Span, placeSeparator: Span, updateSeparator: Span };
export const MetaReplacementSlots: Story = {
  args: { slots, publishedLabel: 'Published', updatedLabel: 'Updated', updated, id: 'consumer-meta', slotProps: { root: { id: 'slot-meta', 'data-ui': 'custom article-meta', className: 'slot-root' } }, className: 'consumer-root' },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import type { ComponentPropsWithRef } from 'react';
import { Article } from '@jfrader/ui';

function Paragraph(props: ComponentPropsWithRef<'p'>) {
  return <p {...props} />;
}
function Span(props: ComponentPropsWithRef<'span'>) {
  return <span {...props} />;
}
function Time(props: ComponentPropsWithRef<'time'>) {
  return <time {...props} />;
}

<Article.Meta
  place="Northline"
  published={{ dateTime: '2026-10-19T09:00:00Z', label: '19 October · 09:00' }}
  publishedLabel="Published"
  updated={{ dateTime: '2026-10-19T10:00:00Z', label: '19 October · 10:00' }}
  updatedLabel="Updated"
  slots={{
    root: Paragraph,
    place: Span,
    published: Time,
    updated: Time,
    publishedLabel: Span,
    updatedLabel: Span,
    placeSeparator: Span,
    updateSeparator: Span,
  }}
/>`,
      },
    },
  },
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-ui~="article-meta"]');
    await expect(root).toHaveAttribute('id', 'slot-meta');
    await expect(root).toHaveAttribute('data-ui', 'article-meta custom');
    await expect(root).toHaveClass('slot-root', 'consumer-root');
    await expect(canvasElement.querySelectorAll('[data-replacement]')).toHaveLength(8);
    await expectArticleHydration(<Article.Meta place="Northline" published={published} updated={updated} />, canvasElement);
  },
};
