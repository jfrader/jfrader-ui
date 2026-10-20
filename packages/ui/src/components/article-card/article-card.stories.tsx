import { act, createRef, StrictMode, type ComponentPropsWithRef } from 'react';
import { createRoot } from 'react-dom/client';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, fireEvent } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { base } from '@jfrader/tokens';
import { styled } from '../../styling/styled';
import { ARTICLE_COLUMNS, ARTICLE_DESKTOP } from '../../styling/article';
import { ArticleCard, type ArticleHeadingLevel } from './index';
import { ArticleKicker } from '../article-kicker';
import { ArticleMeta } from '../article-meta';
import { ArticleList } from '../article-list';
import { expectArticleHydration } from '../../testing/article-assertions';
import { createRefCleanupTracker, expectRootPrecedence, expectSameDomIdentity } from '../../testing/interior-slot-assertions';

const time = { dateTime: '2026-10-19T09:00:00Z', label: '09:00' };
const headline = 'The river path opens for the weekend';
const dek = 'The route connects the old station with the northern bridge.';
const lede = 'Work along the river began at the station. The last section opens this weekend, linking the two bridges with a continuous path.';
const ArchiveLink = styled.a({ color: vars.color.accentText, textDecoration: 'underline' });
const meta = {
  title: 'Media/ArticleCard', component: ArticleCard, tags: ['autodocs'], args: { headline, href: '#river', dek },
  parameters: { docs: {
    description: { component: 'Present an article headline with optional summary, media, kicker and publication details.' },
    source: { code: `<ArticleCard headline="The river path opens for the weekend" href="#river" dek="The route connects the old station with the northern bridge." />` },
    usage: `### Content and hierarchy
Use the headline prop for generated anatomy, or ArticleCard.Headline, Dek, Lede and Media children for custom anatomy. These modes are mutually exclusive. Headline and Dek also work outside a card.

Choose size for headline hierarchy and variant for treatment. Headline level defaults to 2; choose 1–6 for your page outline. Generated brief cards omit the dek. no-dek and rule-bottom omit generated dek; rule-bottom also omits the kicker. Compound content stays caller-controlled.

Lede defaults to desktop-only with a four-line clamp. Your app decides whether to supply it; the library does not deduplicate summaries. Media accepts consumer-owned image, picture, video or other content. Without media there is no figure or placeholder. Caption and credit share one figcaption.

### Links and keyboard
Only the headline link is generated; the article is never an anchor. Keep linked headline children free of links. Unlinked headings may contain source links. Tab and Shift+Tab follow native links; Enter follows them. renderLink is a leaf adapter that forwards all supplied props and ref, and cannot be combined with slots.link. Explicit target _blank retains rel tokens and adds noopener noreferrer.

### Customization
Use component or slots.root for a native article replacement; slots.root wins. Each slot has matching slotProps. Replacements forward semantics, props, className, data-ui and refs. Use sx on public parts.

Inherited --article-font-heading, --article-font-body and --article-font-label fall back to the sans token. --article-measure defaults to 65ch; --article-rule-color defaults to text and --article-rule-soft-color to borderStrong. Fluid sizes use editorial tokens. No fonts are downloaded or theme palettes replaced.`,
  } },
} satisfies Meta<typeof ArticleCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Standard: Story = { play: async ({ canvas, canvasElement, userEvent }) => {
  await expect(canvas.getByRole('article').tagName).toBe('ARTICLE');
  await expect(canvas.getByRole('heading', { level: 2 })).toHaveTextContent(headline);
  await expect(canvasElement.querySelector('figure')).toBeNull();
  await expect(canvasElement.querySelector('a a')).toBeNull();
  const link = canvas.getByRole('link');
  await expect(getComputedStyle(link).textDecorationLine).toBe('none');
  await userEvent.tab();
  await expect(link.ownerDocument.activeElement).toBe(link);
  await expect(getComputedStyle(link).outlineStyle).not.toBe('none');
} };
export const Lead: Story = {
  args: { size: 'lead', lede },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { ArticleCard } from '@jfrader/ui';

<ArticleCard
  size="lead"
  headline="The river path opens for the weekend"
  href="#river"
  dek="The route connects the old station with the northern bridge."
  lede="Work along the river began at the station. The last section opens this weekend, linking the two bridges with a continuous path."
/>`,
      },
    },
  },
};
export const Secondary: Story = {
  args: { size: 'secondary', lede },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { ArticleCard } from '@jfrader/ui';

<ArticleCard
  size="secondary"
  headline="The river path opens for the weekend"
  href="#river"
  dek="The route connects the old station with the northern bridge."
  lede="Work along the river began at the station. The last section opens this weekend, linking the two bridges with a continuous path."
/>`,
      },
    },
  },
};
export const Brief: Story = {
  args: { size: 'brief' },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { ArticleCard } from '@jfrader/ui';

<ArticleCard
  size="brief"
  headline="The river path opens for the weekend"
  href="#river"
  dek="The route connects the old station with the northern bridge."
/>`,
      },
    },
  },
  play: async ({ canvasElement }) => { await expect(canvasElement.querySelector('[data-ui~="article-card-dek"]')).toBeNull(); },
};
export const Wide: Story = {
  args: { variant: 'wide', size: 'lead', slotProps: { dek: { variant: 'columns' } } },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { ArticleCard } from '@jfrader/ui';

<ArticleCard
  variant="wide"
  size="lead"
  headline="The river path opens for the weekend"
  href="#river"
  dek="The route connects the old station with the northern bridge."
  slotProps={{ dek: { variant: 'columns' } }}
/>`,
      },
    },
  },
};
export const WideNarrow: Story = {
  args: { variant: 'wide' },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { ArticleCard } from '@jfrader/ui';

<ArticleCard
  variant="wide"
  headline="The river path opens for the weekend"
  href="#river"
  dek="The route connects the old station with the northern bridge."
/>`,
      },
    },
  },
};
export const TimeColumn: Story = {
  args: { variant: 'time-column', time, kicker: <ArticleKicker items={[{ id: 'city', label: 'The city' }]} />, meta: <ArticleMeta published={time} place="Northline" /> },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { ArticleCard, ArticleKicker, ArticleMeta } from '@jfrader/ui';

<ArticleCard
  variant="time-column"
  headline="The river path opens for the weekend"
  href="#river"
  dek="The route connects the old station with the northern bridge."
  time={{ dateTime: '2026-10-19T09:00:00Z', label: '09:00' }}
  kicker={<ArticleKicker items={[{ id: 'city', label: 'The city' }]} />}
  meta={<ArticleMeta published={{ dateTime: '2026-10-19T09:00:00Z', label: '09:00' }} place="Northline" />}
/>`,
      },
    },
  },
};
export const TimeColumnWithoutTime: Story = {
  args: { variant: 'time-column' },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { ArticleCard } from '@jfrader/ui';

<ArticleCard
  variant="time-column"
  headline="The river path opens for the weekend"
  href="#river"
  dek="The route connects the old station with the northern bridge."
/>`,
      },
    },
  },
};
export const RuleTop: Story = {
  args: { variant: 'rule-top' },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { ArticleCard } from '@jfrader/ui';

<ArticleCard
  variant="rule-top"
  headline="The river path opens for the weekend"
  href="#river"
  dek="The route connects the old station with the northern bridge."
/>`,
      },
    },
  },
};
export const NoDek: Story = {
  args: { variant: 'no-dek' },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { ArticleCard } from '@jfrader/ui';

<ArticleCard
  variant="no-dek"
  headline="The river path opens for the weekend"
  href="#river"
  dek="The route connects the old station with the northern bridge."
/>`,
      },
    },
  },
};
export const RuleBottom: Story = {
  args: { variant: 'rule-bottom', kicker: 'The city', meta: <ArticleMeta published={time} /> },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { ArticleCard, ArticleMeta } from '@jfrader/ui';

<ArticleCard
  variant="rule-bottom"
  headline="The river path opens for the weekend"
  href="#river"
  dek="The route connects the old station with the northern bridge."
  kicker="The city"
  meta={<ArticleMeta published={{ dateTime: '2026-10-19T09:00:00Z', label: '09:00' }} />}
/>`,
      },
    },
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-ui~="article-card-dek"]')).toBeNull();
    await expect(canvasElement.querySelector('[data-ui~="article-card-kicker"]')).toBeNull();
    await expect(canvasElement.querySelector('[data-ui~="article-card-rule"]')).not.toBeNull();
  },
};
export const Centered: Story = {
  args: { variant: 'centered', size: 'secondary', meta: <ArticleMeta place="Northline" published={time} /> },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { ArticleCard, ArticleMeta } from '@jfrader/ui';

<ArticleCard
  variant="centered"
  size="secondary"
  headline="The river path opens for the weekend"
  href="#river"
  dek="The route connects the old station with the northern bridge."
  meta={<ArticleMeta place="Northline" published={{ dateTime: '2026-10-19T09:00:00Z', label: '09:00' }} />}
/>`,
      },
    },
  },
};
export const MissingOptionals: Story = {
  args: { dek: undefined },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { ArticleCard } from '@jfrader/ui';

<ArticleCard
  headline="The river path opens for the weekend"
  href="#river"
/>`,
      },
    },
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll('p, figure, time')).toHaveLength(0);
  },
};
export const LeadWithoutLede: Story = {
  args: { size: 'lead' },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { ArticleCard } from '@jfrader/ui';

<ArticleCard
  size="lead"
  headline="The river path opens for the weekend"
  href="#river"
  dek="The route connects the old station with the northern bridge."
/>`,
      },
    },
  },
};
export const BriefExplicitLede: Story = {
  args: { size: 'brief', lede, slotProps: { lede: { visibility: 'always' } } },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { ArticleCard } from '@jfrader/ui';

<ArticleCard
  size="brief"
  headline="The river path opens for the weekend"
  href="#river"
  dek="The route connects the old station with the northern bridge."
  lede="Work along the river began at the station. The last section opens this weekend, linking the two bridges with a continuous path."
  slotProps={{ lede: { visibility: 'always' } }}
/>`,
      },
    },
  },
};
export const LongHeadlines: Story = {
  args: { headline: 'Northline'.repeat(30) },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { ArticleCard } from '@jfrader/ui';

const headline = 'Northline'.repeat(30);

<ArticleCard
  headline={headline}
  href="#river"
  dek="The route connects the old station with the northern bridge."
/>`,
      },
    },
  },
};
export const MultilineHeadline: Story = {
  args: { headline: 'The river path links the two bridges as the old station prepares to reopen its doors for the weekend' },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { ArticleCard } from '@jfrader/ui';

<ArticleCard
  headline="The river path links the two bridges as the old station prepares to reopen its doors for the weekend"
  href="#river"
  dek="The route connects the old station with the northern bridge."
/>`,
      },
    },
  },
};
export const Zero: Story = {
  args: { headline: 0, dek: 0, lede: 0, kicker: 0, meta: 0 },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { ArticleCard } from '@jfrader/ui';

<ArticleCard headline={0} href="#river" dek={0} lede={0} kicker={0} meta={0} />`,
      },
    },
  },
};
export const Media: Story = {
  args: { media: <blockquote cite="https://example.com/river">The river path opens this weekend.</blockquote>, slotProps: { media: { caption: 'The northern river path', credit: <ArchiveLink href="#archive">City archive</ArchiveLink> } } },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { ArticleCard, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const ArchiveLink = styled.a({ color: vars.color.accentText, textDecoration: 'underline' });

<ArticleCard
  headline="The river path opens for the weekend"
  href="#river"
  dek="The route connects the old station with the northern bridge."
  media={<blockquote cite="https://example.com/river">The river path opens this weekend.</blockquote>}
  slotProps={{
    media: {
      caption: 'The northern river path',
      credit: <ArchiveLink href="#archive">City archive</ArchiveLink>,
    },
  }}
/>`,
      },
    },
  },
  play: async ({ canvasElement, canvas }) => {
    await expect(canvas.getByRole('figure')).toBeInTheDocument();
    await expect(canvasElement.querySelector('figcaption')).toHaveTextContent('City archive');
    await expect(canvasElement.querySelector('blockquote')).toHaveAttribute('cite', 'https://example.com/river');
  },
};
export const ImageMedia: Story = {
  args: { media: <img src="/og-image.png" alt="Share card preview" width={1200} height={630} />, slotProps: { media: { caption: 'Share card preview', credit: 'jfrader-ui' } } },
  parameters: { docs: { source: { code: `<ArticleCard headline="The river path opens for the weekend" media={<img src="/og-image.png" alt="Share card preview" width={1200} height={630} />} />` } } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('img', { name: 'Share card preview' })).toHaveAttribute('src', '/og-image.png');
    await expect(canvas.getByRole('figure')).toBeInTheDocument();
  },
};
export const RTL: Story = {
  args: { dir: 'rtl', headline: 'Northline المنطقة', variant: 'time-column', time },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { ArticleCard } from '@jfrader/ui';

<ArticleCard
  dir="rtl"
  variant="time-column"
  headline="Northline المنطقة"
  href="#river"
  dek="The route connects the old station with the northern bridge."
  time={{ dateTime: '2026-10-19T09:00:00Z', label: '09:00' }}
/>`,
      },
    },
  },
};
export const Light: Story = {
  globals: { theme: 'light' },
  args: { variant: 'rule-top' },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { ArticleCard } from '@jfrader/ui';

<ArticleCard
  variant="rule-top"
  headline="The river path opens for the weekend"
  href="#river"
  dek="The route connects the old station with the northern bridge."
/>`,
      },
    },
  },
};
export const ReducedMotion: Story = { parameters: { chromatic: { pauseAnimationAtEnd: true } } };

