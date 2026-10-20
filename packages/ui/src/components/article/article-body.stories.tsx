import { createRef, memo, type ComponentPropsWithRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { Article } from './index';
import { ArticleList } from '../article-list';
import { ArticleSection } from '../article-section';
import { expectArticleHydration } from '../../testing/article-assertions';
import type { PresentationHeadingProps } from '../../utils/presentation-slot';
import { createRefCleanupTracker } from '../../testing/interior-slot-assertions';

const snippet = `import { Article } from '@jfrader/ui';

<Article.Body>
  <Article.Body.Paragraph variant="drop-cap">The morning edition reached Northline.</Article.Body.Paragraph>
  <Article.Body.Heading>At the station</Article.Body.Heading>
  <Article.Body.Fact title="The record" items={[{ id: 'edition', content: 'The first edition arrived at dawn.' }]} />
  <Article.Body.Quote speaker="The editor" attribution="Morning edition">The record remains open.</Article.Body.Quote>
  <Article.Body.Split>
    <Article.Body.Cell label="Before">The platform was closed.</Article.Body.Cell>
    <Article.Body.Cell label="After">The platform reopened.</Article.Body.Cell>
  </Article.Body.Split>
</Article.Body>`;
const meta = {
  title: 'Media/Article', component: Article.Body, tags: ['!autodocs'],
  parameters: { docs: {
    description: { component: 'Compose article paragraphs, headings, facts, quotations and comparisons.' },
    source: { code: snippet },
    sections: [
      { title: 'Prose', stories: ['BodyPrimary', 'BodyStandard', 'BodyDropCap', 'BodyHeadingLevels'] },
      { title: 'Editorial elements', stories: ['BodyFact', 'BodyFactChildren', 'BodyQuote', 'BodySplit'] },
      { title: 'Composition', stories: ['BodyArticleDetail', 'BodyReplacementSlots'] },
    ],
    usage: `### Anatomy
Use Paragraph for text, Heading with level 1–6, Fact with keyed items or children, and Quote with an optional body-text speaker paragraph above a separate source attribution footer. Split requires exactly two Cell elements, including memoized Cells; their reading order stays unchanged on narrow screens.

### Customization
Every part accepts sx, native props and ref. Use component or slots.root for root replacement; slots.root wins. Interior slotProps and slots have matching keys. Repeated item props are templates: ids and refs are not repeated. Keep replacements at module scope and forward props, className, data-ui and ref.

### Typography
The shared Prose base styles native rich text. Override inherited --article-font-body, --article-font-heading, --article-font-label, --article-measure and --article-rule-soft-color with sx. No HTML is parsed and no copy is supplied. Links in children retain native Tab and Enter behavior.` } },
  render: (args) => <Article.Body {...args}>
    <Article.Body.Paragraph variant="drop-cap">The morning edition reached Northline before the first train.</Article.Body.Paragraph>
    <Article.Body.Heading>At the station</Article.Body.Heading>
    <Article.Body.Paragraph>The platform reopened after the inspection.</Article.Body.Paragraph>
    <Article.Body.Fact title="The record" items={[{ id: 'edition', content: 'The first edition arrived at dawn.' }, { id: 'platform', content: 'The platform reopened.' }]} />
    <Article.Body.Quote speaker="The editor" attribution="Morning edition">The record remains open.</Article.Body.Quote>
    <Article.Body.Split><Article.Body.Cell label="Before">The platform was closed.</Article.Body.Cell><Article.Body.Cell label="After">The platform reopened.</Article.Body.Cell></Article.Body.Split>
  </Article.Body>,
} satisfies Meta<typeof Article.Body>;
export default meta;
type Story = StoryObj<typeof meta>;

export const BodyPrimary: Story = { play: async ({ canvasElement }) => {
  await expect(canvasElement.querySelector('aside ul')?.children).toHaveLength(2);
  await expect(canvasElement.querySelector('blockquote > p')).toHaveTextContent('The editor');
  await expect(canvasElement.querySelector('blockquote footer')).toHaveTextContent('Morning edition');
  await expect(canvasElement.querySelector('blockquote footer')).not.toHaveTextContent('The editor');
  await expect(canvasElement.querySelector('cite')).toBeNull();
  const body = canvasElement.querySelector('[data-ui~="article-body"]')!.getBoundingClientRect();
  const heading = canvasElement.querySelector('h2')!.getBoundingClientRect();
  await expect(Math.abs(body.left - heading.left)).toBeLessThan(1);
  const ownRef = createRefCleanupTracker<HTMLDivElement>(); const slotRef = createRefCleanupTracker<HTMLDivElement>();
  await expectArticleHydration(<Article.Body ref={ownRef.ref} slotProps={{ root: { ref: slotRef.ref } }}><Article.Body.Heading>At the station</Article.Body.Heading><Article.Body.Paragraph>The platform reopened.</Article.Body.Paragraph></Article.Body>, canvasElement);
  for (const tracker of [ownRef, slotRef]) { await expect(tracker.getAttachCount()).toBeGreaterThan(0); await expect(tracker.getCleanupCount()).toBe(tracker.getAttachCount()); }
} };
export const BodyStandard: Story = {
  render: () => <Article.Body><Article.Body.Paragraph>The morning edition reached Northline before the first train.</Article.Body.Paragraph></Article.Body>,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { Article } from '@jfrader/ui';

<Article.Body>
  <Article.Body.Paragraph>The morning edition reached Northline before the first train.</Article.Body.Paragraph>
</Article.Body>`,
      },
    },
  },
};
export const BodyDropCap: Story = {
  render: () => <Article.Body><Article.Body.Paragraph variant="drop-cap">The morning edition reached Northline before the first train.</Article.Body.Paragraph></Article.Body>,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { Article } from '@jfrader/ui';

<Article.Body>
  <Article.Body.Paragraph variant="drop-cap">The morning edition reached Northline before the first train.</Article.Body.Paragraph>
</Article.Body>`,
      },
    },
  },
  play: async ({ canvasElement }) => {
    const paragraph = canvasElement.querySelector('p')!;
    const view = canvasElement.ownerDocument.defaultView!;
    await expect(view.getComputedStyle(paragraph, '::first-letter').fontWeight).toBe('700');
    await expect(view.getComputedStyle(paragraph, '::first-letter').color).toBe(view.getComputedStyle(paragraph).color);
  },
};
export const BodyHeadingLevels: Story = {
  render: () => <Article.Body><Article.Body.Heading level={1}>Edition</Article.Body.Heading><Article.Body.Heading level={2}>Northline</Article.Body.Heading><Article.Body.Heading level={3}>Station</Article.Body.Heading><Article.Body.Heading level={4}>Platform</Article.Body.Heading><Article.Body.Heading level={5}>Inspection</Article.Body.Heading><Article.Body.Heading level={6}>Record</Article.Body.Heading></Article.Body>,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { Article } from '@jfrader/ui';

<Article.Body>
  <Article.Body.Heading level={1}>Edition</Article.Body.Heading>
  <Article.Body.Heading level={2}>Northline</Article.Body.Heading>
</Article.Body>`,
      },
    },
  },
  play: async ({ canvasElement }) => { for (const level of [1, 2, 3, 4, 5, 6]) await expect(canvasElement.querySelector(`h${level}`)).not.toBeNull(); },
};
export const BodyFact: Story = {
  render: () => <Article.Body><Article.Body.Fact title="The record" level={2} items={[{ id: 'zero', content: 0 }, { id: 'edition', content: 'Morning edition' }]} /></Article.Body>,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { Article } from '@jfrader/ui';

<Article.Body>
  <Article.Body.Fact
    title="The record"
    level={2}
    items={[{ id: 'edition', content: 'Morning edition' }]}
  />
</Article.Body>`,
      },
    },
  },
  play: async ({ canvasElement }) => {
    const view = canvasElement.ownerDocument.defaultView!;
    for (const element of canvasElement.querySelectorAll('aside h2, aside ul, aside li')) {
      await expect(view.getComputedStyle(element).margin).toBe('0px');
    }
    await expect(view.getComputedStyle(canvasElement.querySelector('ul')!).padding).toBe('0px');
  },
};
export const BodyFactChildren: Story = {
  render: () => <Article.Body><Article.Body.Fact title="The record"><Article.Body.Paragraph>The inspection is complete.</Article.Body.Paragraph></Article.Body.Fact></Article.Body>,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { Article } from '@jfrader/ui';

<Article.Body>
  <Article.Body.Fact title="The record">
    <Article.Body.Paragraph>The inspection is complete.</Article.Body.Paragraph>
  </Article.Body.Fact>
</Article.Body>`,
      },
    },
  },
};
export const BodyQuote: Story = {
  render: () => <Article.Body><Article.Body.Quote cite="#edition" speaker="The editor" attribution="Morning edition">The record remains open.</Article.Body.Quote></Article.Body>,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { Article } from '@jfrader/ui';

<Article.Body>
  <Article.Body.Quote speaker="The editor" attribution="Morning edition">
    The record remains open.
  </Article.Body.Quote>
</Article.Body>`,
      },
    },
  },
  play: async ({ canvasElement }) => {
    const view = canvasElement.ownerDocument.defaultView!;
    const body = canvasElement.querySelector('[data-ui~="article-body"]')!;
    const quote = canvasElement.querySelector('blockquote')!;
    const speaker = quote.querySelector('p')!;
    const attribution = quote.querySelector('footer')!;
    await expect(speaker.nextElementSibling).toBe(attribution);
    await expect(speaker).toHaveTextContent('The editor');
    await expect(attribution).toHaveTextContent('Morning edition');
    await expect(attribution).not.toHaveTextContent('The editor');
    await expect(view.getComputedStyle(quote).color).toBe(view.getComputedStyle(body).color);
    await expect(view.getComputedStyle(quote).marginBlock).toBe('0px');
    await expect(view.getComputedStyle(speaker).color).toBe(view.getComputedStyle(body).color);
    await expect(view.getComputedStyle(speaker).fontFamily).toBe(view.getComputedStyle(body).fontFamily);
    await expect(view.getComputedStyle(speaker).fontSize).toBe(view.getComputedStyle(body).fontSize);
    await expect(view.getComputedStyle(speaker).fontStyle).toBe('normal');
    await expect(view.getComputedStyle(speaker).textTransform).toBe('none');
    await expect(view.getComputedStyle(attribution).textTransform).toBe('uppercase');
  },
};
export const BodyQuoteWithoutAttribution: Story = { render: () => <Article.Body><Article.Body.Quote>The record remains open.</Article.Body.Quote></Article.Body>, play: async ({ canvasElement }) => { await expect(canvasElement.querySelector('footer')).toBeNull(); } };
export const BodySpeakerOnly: Story = { render: () => <Article.Body><Article.Body.Quote speaker="The editor">The record remains open.</Article.Body.Quote></Article.Body>, play: async ({ canvasElement }) => {
  await expect(canvasElement.querySelector('blockquote > p')).toHaveTextContent('The editor');
  await expect(canvasElement.querySelector('footer')).toBeNull();
} };
export const BodyAttributionOnly: Story = { render: () => <Article.Body><Article.Body.Quote attribution="Morning edition">The record remains open.</Article.Body.Quote></Article.Body> };
const MemoCell = memo(Article.Body.Cell);
export const BodySplit: Story = {
  render: () => <Article.Body><Article.Body.Split><Article.Body.Cell label="Before"><p>The platform was closed.</p></Article.Body.Cell><MemoCell label="After"><p>The platform reopened.</p></MemoCell></Article.Body.Split></Article.Body>,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { Article } from '@jfrader/ui';

<Article.Body>
  <Article.Body.Split>
    <Article.Body.Cell label="Before">
      <p>The platform was closed.</p>
    </Article.Body.Cell>
    <Article.Body.Cell label="After">
      <p>The platform reopened.</p>
    </Article.Body.Cell>
  </Article.Body.Split>
</Article.Body>`,
      },
    },
  },
  play: async ({ canvasElement }) => {
    const cells = canvasElement.querySelectorAll('[data-ui~="article-body-cell"]');
    await expect(cells).toHaveLength(2);
    await expect(cells[0]).toHaveTextContent('Before');
    await expect(cells[1]).toHaveTextContent('After');
    for (const paragraph of canvasElement.querySelectorAll('[data-ui~="article-body-cell"] p')) await expect(canvasElement.ownerDocument.defaultView!.getComputedStyle(paragraph).margin).toBe('0px');
    const first = cells[0]!.getBoundingClientRect(); const second = cells[1]!.getBoundingClientRect();
    if (canvasElement.ownerDocument.defaultView!.innerWidth >= 640) await expect(Math.abs(first.width - second.width)).toBeLessThan(1);
    else await expect(second.top).toBeGreaterThan(first.top);
  },
};
export const BodyEmptyOptionals: Story = { render: () => <Article.Body><Article.Body.Heading>{null}</Article.Body.Heading><Article.Body.Heading>{''}</Article.Body.Heading><Article.Body.Fact title="" level={2} items={[]} /><Article.Body.Quote>{null}</Article.Body.Quote><Article.Body.Cell>0</Article.Body.Cell></Article.Body>, play: async ({ canvasElement }) => {
  await expect(canvasElement.querySelector('h2, ul, blockquote, [data-ui~="article-body-cell-label"]')).toBeNull();
} };
export const BodyLongText: Story = { render: () => <Article.Body><Article.Body.Paragraph>{'Northline'.repeat(60)}</Article.Body.Paragraph><Article.Body.Split><Article.Body.Cell>{'Northline'.repeat(40)}</Article.Body.Cell><Article.Body.Cell>{'Northline'.repeat(40)}</Article.Body.Cell></Article.Body.Split></Article.Body> };
export const BodyRTL: Story = {
  args: { dir: 'rtl' },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { Article } from '@jfrader/ui';

<Article.Body dir="rtl">
  <Article.Body.Paragraph variant="drop-cap">The morning edition reached Northline before the first train.</Article.Body.Paragraph>
  <Article.Body.Heading>At the station</Article.Body.Heading>
  <Article.Body.Paragraph>The platform reopened after the inspection.</Article.Body.Paragraph>
  <Article.Body.Fact title="The record" items={[{ id: 'edition', content: 'The first edition arrived at dawn.' }, { id: 'platform', content: 'The platform reopened.' }]} />
  <Article.Body.Quote speaker="The editor" attribution="Morning edition">The record remains open.</Article.Body.Quote>
  <Article.Body.Split>
    <Article.Body.Cell label="Before">The platform was closed.</Article.Body.Cell>
    <Article.Body.Cell label="After">The platform reopened.</Article.Body.Cell>
  </Article.Body.Split>
</Article.Body>`,
      },
    },
  },
};
export const BodyLight: Story = { globals: { theme: 'light' } };
export const BodyArticleDetail: Story = {
  parameters: {
    docs: {
      source: {
        code: `import { Article, ArticleList, ArticleSection } from '@jfrader/ui';

<Article>
  <Article.Kicker items={[{ id: 'northline', label: 'Northline' }]} />
  <Article.Headline level={1} size="lead">The platform reopens</Article.Headline>
  <Article.Meta published={{ dateTime: '2026-10-19T09:00:00Z', label: '19 October · 09:00' }} />
  <Article.Body>
    <Article.Body.Paragraph variant="drop-cap">The morning edition reached Northline before the first train.</Article.Body.Paragraph>
    <Article.Body.Fact title="The record" items={[{ id: 'inspection', content: 'The inspection is complete.' }]} />
    <section aria-label="Record">
      <Article.Body.Heading>Record</Article.Body.Heading>
      <ol><li><time dateTime="2026-10-19T09:00:00Z">09:00</time> · The platform reopened.</li></ol>
    </section>
  </Article.Body>
  <aside aria-label="Related coverage">
    <ArticleSection.Heading title="Related coverage" />
    <ArticleList items={[{ id: 'edition', headline: 'Morning edition', href: '#edition' }]} />
  </aside>
  <Article.Sources title="Coverage" items={[{ id: 'edition', label: 'Morning edition', href: '#edition' }]} />
  <Article.Sources title="Primary documents" variant="stacked" items={[{ id: 'record', label: 'Station record' }]} />
</Article>`,
      },
    },
  },
  render: () => (
    <Article>
      <Article.Kicker items={[{ id: 'northline', label: 'Northline' }]} />
      <Article.Headline level={1} size="lead">The platform reopens</Article.Headline>
      <Article.Meta published={{ dateTime: '2026-10-19T09:00:00Z', label: '19 October · 09:00' }} />
      <Article.Body>
        <Article.Body.Paragraph variant="drop-cap">The morning edition reached Northline before the first train.</Article.Body.Paragraph>
        <Article.Body.Fact title="The record" items={[{ id: 'inspection', content: 'The inspection is complete.' }]} />
        <section aria-label="Record"><Article.Body.Heading>Record</Article.Body.Heading><ol><li><time dateTime="2026-10-19T09:00:00Z">09:00</time> · The platform reopened.</li></ol></section>
      </Article.Body>
      <aside aria-label="Related coverage"><ArticleSection.Heading title="Related coverage" /><ArticleList items={[{ id: 'edition', headline: 'Morning edition', href: '#edition' }]} /></aside>
      <Article.Sources title="Coverage" items={[{ id: 'edition', label: 'Morning edition', href: '#edition' }]} />
      <Article.Sources title="Primary documents" variant="stacked" items={[{ id: 'record', label: 'Station record' }]} />
    </Article>
  ),
};