const Column = styled.div({ display: 'grid', gap: vars.space[6], minInlineSize: 0 });
const FrontGrid = styled.div({ display: 'grid', gap: vars.space[6], [ARTICLE_DESKTOP]: { gridTemplateColumns: 'minmax(0, 7fr) minmax(0, 5fr)' } });
const InvertedGrid = styled(FrontGrid)({ [ARTICLE_DESKTOP]: { gridTemplateColumns: 'minmax(0, 5fr) minmax(0, 7fr)', '& > [data-ui~="article-card"]': { order: 1 } } });
const PairGrid = styled.div({ display: 'grid', gap: vars.space[6], [ARTICLE_DESKTOP]: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' } });
const Briefs = styled.div({ display: 'grid', gap: vars.space[4], [ARTICLE_COLUMNS]: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }, [ARTICLE_DESKTOP]: { gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' } });
const Narrow = styled.div({ maxInlineSize: vars.editorial.centeredMeasure, minInlineSize: 0 });
export const NewspaperFrontPage: Story = {
  render: () => <Column>
    <FrontGrid><ArticleCard size="lead" headline={headline} href="#river" dek={dek} lede={lede} kicker={<ArticleKicker items={[{ id: 'city', label: 'The city' }]} />} /><Column><ArticleCard size="secondary" headline="Work begins at the old station" href="#station" dek={dek} /><ArticleCard size="secondary" headline="The northern bridge reopens" href="#bridge" /></Column></FrontGrid>
    <Briefs>{['The river', 'The station', 'The bridge', 'The path'].map((title) => <ArticleCard key={title} size="brief" headline={title} href="#brief" />)}</Briefs>
    <ArticleList variant="wire" items={[{ id: 'river', headline, href: '#river', time }, { id: 'station', headline: 'Work begins at the old station', href: '#station', time }]} />
    <FrontGrid><ArticleCard size="secondary" headline={headline} dek={dek} /><Column><ArticleCard headline="The station" /><ArticleCard headline="The bridge" /></Column></FrontGrid>
    <InvertedGrid><ArticleCard size="secondary" headline={headline} dek={dek} /><Column><ArticleCard headline="The station" /><ArticleCard headline="The bridge" /></Column></InvertedGrid>
    <PairGrid>{['The river', 'The station', 'The bridge', 'The path'].map((title) => <ArticleCard key={title} headline={title} dek={dek} />)}</PairGrid>
    <FrontGrid><ArticleCard headline={headline} dek={dek} /><ArticleList items={[{ id: 'station', headline: 'The station', href: '#station', time }]} /></FrontGrid>
  </Column>,
  parameters: { docs: { source: { code: `<ArticleCard size="lead" headline="The river path opens for the weekend" href="#river" />
<ArticleList variant="wire" items={[{ id: 'station', headline: 'Work begins at the old station', href: '#station' }]} />` } } },
};
export const ArticleHeader: Story = {
  render: () => <Narrow><ArticleKicker items={[{ id: 'city', label: 'The city', href: '#city' }]} /><ArticleCard.Headline size="lead" level={1}>{headline}</ArticleCard.Headline><ArticleCard.Dek size="lead">{dek}</ArticleCard.Dek><ArticleMeta variant="ruled" place="Northline" published={time} /></Narrow>,
  parameters: { docs: { source: { code: `<ArticleKicker items={[{ id: 'city', label: 'The city' }]} />
<ArticleCard.Headline size="lead" level={1}>The river path opens for the weekend</ArticleCard.Headline>
<ArticleCard.Dek size="lead">The route connects the old station with the northern bridge.</ArticleCard.Dek>
<ArticleMeta variant="ruled" published={{ dateTime: '2026-10-19T09:00:00Z', label: '09:00' }} />` } } },
};
export const HeadingLevels: Story = {
  render: () => <Column>{([1, 2, 3, 4, 5, 6] as const).map((level) => <ArticleCard.Headline key={level} level={level}>Level {level}</ArticleCard.Headline>)}</Column>,
  parameters: { docs: { source: { code: `<ArticleCard.Headline level={1}>The river path opens for the weekend</ArticleCard.Headline>` } } },
  play: async ({ canvas }) => { for (const level of [1, 2, 3, 4, 5, 6]) await expect(canvas.getByRole('heading', { level })).toHaveTextContent(`Level ${level}`); },
};

function Root(props: ComponentPropsWithRef<'article'>) { return <article {...props} data-replacement="root" />; }
function Div(props: ComponentPropsWithRef<'div'>) { return <div {...props} data-replacement="div" />; }
function Heading({ level = 2, ...props }: ComponentPropsWithRef<'h2'> & { level?: ArticleHeadingLevel }) { const H = `h${level}` as const; return <H {...props} data-replacement="heading" />; }
function Paragraph(props: ComponentPropsWithRef<'p'>) { return <p {...props} data-replacement="p" />; }
function Figure(props: ComponentPropsWithRef<'figure'>) { return <figure {...props} data-replacement="figure" />; }
function Time(props: ComponentPropsWithRef<'time'>) { return <time {...props} data-replacement="time" />; }
function Caption(props: ComponentPropsWithRef<'figcaption'>) { return <figcaption {...props} data-replacement="caption" />; }
function Credit(props: ComponentPropsWithRef<'span'>) { return <span {...props} data-replacement="credit" />; }
function Link(props: ComponentPropsWithRef<'a'>) { return <a {...props} data-replacement="link" />; }
const cardRef = createRef<HTMLElement>();
const headingRef = createRef<HTMLHeadingElement>();
export const ReplacementSlots: Story = {
  args: { ref: cardRef, slots: { root: Root, content: Div, time: Time, kicker: Div, headline: Heading, dek: Paragraph, lede: Paragraph, media: Figure, meta: Div }, slotProps: { root: { id: 'slot-card', 'data-ui': 'custom article-card' }, headline: { ref: headingRef, level: 3 }, lede: { visibility: 'always' } }, time, kicker: 'The city', lede, media: <p>The river path</p>, meta: <ArticleMeta published={time} /> },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import type { ComponentPropsWithRef } from 'react';
import { ArticleCard, ArticleMeta } from '@jfrader/ui';

function Root(props: ComponentPropsWithRef<'article'>) {
  return <article {...props} />;
}
function Div(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} />;
}
function Heading({ level = 2, ...props }: ComponentPropsWithRef<'h2'> & { level?: 1 | 2 | 3 | 4 | 5 | 6 }) {
  const H = \`h\${level}\` as const;
  return <H {...props} />;
}
function Paragraph(props: ComponentPropsWithRef<'p'>) {
  return <p {...props} />;
}
function Figure(props: ComponentPropsWithRef<'figure'>) {
  return <figure {...props} />;
}
function Time(props: ComponentPropsWithRef<'time'>) {
  return <time {...props} />;
}

<ArticleCard
  headline="The river path opens for the weekend"
  href="#river"
  dek="The route connects the old station with the northern bridge."
  lede="Work along the river began at the station. The last section opens this weekend, linking the two bridges with a continuous path."
  kicker="The city"
  time={{ dateTime: '2026-10-19T09:00:00Z', label: '09:00' }}
  media={<p>The river path</p>}
  meta={<ArticleMeta published={{ dateTime: '2026-10-19T09:00:00Z', label: '09:00' }} />}
  slots={{
    root: Root,
    content: Div,
    time: Time,
    kicker: Div,
    headline: Heading,
    dek: Paragraph,
    lede: Paragraph,
    media: Figure,
    meta: Div,
  }}
  slotProps={{
    headline: { level: 3 },
    lede: { visibility: 'always' },
  }}
/>`,
      },
    },
  },
  play: async ({ canvas, canvasElement }) => {
    await expect(cardRef.current).toBe(canvas.getByRole('article'));
    await expect(headingRef.current).toBe(canvas.getByRole('heading', { level: 3 }));
    await expect(cardRef.current).toHaveAttribute('data-ui', 'article-card custom');
    await expectArticleHydration(<ArticleCard headline={headline} time={time} meta={<ArticleMeta published={time} />} />, canvasElement);
    const host = canvasElement.ownerDocument.createElement('div'); canvasElement.append(host);
    const attach = fn(); const cleanup = fn();
    const root = createRoot(host);
    try {
      await act(async () => root.render(<StrictMode><ArticleCard headline={headline} ref={(node) => { if (node) attach(); return cleanup; }} /></StrictMode>));
      await act(async () => root.unmount());
      await expect(attach.mock.calls.length).toBeGreaterThan(0);
      await expect(cleanup.mock.calls.length).toBe(attach.mock.calls.length);
    } finally { host.remove(); }
  },
};
export const RuleReplacement: Story = {
  args: { variant: 'rule-bottom', slots: { rule: Div } },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import type { ComponentPropsWithRef } from 'react';
import { ArticleCard } from '@jfrader/ui';

function Div(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} />;
}

<ArticleCard
  variant="rule-bottom"
  headline="The river path opens for the weekend"
  href="#river"
  dek="The route connects the old station with the northern bridge."
  slots={{ rule: Div }}
/>`,
      },
    },
  },
};
export const Compound: Story = {
  render: () => <ArticleCard size="brief"><ArticleCard.Headline href="#river">{headline}</ArticleCard.Headline><ArticleCard.Dek>{dek}</ArticleCard.Dek><ArticleCard.Lede visibility="always">{lede}</ArticleCard.Lede><ArticleCard.Media caption="The river path" credit="City archive"><p>The river path</p></ArticleCard.Media></ArticleCard>,
  parameters: { docs: { source: { code: `<ArticleCard size="brief"><ArticleCard.Headline href="#river">The river path opens for the weekend</ArticleCard.Headline><ArticleCard.Dek>The route connects the old station with the northern bridge.</ArticleCard.Dek><ArticleCard.Lede visibility="always">Work along the river began at the station.</ArticleCard.Lede></ArticleCard>` } } },
};
export const PartSlots: Story = {
  render: () => <ArticleCard data-ui="consumer-card article-card">
    <ArticleCard.Headline level={3} href="#river" slots={{ root: Heading, link: Link }} slotProps={{ link: { target: '_blank', rel: 'author' } }}>{headline}</ArticleCard.Headline>
    <ArticleCard.Dek slots={{ root: Paragraph }}>{dek}</ArticleCard.Dek>
    <ArticleCard.Lede visibility="always" slots={{ root: Paragraph }}>{lede}</ArticleCard.Lede>
    <ArticleCard.Media caption="The river path" credit="City archive" slots={{ root: Figure, caption: Caption, credit: Credit }}><p>The river path</p></ArticleCard.Media>
  </ArticleCard>,
  parameters: { docs: { source: { code: `<ArticleCard><ArticleCard.Headline level={3} href="#river">The river path opens for the weekend</ArticleCard.Headline><ArticleCard.Media caption="The river path" credit="City archive"><p>The river path</p></ArticleCard.Media></ArticleCard>` } } },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole('article')).toHaveAttribute('data-ui', 'article-card consumer-card');
    await expect(canvas.getByRole('link')).toHaveAttribute('rel', 'author noopener noreferrer');
    await expect(canvasElement.querySelectorAll('[data-replacement="p"]')).toHaveLength(2);
    await expect(canvasElement.querySelector('figcaption')).toHaveAttribute('data-replacement', 'caption');
    await expect(canvasElement.querySelector('[data-ui~="article-card-media-credit"]')).toHaveAttribute('data-replacement', 'credit');
  },
};
export const RouterLink: Story = {
  render: () => <ArticleCard.Headline href="#river" renderLink={(props) => <a {...props} data-router="true" />}>{headline}</ArticleCard.Headline>,
  parameters: { docs: { source: { code: `<ArticleCard.Headline href="#river" renderLink={(props) => <a {...props} />}>The river path opens for the weekend</ArticleCard.Headline>` } } },
  play: async ({ canvas }) => { await expect(canvas.getByRole('link')).toHaveAttribute('data-router', 'true'); },
};
function LoserRoot(props: ComponentPropsWithRef<'article'>) { return <article {...props} data-replacement="loser" />; }
export const SlotContracts: Story = {
  play: async ({ canvasElement }) => {
    const host = canvasElement.ownerDocument.createElement('div');
    canvasElement.append(host);
    const root = createRoot(host);
    const ownRef = createRefCleanupTracker();
    const slotRef = createRefCleanupTracker();
    const parentHeadingRef = createRefCleanupTracker<HTMLHeadingElement>();
    const ownHeadingRef = createRefCleanupTracker<HTMLHeadingElement>();
    const parentHeadingRootRef = createRefCleanupTracker<HTMLHeadingElement>();
    const ownHeadingRootRef = createRefCleanupTracker<HTMLHeadingElement>();
    const ownClick = fn();
    const slotClick = fn();
    const render = (muted: boolean) => <StrictMode><ArticleCard ref={ownRef.ref} component={LoserRoot} slots={{ root: Root }} onClick={ownClick} data-ui="consumer" className="consumer-root" sx={{ color: muted ? vars.color.textMuted : vars.color.text }} slotProps={{ root: { ref: slotRef.ref, onClick: slotClick, id: 'slot-contract', className: 'slot-root' }, headline: { ref: parentHeadingRef.ref, slotProps: { root: { ref: parentHeadingRootRef.ref } } } }}><ArticleCard.Headline ref={ownHeadingRef.ref} slotProps={{ root: { ref: ownHeadingRootRef.ref } }}>{headline}</ArticleCard.Headline></ArticleCard></StrictMode>;
    try {
      await act(async () => root.render(render(false)));
      const before = await expectRootPrecedence(host, '[data-replacement="root"]', '[data-replacement="loser"]');
      await expect(before).toHaveClass('consumer-root', 'slot-root');
      await expect(before).toHaveAttribute('data-ui', 'article-card consumer');
      await expect(ownRef.getNode()).toBe(before);
      await expect(slotRef.getNode()).toBe(before);
      await expect(parentHeadingRef.getNode()).toBe(ownHeadingRef.getNode());
      await expect(parentHeadingRootRef.getNode()).toBe(ownHeadingRef.getNode());
      await expect(ownHeadingRootRef.getNode()).toBe(ownHeadingRef.getNode());
      await fireEvent.click(before);
      await expect(slotClick).toHaveBeenCalledTimes(1);
      await expect(ownClick).not.toHaveBeenCalled();
      await act(async () => root.render(render(true)));
      await expectSameDomIdentity(before, host.querySelector('article'));
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
    for (const tracker of [ownRef, slotRef, parentHeadingRef, ownHeadingRef, parentHeadingRootRef, ownHeadingRootRef]) {
      await expect(tracker.getCleanupCount()).toBe(tracker.getAttachCount());
      await expect(tracker.isCleanedUp()).toBe(true);
    }
  },
};
export const StyleOverrides: Story = {
  render: () => <ArticleCard variant="centered">
    <ArticleKicker sx={{ justifyContent: 'flex-start' }} items={[{ id: 'city', label: 'The city' }]} />
    <ArticleCard.Headline sx={{ lineHeight: vars.lineHeight.relaxed }}>{headline}</ArticleCard.Headline>
    <ArticleCard.Dek sx={{ maxInlineSize: 'none' }}>{dek}</ArticleCard.Dek>
    <ArticleMeta sx={{ justifyContent: 'flex-start' }} published={time} />
  </ArticleCard>,
  parameters: { docs: { source: { code: `<ArticleCard variant="centered"><ArticleCard.Headline sx={{ lineHeight: theme.lineHeight.relaxed }}>The river path opens for the weekend</ArticleCard.Headline><ArticleCard.Dek sx={{ maxInlineSize: 'none' }}>The route connects the old station with the northern bridge.</ArticleCard.Dek></ArticleCard>` } } },
  play: async ({ canvas, canvasElement }) => {
    const headingStyle = getComputedStyle(canvas.getByRole('heading'));
    await expect(Number.parseFloat(headingStyle.lineHeight) / Number.parseFloat(headingStyle.fontSize)).toBeCloseTo(Number(base.lineHeight.relaxed));
    await expect(getComputedStyle(canvasElement.querySelector('[data-ui~="article-card-dek"]')!).maxInlineSize).toBe('none');
    for (const name of ['article-meta', 'article-kicker']) await expect(getComputedStyle(canvasElement.querySelector(`[data-ui~="${name}"]`)!).justifyContent).toBe('flex-start');
  },
};