function Div(props: ComponentPropsWithRef<'div'>) { return <div {...props} data-replacement="div" />; }
function P(props: ComponentPropsWithRef<'p'>) { return <p {...props} data-replacement="p" />; }
function H({ level = 2, ...props }: PresentationHeadingProps) { const Element = `h${level}` as const; return <Element {...props} data-replacement="heading" />; }
function Aside(props: ComponentPropsWithRef<'aside'>) { return <aside {...props} data-replacement="aside" />; }
function Ul(props: ComponentPropsWithRef<'ul'>) { return <ul {...props} data-replacement="ul" />; }
function Li(props: ComponentPropsWithRef<'li'>) { return <li {...props} data-replacement="li" />; }
function Blockquote(props: ComponentPropsWithRef<'blockquote'>) { return <blockquote {...props} data-replacement="blockquote" />; }
function Footer(props: ComponentPropsWithRef<'footer'>) { return <footer {...props} data-replacement="footer" />; }
const rootRef = createRef<HTMLDivElement>(); const paragraphRef = createRef<HTMLParagraphElement>(); const headingRef = createRef<HTMLHeadingElement>(); const factRef = createRef<HTMLElement>(); const quoteRef = createRef<HTMLQuoteElement>();
export const BodyReplacementSlots: Story = {
  render: () => <Article.Body component={Div} slots={{ root: Div }} ref={rootRef} id="body-consumer" className="consumer" slotProps={{ root: { id: 'body-slot', className: 'slot', 'data-ui': 'custom article-body' } }}>
    <Article.Body.Paragraph ref={paragraphRef} slots={{ root: P }}>Morning edition</Article.Body.Paragraph>
    <Article.Body.Heading ref={headingRef} slots={{ root: H }}>Northline</Article.Body.Heading>
    <Article.Body.Fact ref={factRef} slots={{ root: Aside, title: P, list: Ul, item: Li }} title="Record" items={[{ id: 'one', content: 'First edition' }, { id: 'two', content: 'Second edition' }]} slotProps={{ item: { id: 'not-repeated' } }} />
    <Article.Body.Quote ref={quoteRef} slots={{ root: Blockquote, excerpt: Div, speaker: P, attribution: Footer }} slotProps={{ speaker: { id: 'speaker-slot' }, attribution: { id: 'attribution-slot' } }} speaker="Editor" attribution="Edition">The record remains open.</Article.Body.Quote>
    <Article.Body.Split slots={{ root: Div }}><Article.Body.Cell slots={{ root: Div, label: P, content: Div }} label="Before">Closed</Article.Body.Cell><Article.Body.Cell slots={{ root: Div, label: P, content: Div }} label="After">Open</Article.Body.Cell></Article.Body.Split>
  </Article.Body>,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import type { ComponentPropsWithRef } from 'react';
import { Article } from '@jfrader/ui';

function Div(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} />;
}

<Article.Body component={Div} slots={{ root: Div }}>
  <Article.Body.Paragraph>Morning edition</Article.Body.Paragraph>
</Article.Body>`,
      },
    },
  },
  play: async ({ canvasElement }) => {
    await expect(rootRef.current).toHaveAttribute('id', 'body-slot');
    await expect(rootRef.current).toHaveAttribute('data-ui', 'article-body custom');
    await expect(rootRef.current).toHaveClass('consumer', 'slot');
    await expect(paragraphRef.current?.tagName).toBe('P'); await expect(headingRef.current?.tagName).toBe('H2');
    await expect(factRef.current?.tagName).toBe('ASIDE'); await expect(quoteRef.current?.tagName).toBe('BLOCKQUOTE');
    await expect(canvasElement.querySelector('#speaker-slot')).toHaveAttribute('data-replacement', 'p');
    await expect(canvasElement.querySelector('#attribution-slot')).toHaveAttribute('data-replacement', 'footer');
    await expect(canvasElement.querySelector('#not-repeated')).toBeNull();
    await expect(canvasElement.querySelectorAll('[data-replacement]')).toHaveLength(19);
  },
};
