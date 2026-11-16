import { useState, type ComponentPropsWithRef, type ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, waitFor, within } from 'storybook/test';
import { Book, Broadcast, Check } from '@jfrader/icons';
import { vars } from '@jfrader/tokens/vars';
import { expectAligned, expectNoOverlap } from '../../testing/geometry-assertions';
import { withLightTheme } from '../../testing/story-decorators';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { Button, Card, HoverCard, Pagination, styled, type ButtonProps, type HoverCardContentProps, type HoverCardTriggerProps } from '../../index';
import { LinearTimeline } from './index';

interface Article {
  id: string;
  section: string;
  headline: string;
  place: string;
  time: string;
}

interface Moment {
  id: string;
  /** ISO date; the consumer formats it. */
  at: string;
  title: string;
  kind: 'proposal' | 'consultation' | 'vote' | 'today';
  articles: readonly Article[];
}

// Fictional city news: one moment per instant, articles that share it stay together.
const MOMENTS: readonly Moment[] = [
  { id: 'draft', at: '2026-02-03', title: 'Draft filed', kind: 'proposal', articles: [
    { id: 'a1', section: 'City', headline: 'Culture office proposes opening the central library until midnight', place: 'Valdemora', time: '10:00' },
  ] },
  { id: 'consultation', at: '2026-02-17', title: 'Public consultation opens', kind: 'consultation', articles: [
    { id: 'a2', section: 'City', headline: 'Residents can weigh in on late library hours for 30 days', place: 'Valdemora', time: '09:00' },
    { id: 'a3', section: 'Districts', headline: 'Three community centers set up ballot boxes for the consultation', place: 'North district', time: '09:00' },
  ] },
  { id: 'closing', at: '2026-03-19', title: 'Consultation closes', kind: 'consultation', articles: [
    { id: 'a4', section: 'City', headline: 'Consultation closes with 1,240 responses', place: 'Valdemora', time: '18:00' },
  ] },
  { id: 'committee', at: '2026-04-08', title: 'Committee report', kind: 'proposal', articles: [
    { id: 'a5', section: 'Politics', headline: 'Committee adds night staff to the proposal', place: 'Valdemora', time: '12:00' },
  ] },
  { id: 'vote', at: '2026-04-22', title: 'Council vote', kind: 'vote', articles: [
    { id: 'a6', section: 'Politics', headline: 'Council approves late hours by 14 votes to 3', place: 'Valdemora', time: '21:30' },
    { id: 'a7', section: 'City', headline: 'Librarians ask for a third night shift on weekends', place: 'Valdemora', time: '21:30' },
    { id: 'a8', section: 'Economy', headline: 'Budget sets aside funds for the new schedule', place: 'Valdemora', time: '21:30' },
  ] },
  { id: 'gazette', at: '2026-05-05', title: 'Published in the gazette', kind: 'proposal', articles: [
    { id: 'a9', section: 'City', headline: 'Ordinance 2118 appears in the official gazette', place: 'Valdemora', time: '08:00' },
  ] },
  { id: 'opening', at: '2026-06-02', title: 'First late night', kind: 'today', articles: [
    { id: 'a10', section: 'City', headline: 'Reading room stays open until midnight for the first time', place: 'Valdemora', time: '20:00' },
    { id: 'a11', section: 'Culture', headline: 'Weekly reading series opens the new schedule', place: 'Valdemora', time: '20:00' },
  ] },
];

const LOCALE = 'en-US';
const dateFormat = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium', timeZone: 'UTC' });
const formatDate = (iso: string) => dateFormat.format(new Date(iso));
const numberFormat = new Intl.NumberFormat(LOCALE);
const pluralRules = new Intl.PluralRules(LOCALE);
const articleCount = (count: number) => `${numberFormat.format(count)} ${pluralRules.select(count) === 'one' ? 'article' : 'articles'}`;
const rangeText = (first: number, last: number, total: number) =>
  `${first === last ? numberFormat.format(first) : numberFormat.formatRange(first, last)} of ${numberFormat.format(total)}`;
/** Outline is authored as 2px; fractional device pixel ratios compute it slightly thinner. */
const RING_TOLERANCE = 1.1;

const Frame = styled.div({ inlineSize: '64rem', maxInlineSize: '100%' });
const NarrowFrame = styled.div({ inlineSize: '20rem', maxInlineSize: '100%' });
const Stack = styled.div({ display: 'flex', flexDirection: 'column', gap: vars.space[2] });
const Toolbar = styled.div({ display: 'flex', flexWrap: 'wrap', gap: vars.space[2], marginBlockEnd: vars.space[4] });
const Kicker = styled.p({
  margin: 0,
  fontSize: vars.textSize.xs,
  fontWeight: vars.fontWeight.semibold,
  letterSpacing: vars.editorial.tracking.label,
  textTransform: 'uppercase',
  color: vars.color.accentText,
});
const When = styled.time({ fontSize: vars.textSize.sm, color: vars.color.textMuted, fontVariantNumeric: 'tabular-nums' });
const Title = styled.p({ margin: 0, fontWeight: vars.fontWeight.medium, color: vars.color.text });
const DetailList = styled.div({ display: 'flex', flexDirection: 'column', gap: vars.space[1], color: vars.color.text });
const Today = styled.span({
  paddingInline: vars.space[1],
  border: `1px solid currentColor`,
  borderRadius: vars.radius.sm,
  fontSize: vars.textSize.xs,
  fontWeight: vars.fontWeight.semibold,
  textTransform: 'uppercase',
  color: vars.color.accentText,
});

function NewsCard({ article }: { article: Article }) {
  return (
    <Card variant="flat">
      <Card.Header>
        <Kicker>{article.section}</Kicker>
        <Card.Title>{article.headline}</Card.Title>
        <Card.Description>
          {article.place} · {article.time}
        </Card.Description>
      </Card.Header>
    </Card>
  );
}
NewsCard.displayName = 'NewsCard';

const date = (moment: Moment) => <When dateTime={moment.at}>{formatDate(moment.at)}</When>;
const stackedCards = (moment: Moment) => (
  <Stack>
    {moment.articles.map((article) => (
      <NewsCard key={article.id} article={article} />
    ))}
  </Stack>
);
const kindIcons = { proposal: Book, consultation: Broadcast, vote: Check } as const;
const kindMarker = (moment: Moment) => {
  if (moment.kind === 'today') return <Today>Today</Today>;
  const Icon = kindIcons[moment.kind];
  return <Icon size={12} decorative />;
};
const momentDetails = (moment: Moment) => (
  <DetailList>
    <When dateTime={moment.at}>{formatDate(moment.at)}</When>
    <Title>{moment.title}</Title>
    <span>{articleCount(moment.articles.length)}</span>
  </DetailList>
);
const momentLabel = (moment: Moment) => `${formatDate(moment.at)}: ${moment.title}`;

const setup = `import { Card, LinearTimeline, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

interface Article { id: string; section: string; headline: string; place: string; time: string }
interface Moment {
  id: string;
  at: string;
  title: string;
  kind: 'proposal' | 'consultation' | 'vote' | 'today';
  articles: Article[];
}

const moments: Moment[] = [
  { id: 'draft', at: '2026-02-03', title: 'Draft filed', kind: 'proposal', articles: [
    { id: 'a1', section: 'City', headline: 'Culture office proposes opening the central library until midnight', place: 'Valdemora', time: '10:00' },
  ] },
  { id: 'consultation', at: '2026-02-17', title: 'Public consultation opens', kind: 'consultation', articles: [
    { id: 'a2', section: 'City', headline: 'Residents can weigh in on late library hours for 30 days', place: 'Valdemora', time: '09:00' },
    { id: 'a3', section: 'Districts', headline: 'Three community centers set up ballot boxes', place: 'North district', time: '09:00' },
  ] },
  // ...
];

const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' });
const Stack = styled.div({ display: 'flex', flexDirection: 'column', gap: vars.space[2] });
const Kicker = styled.p({ margin: 0, fontSize: vars.textSize.xs, color: vars.color.accentText });
const When = styled.time({ color: vars.color.textMuted });

function NewsCard({ article }: { article: Article }) {
  return (
    <Card variant="flat">
      <Card.Header>
        <Kicker>{article.section}</Kicker>
        <Card.Title>{article.headline}</Card.Title>
        <Card.Description>{article.place} · {article.time}</Card.Description>
      </Card.Header>
    </Card>
  );
}

const date = (moment: Moment) => <When dateTime={moment.at}>{dateFormat.format(new Date(moment.at))}</When>;`;

const docs = (code: string) => ({ docs: { source: { language: 'tsx', code } } });

const listOf = (root: HTMLElement) => root.querySelector<HTMLOListElement>('[data-ui~="linear-timeline-list"]')!;
const itemsOf = (root: HTMLElement) => Array.from(listOf(root).children) as HTMLElement[];
const visibleOf = (root: HTMLElement) => itemsOf(root).filter((item) => !item.hidden);
/** How many items fit, read the same way the component reads it. */
function fitCount(root: HTMLElement) {
  const probe = root.querySelector('[data-ui="linear-timeline-probe"]')!;
  return Math.floor(listOf(root).getBoundingClientRect().width / probe.getBoundingClientRect().width + 0.001);
}
async function expectFocusRing(element: HTMLElement) {
  await expect(element.ownerDocument.activeElement).toBe(element);
  const style = getComputedStyle(element);
  await expect(style.outlineStyle).not.toBe('none');
  await expect(Math.abs(Number.parseFloat(style.outlineWidth) - 2)).toBeLessThan(RING_TOLERANCE);
}
async function expectNoInternalScroll(root: HTMLElement) {
  for (const element of [root, listOf(root)]) {
    await expect(element.scrollWidth).toBeLessThanOrEqual(element.clientWidth);
    await expect(element.scrollHeight).toBeLessThanOrEqual(element.clientHeight);
  }
}

const meta = {
  title: 'Data display/LinearTimeline',
  component: LinearTimeline<Moment>,
  args: { items: MOMENTS, content: stackedCards },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <Frame>
        <Story />
      </Frame>
    ),
  ],
  parameters: {
    layout: 'padded',
    docs: {
      sections: [
        { title: 'Orientation', stories: ['NewsChronology', 'Horizontal', 'HorizontalFit'] },
        { title: 'Simultaneous moments', stories: ['HorizontalCards', 'OneAtATime'] },
        { title: 'Markers', stories: ['CompactDots', 'CustomMarkers'] },
        { title: 'Edge cases', stories: ['SingleItem', 'Empty', 'RightToLeft'] },
        { title: 'Customization', stories: ['StyledParts', 'LightTheme'] },
      ],
      source: { language: 'tsx', code: `${setup}\n\n<LinearTimeline aria-label="Library hours" items={moments} opposite={date} content={(moment) => (\n  <Stack>{moment.articles.map((article) => <NewsCard key={article.id} article={article} />)}</Stack>\n)} />` },
      description: {
        component: 'Show moments in order along a thin rail, with content on one side and a short label such as a date on the other.',
      },
      usage: `### When to use
- Use it for a chronology the reader scans in order: milestones, a story's events, release history. For steps a person completes, use \`Stepper\`. For a live activity log, use \`Timeline\`.
- Pass moments already in display order. The timeline does not read, sort, or group dates; render several articles from one moment's \`content\` when they share a time.

### Layout
- Vertical timelines grow with the page and show every moment.
- Horizontal timelines show every moment that fits at \`minItemSize\`. When fewer fit, Previous and Next page the row and a status shows the range. The row never scrolls.
- Moments outside the window stay mounted and hidden, so state inside \`content\` survives paging.
- Before the first measurement, such as during server rendering, a horizontal timeline shows every moment and wraps.

### Keyboard and accessibility
- The timeline is an ordered list. Name it with \`aria-label\` or \`aria-labelledby\`; both land on the list.
- With \`content\` or \`opposite\`, markers are decorative. Put anything a marker means into the content too.
- Without \`content\` and \`opposite\`, \`getLabel\` names each marker. With \`details\`, Tab to a marker, hover it, or tap it to read a short summary; press Escape to close. Keep summaries free of links and controls. Render complete articles beside the rail.
- Previous and Next stay focusable at the ends and report \`aria-disabled\`. A resize keeps the focused moment in view.

### Customization
- Custom markers sit on a \`surface\` plate so the rail does not show through an outline glyph. Set \`slotProps.marker.sx\` to match another background.`,
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Read a city's news by date: the date sits at the inline start, every article of that moment at the inline end. */
export const NewsChronology: Story = {
  render: () => (
    <LinearTimeline aria-label="Library hours" items={MOMENTS} opposite={date} content={stackedCards} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const list = canvas.getByRole('list', { name: 'Library hours' });
    await expect(list.tagName).toBe('OL');
    await expect(within(list).getAllByRole('listitem')).toHaveLength(MOMENTS.length);
    // Every article of a shared moment renders under one marker, in input order.
    const vote = itemsOf(canvasElement)[4]!;
    await expect(within(vote).getAllByRole('heading').map((heading) => heading.textContent)).toEqual(
      MOMENTS[4]!.articles.map((article) => article.headline),
    );
    const markers = canvasElement.querySelectorAll('[data-ui~="linear-timeline-marker"]');
    await expectAligned(markers, 'center-x');
    for (const item of itemsOf(canvasElement)) {
      const marker = item.querySelector('[data-ui~="linear-timeline-marker"]')!;
      await expectNoOverlap(marker, item.querySelector('[data-ui~="linear-timeline-content"]')!);
      await expectNoOverlap(marker, item.querySelector('[data-ui~="linear-timeline-opposite"]')!);
      await expect(item.querySelector('[data-ui~="linear-timeline-axis"]')).toHaveAttribute('aria-hidden', 'true');
    }
    await expect(canvas.queryByRole('group', { name: 'Timeline pages' })).toBeNull();
    await expectNoInternalScroll(canvasElement.querySelector('[data-ui~="linear-timeline"]')!);
  },
};

/** Page through moments in a row: Previous and Next move a window of as many moments as fit. */
export const Horizontal: Story = {
  render: () => (
    <LinearTimeline
      aria-label="Library hours"
      orientation="horizontal"
      items={MOMENTS}
      opposite={date}
      content={(moment) => <Title>{moment.title}</Title>}
    />
  ),
  parameters: docs(`${setup}\n\n<LinearTimeline\n  aria-label="Library hours"\n  orientation="horizontal"\n  items={moments}\n  opposite={date}\n  content={(moment) => moment.title}\n/>`),
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const root = canvasElement.querySelector<HTMLElement>('[data-ui~="linear-timeline"]')!;
    const fit = fitCount(canvasElement);
    await expect(fit).toBeLessThan(MOMENTS.length);
    await waitFor(() => expect(visibleOf(canvasElement)).toHaveLength(fit));
    const status = canvas.getByRole('status');
    const previous = canvas.getByRole('button', { name: 'Previous items' });
    const next = canvas.getByRole('button', { name: 'Next items' });
    await expect(canvas.getByRole('group', { name: 'Timeline pages' })).toContainElement(status);
    await expect(next).toHaveAttribute('aria-controls', listOf(canvasElement).id);
    await expect(status).toHaveTextContent(rangeText(1, fit, MOMENTS.length));
    await expect(previous).toHaveAttribute('aria-disabled', 'true');
    for (const [index, item] of visibleOf(canvasElement).entries()) {
      await expect(item).toHaveAttribute('aria-posinset', String(index + 1));
      await expect(item).toHaveAttribute('aria-setsize', String(MOMENTS.length));
    }

    await userEvent.tab();
    await expectFocusRing(previous);
    await userEvent.tab();
    await expectFocusRing(next);
    await userEvent.keyboard('{Enter}');
    const secondStart = Math.min(fit, MOMENTS.length - fit);
    await expect(status).toHaveTextContent(rangeText(secondStart + 1, secondStart + fit, MOMENTS.length));
    await expect(visibleOf(canvasElement)[0]).toBe(itemsOf(canvasElement)[secondStart]);
    // Paging keeps every window full: the last one ends on the last moment.
    while (next.getAttribute('aria-disabled') !== 'true') await userEvent.keyboard('{Enter}');
    await expect(status).toHaveTextContent(rangeText(MOMENTS.length - fit + 1, MOMENTS.length, MOMENTS.length));
    await expect(next).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(status).toHaveTextContent(rangeText(MOMENTS.length - fit + 1, MOMENTS.length, MOMENTS.length));
    await userEvent.tab({ shift: true });
    await userEvent.keyboard(' ');
    await expect(previous).toHaveFocus();
    await expect(visibleOf(canvasElement)).toHaveLength(fit);
    // Markers of the window share one rail line.
    if (visibleOf(canvasElement).length > 1) {
      await expectAligned(visibleOf(canvasElement).map((item) => item.querySelector('[data-ui~="linear-timeline-marker"]')!), 'center-y');
    }
    await expectNoInternalScroll(root);
  },
};

/** Show every moment without controls when the row has room for all of them. */
export const HorizontalFit: Story = {
  render: () => (
    <LinearTimeline
      aria-label="Committee stages"
      orientation="horizontal"
      minItemSize="5rem"
      items={MOMENTS.slice(0, 3)}
      opposite={date}
      content={(moment) => <Title>{moment.title}</Title>}
    />
  ),
  parameters: docs(`${setup}\n\n<LinearTimeline\n  aria-label="Committee stages"\n  orientation="horizontal"\n  minItemSize="5rem"\n  items={moments.slice(0, 3)}\n  opposite={date}\n  content={(moment) => moment.title}\n/>`),
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(listOf(canvasElement)).not.toHaveAttribute('data-windowed'));
    await expect(visibleOf(canvasElement)).toHaveLength(3);
    await expect(within(canvasElement).queryByRole('status')).toBeNull();
    const [first, , last] = itemsOf(canvasElement);
    await expect(first!.querySelector('[data-ui~="linear-timeline-axis"]')).toHaveAttribute('data-rail-before', 'none');
    await expect(last!.querySelector('[data-ui~="linear-timeline-axis"]')).toHaveAttribute('data-rail-after', 'none');
  },
};

/** Stack every article of a moment under its marker; widen `minItemSize` to fit cards. */
export const HorizontalCards: Story = {
  render: () => (
    <LinearTimeline
      aria-label="Library hours"
      orientation="horizontal"
      minItemSize="18rem"
      items={MOMENTS}
      opposite={date}
      content={stackedCards}
    />
  ),
  parameters: docs(`${setup}\n\n<LinearTimeline\n  aria-label="Library hours"\n  orientation="horizontal"\n  minItemSize="18rem"\n  items={moments}\n  opposite={date}\n  content={(moment) => (\n    <Stack>{moment.articles.map((article) => <NewsCard key={article.id} article={article} />)}</Stack>\n  )}\n/>`),
};

const ArticlePagination = styled(Pagination)({
  '& [data-ui^="pagination-"]': { minInlineSize: vars.size.touch, minBlockSize: vars.size.touch },
});

function ArticlesAtMoment({ moment }: { moment: Moment }) {
  const [page, setPage] = useState(1);
  return (
    <Stack>
      {moment.articles.map((article, index) => (
        <div key={article.id} hidden={index !== page - 1}>
          <NewsCard article={article} />
        </div>
      ))}
      {moment.articles.length > 1 ? (
        <ArticlePagination
          page={page}
          totalPages={moment.articles.length}
          onPageChange={setPage}
          label={`Articles from ${formatDate(moment.at)}`}
          locale={LOCALE}
        />
      ) : null}
    </Stack>
  );
}

/** Read one article at a time at each moment without scrolling the content. */
export const OneAtATime: Story = {
  render: () => (
    <LinearTimeline
      aria-label="Library hours"
      items={MOMENTS}
      opposite={date}
      content={(moment) => <ArticlesAtMoment moment={moment} />}
    />
  ),
  parameters: docs(`import { useState } from 'react';
${setup.replace("import { Card, LinearTimeline, styled }", "import { Card, LinearTimeline, Pagination, styled }")}

const ArticlePagination = styled(Pagination)({
  '& [data-ui^="pagination-"]': { minInlineSize: vars.size.touch, minBlockSize: vars.size.touch },
});

function ArticlesAtMoment({ moment }: { moment: Moment }) {
  const [page, setPage] = useState(1);
  return (
    <Stack>
      {moment.articles.map((article, index) => (
        <div key={article.id} hidden={index !== page - 1}>
          <NewsCard article={article} />
        </div>
      ))}
      {moment.articles.length > 1 ? (
        <ArticlePagination page={page} totalPages={moment.articles.length} onPageChange={setPage}
          label={\`Articles from \${dateFormat.format(new Date(moment.at))}\`} locale="en-US" />
      ) : null}
    </Stack>
  );
}

<LinearTimeline aria-label="Library hours" items={moments} opposite={date}
  content={(moment) => <ArticlesAtMoment moment={moment} />} />`),
  play: async ({ canvasElement, userEvent }) => {
    const moment = itemsOf(canvasElement)[4]!;
    const canvas = within(moment);
    await expect(canvas.getByRole('heading', { name: MOMENTS[4]!.articles[0]!.headline })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: '2' }));
    await expect(canvas.queryByRole('heading', { name: MOMENTS[4]!.articles[0]!.headline })).toBeNull();
    await expect(canvas.getByRole('heading', { name: MOMENTS[4]!.articles[1]!.headline })).toBeVisible();
    await expectNoInternalScroll(canvasElement.querySelector('[data-ui~="linear-timeline"]')!);
  },
};

/** Show dots only; hover, focus, or tap a dot to read that moment. */
export const CompactDots: Story = {
  render: () => (
    <LinearTimeline
      aria-label="Library hours"
      orientation="horizontal"
      marker="dot"
      items={MOMENTS}
      getLabel={momentLabel}
      details={momentDetails}
    />
  ),
  parameters: docs(`${setup}\n\nconst numbers = new Intl.NumberFormat('en-US');
const plurals = new Intl.PluralRules('en-US');

<LinearTimeline
  aria-label="Library hours"
  orientation="horizontal"
  marker="dot"
  items={moments}
  getLabel={(moment) => \`\${dateFormat.format(new Date(moment.at))}: \${moment.title}\`}
  details={(moment) => (
    <Stack>
      {date(moment)}
      <span>{moment.title}</span>
      <span>{numbers.format(moment.articles.length)} {plurals.select(moment.articles.length) === 'one' ? 'article' : 'articles'}</span>
    </Stack>
  )}
/>`),
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const triggers = within(listOf(canvasElement)).getAllByRole('button');
    await expect(triggers.map((trigger) => trigger.getAttribute('aria-label'))).toEqual(MOMENTS.slice(0, triggers.length).map(momentLabel));
    for (const trigger of triggers) {
      const box = trigger.getBoundingClientRect();
      await expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(32);
    }
    const body = within(canvasElement.ownerDocument.body);

    await userEvent.tab();
    await expect(triggers[0]).toHaveFocus();
    const card = await body.findByRole('tooltip');
    await expect(card).toHaveTextContent(MOMENTS[0]!.title);
    await expect(triggers[0]!.getAttribute('aria-describedby')).toContain(card.id);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(body.queryByRole('tooltip')).toBeNull());
    await expect(triggers[0]).toHaveFocus();

    // A touch tap toggles the card on the tapped marker only.
    const voteLabel = momentLabel(MOMENTS[4]!);
    for (let page = 0; page < MOMENTS.length && !canvas.queryByRole('button', { name: voteLabel }); page++) {
      await userEvent.click(canvas.getByRole('button', { name: 'Next items' }));
    }
    const vote = canvas.getByRole('button', { name: voteLabel });
    await fireEvent.pointerDown(vote, { pointerType: 'touch' });
    await fireEvent.click(vote);
    await expect(await body.findByRole('tooltip')).toHaveTextContent(articleCount(MOMENTS[4]!.articles.length));
    await fireEvent.pointerDown(vote, { pointerType: 'touch' });
    await fireEvent.click(vote);
    await waitFor(() => expect(body.queryByRole('tooltip')).toBeNull());
  },
};

export const NativeInput: Story = {
  tags: ['!autodocs'],
  render: CompactDots.render,
};

/** Render any node as a marker: icons by kind and a text chip for the current moment. */
export const CustomMarkers: Story = {
  render: () => (
    <LinearTimeline
      aria-label="Library hours"
      items={MOMENTS}
      marker={kindMarker}
      opposite={date}
      content={(moment) => <Title>{moment.kind === 'today' ? `${moment.title} (today)` : moment.title}</Title>}
    />
  ),
  parameters: docs(`import { Book, Broadcast, Check } from '@jfrader/icons';
${setup}
const Today = styled.span({ paddingInline: vars.space[1], border: '1px solid currentColor', borderRadius: vars.radius.sm, fontSize: vars.textSize.xs, color: vars.color.accentText });
const icons = { proposal: Book, consultation: Broadcast, vote: Check };

<LinearTimeline
  aria-label="Library hours"
  items={moments}
  marker={(moment) => {
    if (moment.kind === 'today') return <Today>Today</Today>;
    const Icon = icons[moment.kind];
    return <Icon size={12} decorative />;
  }}
  opposite={date}
  content={(moment) => (moment.kind === 'today' ? \`\${moment.title} (today)\` : moment.title)}
/>`),
  play: async ({ canvasElement }) => {
    const markers = Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-ui~="linear-timeline-marker"]'));
    await expect(markers.every((marker) => marker.dataset.kind === 'custom')).toBe(true);
    await expect(markers.at(-1)).toHaveTextContent('Today');
    await expectAligned(markers, 'center-x');
  },
};

/** One moment draws its marker without a rail. */
export const SingleItem: Story = {
  render: () => (
    <LinearTimeline aria-label="Library hours" orientation="horizontal" items={MOMENTS.slice(0, 1)} opposite={date} content={stackedCards} />
  ),
  parameters: docs(`${setup}\n\n<LinearTimeline aria-label="Library hours" orientation="horizontal" items={moments.slice(0, 1)} opposite={date} content={(moment) => moment.title} />`),
  play: async ({ canvasElement }) => {
    const axis = canvasElement.querySelector('[data-ui~="linear-timeline-axis"]')!;
    await expect(axis).toHaveAttribute('data-rail-before', 'none');
    await expect(axis).toHaveAttribute('data-rail-after', 'none');
    await expect(Number.parseFloat(getComputedStyle(axis, '::before').width)).toBeLessThanOrEqual(0);
    await expect(within(canvasElement).queryByRole('status')).toBeNull();
  },
};

/** Show the empty message when there are no moments. */
export const Empty: Story = {
  render: () => (
    <LinearTimeline aria-label="Library hours" items={[] as Moment[]} content={stackedCards} labels={{ empty: 'No coverage yet' }} />
  ),
  parameters: docs(`import { LinearTimeline } from '@jfrader/ui';\n\n<LinearTimeline aria-label="Library hours" items={[]} content={(moment) => moment.title} labels={{ empty: 'No coverage yet' }} />`),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('No coverage yet')).toHaveAttribute('data-ui', 'linear-timeline-empty');
    await expect(within(canvasElement).queryByRole('list')).toBeNull();
  },
};

/** Lay the row out right to left; Previous points right and the first moment sits at the right. */
export const RightToLeft: Story = {
  render: () => (
    <LinearTimeline
      dir="rtl"
      aria-label="Library hours"
      orientation="horizontal"
      items={MOMENTS}
      opposite={date}
      content={(moment) => <Title>{moment.title}</Title>}
    />
  ),
  parameters: docs(`${setup}\n\n<LinearTimeline\n  dir="rtl"\n  aria-label="Library hours"\n  orientation="horizontal"\n  items={moments}\n  opposite={date}\n  content={(moment) => moment.title}\n/>`),
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(listOf(canvasElement)).toHaveAttribute('data-windowed'));
    const [first, second] = visibleOf(canvasElement);
    if (second) await expect(first!.getBoundingClientRect().left).toBeGreaterThan(second.getBoundingClientRect().left);
    const glyph = within(canvasElement).getByRole('button', { name: 'Previous items' }).querySelector('svg')!;
    await expect(getComputedStyle(glyph).transform).toBe('matrix(-1, 0, 0, 1, 0, 0)');
    const axis = visibleOf(canvasElement).at(-1)!.querySelector('[data-ui~="linear-timeline-axis"]')!;
    await expect(axis).toHaveAttribute('data-rail-after', 'fade');
    await expect(getComputedStyle(axis, '::before').maskImage).toContain('to left');
  },
};

const AccentCard = styled(Card)({ borderColor: vars.color.accentBorder });

/** Restyle generated parts with `slotProps` and token values. */
export const StyledParts: Story = {
  render: () => (
    <LinearTimeline
      aria-label="Library hours"
      items={MOMENTS.slice(0, 4)}
      marker="dot"
      opposite={date}
      content={(moment) => (
        <AccentCard variant="flat">
          <Card.Title>{moment.title}</Card.Title>
        </AccentCard>
      )}
      slotProps={{
        axis: { sx: { color: vars.color.accent } },
        opposite: { sx: { fontWeight: vars.fontWeight.semibold } },
      }}
    />
  ),
  parameters: docs(`import { Card, LinearTimeline, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const moments = [
  { id: 'draft', at: '2026-02-03', title: 'Draft filed' },
  { id: 'consultation', at: '2026-02-17', title: 'Public consultation opens' },
  { id: 'closing', at: '2026-03-19', title: 'Consultation closes' },
  { id: 'committee', at: '2026-04-08', title: 'Committee report' },
];
const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' });
const When = styled.time({ fontSize: vars.textSize.sm, color: vars.color.textMuted, fontVariantNumeric: 'tabular-nums' });
const date = (moment: (typeof moments)[number]) => (
  <When dateTime={moment.at}>{dateFormat.format(new Date(moment.at))}</When>
);
const AccentCard = styled(Card)({ borderColor: vars.color.accentBorder });

<LinearTimeline
  aria-label="Library hours"
  items={moments}
  marker="dot"
  opposite={date}
  content={(moment) => (
    <AccentCard variant="flat"><Card.Title>{moment.title}</Card.Title></AccentCard>
  )}
  slotProps={{
    axis: { sx: { color: vars.color.accent } },
    opposite: { sx: { fontWeight: vars.fontWeight.semibold } },
  }}
/>`),
};

/** The same chronology in the light theme. */
export const LightTheme: Story = {
  globals: { theme: 'light' },
  decorators: [withLightTheme],
  render: () => <LinearTimeline aria-label="Library hours" items={MOMENTS.slice(0, 3)} opposite={date} content={stackedCards} />,
  parameters: docs(`${setup}\n\n<LinearTimeline aria-label="Library hours" items={moments} opposite={date} content={(moment) => moment.title} />`),
};

// Regression fixtures below are test-only and stay out of the docs page.

interface Reading {
  slug: string;
  value: ReactNode;
  label: ReactNode;
  marker: ReactNode;
}

const READINGS: readonly Reading[] = [
  { slug: 'zero', value: 0, label: 0, marker: 0 },
  { slug: 'null', value: null, label: null, marker: null },
  { slug: 'false', value: false, label: '', marker: false },
];

/** `0` is content; `null` and `false` render nothing; a marker renderer returning nothing falls back to a square. */
export const FalsyNodes: Story = {
  tags: ['!autodocs'],
  render: () => (
    <LinearTimeline
      aria-label="Readings"
      items={READINGS}
      getKey={(reading) => reading.slug}
      marker={(reading) => reading.marker}
      opposite={(reading) => reading.label}
      content={(reading) => reading.value}
    />
  ),
  play: async ({ canvasElement }) => {
    const [zero, empty, falsy] = itemsOf(canvasElement);
    await expect(zero!.querySelector('[data-ui~="linear-timeline-content"]')).toHaveTextContent('0');
    await expect(zero!.querySelector('[data-ui~="linear-timeline-opposite"]')).toHaveTextContent('0');
    await expect(zero!.querySelector('[data-ui~="linear-timeline-marker"]')).toHaveAttribute('data-kind', 'custom');
    await expect(empty!.querySelector('[data-ui~="linear-timeline-content"]')).toBeNull();
    await expect(empty!.querySelector('[data-ui~="linear-timeline-opposite"]')).toBeNull();
    await expect(empty!.querySelector('[data-ui~="linear-timeline-marker"]')).toHaveAttribute('data-kind', 'square');
    await expect(falsy!.querySelector('[data-ui~="linear-timeline-content"]')).toBeNull();
    await expect(falsy!.querySelector('[data-ui~="linear-timeline-marker"]')).toHaveAttribute('data-kind', 'square');
    // The marker stays in its own track even when a row has no text parts.
    await expectAligned(itemsOf(canvasElement).map((item) => item.querySelector('[data-ui~="linear-timeline-marker"]')!), 'center-x');
  },
};

function ReplacementRoot(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-testid="replacement-root" />;
}
function SugarRoot(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-testid="sugar-root" />;
}
function ReplacementItem(props: ComponentPropsWithRef<'li'>) {
  return <li {...props} data-testid="replacement-item" />;
}
function ReplacementTrigger(props: HoverCardTriggerProps) {
  return <HoverCard.Trigger {...props} data-testid="replacement-trigger" data-received-sx={props.sx !== undefined} />;
}
function ReplacementDetails(props: HoverCardContentProps) {
  return <HoverCard.Content {...props} data-received-sx={props.sx !== undefined} />;
}
function ReplacementNext(props: ButtonProps) {
  return <Button {...props} data-testid="replacement-next" data-received-sx={props.sx !== undefined} />;
}
function ReplacementPrevious(props: ButtonProps) {
  return <Button {...props} data-received-sx={props.sx !== undefined} />;
}

/** Replacement slots receive the part's props and keep its behavior. */
export const SlotReplacement: Story = {
  tags: ['!autodocs'],
  args: { ref: fn() },
  decorators: [(Story) => <NarrowFrame><Story /></NarrowFrame>],
  render: (args) => (
    <LinearTimeline
      ref={args.ref}
      aria-label="Library hours"
      orientation="horizontal"
      marker="dot"
      minItemSize="6rem"
      items={MOMENTS}
      getLabel={momentLabel}
      details={momentDetails}
      component={SugarRoot}
      className="consumer-root"
      data-ui="consumer"
      slots={{ root: ReplacementRoot, item: ReplacementItem, trigger: ReplacementTrigger, details: ReplacementDetails, previousButton: ReplacementPrevious, nextButton: ReplacementNext }}
      slotProps={{
        root: { className: 'slot-root', title: 'slot title' },
        list: { className: 'slot-list', id: 'custom-moments' },
        item: { className: 'slot-item' },
        trigger: { className: 'slot-trigger', sx: { color: vars.color.accentText } },
        details: { className: 'slot-details', sx: { padding: vars.space[2] } },
        previousButton: { sx: { color: vars.color.accentText } },
        nextButton: { sx: { color: vars.color.accentText } },
        range: { className: 'slot-range' },
      }}
    />
  ),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const root = canvas.getByTestId('replacement-root');
    await expect(canvas.queryByTestId('sugar-root')).toBeNull();
    await expect(root).toHaveClass('consumer-root', 'slot-root');
    await expect(root).toHaveAttribute('title', 'slot title');
    await expect(root).toHaveAttribute('data-ui', 'linear-timeline consumer');
    await expect(args.ref).toHaveBeenCalledWith(root);
    await expect(listOf(canvasElement)).toHaveClass('slot-list');
    await expect(canvas.getByRole('button', { name: 'Previous items' })).toHaveAttribute('aria-controls', 'custom-moments');
    await expect(canvas.getByTestId('replacement-next')).toHaveAttribute('aria-controls', 'custom-moments');
    await expect(canvas.getByRole('button', { name: 'Previous items' })).toHaveAttribute('data-received-sx', 'true');
    await expect(canvas.getByTestId('replacement-next')).toHaveAttribute('data-received-sx', 'true');
    const items = canvas.getAllByTestId('replacement-item');
    await expect(items).toHaveLength(MOMENTS.length);
    await expect(items[0]).toHaveClass('slot-item');
    await expect(items[0]).toHaveAttribute('data-ui', 'linear-timeline-item');
    await expect(canvas.getAllByTestId('replacement-trigger')[0]).toHaveClass('slot-trigger');
    await expect(canvas.getAllByTestId('replacement-trigger')[0]).toHaveAttribute('data-received-sx', 'true');
    await waitFor(() => expect(canvas.getByRole('status')).toHaveClass('slot-range'));
    const status = canvas.getByRole('status');
    const before = status.textContent;
    await fireEvent.click(canvas.getByTestId('replacement-next'));
    await expect(status.textContent).not.toBe(before);

    // A replaced trigger still opens the details card, and paging closes it.
    const trigger = visibleOf(canvasElement)[0]!.querySelector<HTMLElement>('[data-testid="replacement-trigger"]')!;
    await fireEvent.pointerDown(trigger, { pointerType: 'touch' });
    await fireEvent.click(trigger);
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByRole('tooltip')).toHaveClass('slot-details');
    await expect(body.getByRole('tooltip')).toHaveAttribute('data-received-sx', 'true');
    await fireEvent.click(canvas.getByRole('button', { name: 'Previous items' }));
    await waitFor(() => expect(body.queryByRole('tooltip')).toBeNull());
  },
};

const ResizableFrame = styled.div({ inlineSize: '100rem', maxInlineSize: 'none' });

/** Shrinking the row keeps the focused moment in view. */
export const ResizeKeepsFocus: Story = {
  tags: ['!autodocs'],
  decorators: [(Story) => <ResizableFrame data-testid="frame"><Story /></ResizableFrame>],
  render: () => (
    <LinearTimeline
      aria-label="Library hours"
      orientation="horizontal"
      items={MOMENTS}
      opposite={date}
      content={(moment) => <Button size="sm">{`Read ${moment.title}`}</Button>}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(visibleOf(canvasElement)).toHaveLength(MOMENTS.length));
    const target = canvas.getByRole('button', { name: `Read ${MOMENTS[5]!.title}` });
    target.focus();
    const frame = canvas.getByTestId('frame');
    const probe = canvasElement.querySelector('[data-ui="linear-timeline-probe"]')!;
    frame.style.inlineSize = `${probe.getBoundingClientRect().width * 2}px`;
    await waitFor(() => expect(visibleOf(canvasElement)).toHaveLength(2));
    await expect(target).toHaveFocus();
    await expect(target.closest('li')!.hidden).toBe(false);
    await expect(canvas.getByRole('status')).toHaveTextContent(rangeText(5, 6, MOMENTS.length));
    canvas.getByRole('button', { name: 'Next items' }).focus();
    frame.style.inlineSize = '100rem';
    await waitFor(() => expect(canvas.queryByRole('group', { name: 'Timeline pages' })).toBeNull());
    await expect(canvasElement.querySelector('[data-ui~="linear-timeline"]')).toHaveFocus();
  },
};

const LargeMarker = styled.span({ inlineSize: `calc(2 * ${vars.space[8]})`, blockSize: vars.space[12], backgroundColor: vars.color.accent });
const largeMarker = () => <LargeMarker data-testid="sized-marker" />;

function ChangingDetailsDemo() {
  const [enabled, setEnabled] = useState(false);
  return (
    <NarrowFrame data-testid="changing-frame">
      <Button onClick={() => setEnabled((value) => !value)}>Toggle details</Button>
      <LinearTimeline orientation="horizontal" items={MOMENTS} minItemSize="6rem"
        marker={largeMarker} getLabel={momentLabel} details={enabled ? momentDetails : undefined} />
    </NarrowFrame>
  );
}

/** Details and custom marker dimensions can change after mounting. */
export const ChangingDetails: Story = {
  tags: ['!autodocs'],
  render: () => <ChangingDetailsDemo />,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const list = listOf(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Toggle details' }));
    await expect(listOf(canvasElement)).toBe(list);
    const frame = canvas.getByTestId('changing-frame');
    const probe = canvasElement.querySelector('[data-ui="linear-timeline-probe"]')!;
    frame.style.inlineSize = `${probe.getBoundingClientRect().width * 2}px`;
    await waitFor(() => expect(visibleOf(canvasElement)).toHaveLength(2));
    for (const node of canvas.getAllByTestId('sized-marker')) node.style.inlineSize = '10rem';
    await waitFor(() => expect(visibleOf(canvasElement)).toHaveLength(1));
    const item = visibleOf(canvasElement)[0]!;
    const marker = item.querySelector('[data-ui~="linear-timeline-marker"]')!.getBoundingClientRect();
    const trigger = item.querySelector('button')!.getBoundingClientRect();
    await expect(marker.width).toBeGreaterThan(100);
    await expect(marker.left).toBeGreaterThanOrEqual(trigger.left);
    await expect(marker.right).toBeLessThanOrEqual(trigger.right);
  },
};

/** Consumer overlays keep their own state instead of joining marker details. */
export const ConsumerOverlays: Story = {
  tags: ['!autodocs'],
  render: () => (
    <LinearTimeline items={MOMENTS.slice(0, 1)}
      opposite={() => <HoverCard triggerLabel="Place preview" profile={{ name: 'Valdemora' }} />}
      content={() => <HoverCard triggerLabel="Person preview" profile={{ name: 'Ada' }} />} />
  ),
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Person preview' }));
    await expect(await body.findByRole('tooltip')).toHaveTextContent('Ada');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(body.queryByRole('tooltip')).toBeNull());
    await userEvent.click(canvas.getByRole('button', { name: 'Place preview' }));
    await expect(await body.findByRole('tooltip')).toHaveTextContent('Valdemora');
    await userEvent.keyboard('{Escape}');
  },
};

/** Custom marker dimensions reserve space on both sides of the rail. */
export const LargeMarkers: Story = {
  tags: ['!autodocs'],
  render: () => (
    <Stack>
      <LinearTimeline items={MOMENTS.slice(0, 2)} marker={() => <LargeMarker />} opposite={date} content={(moment) => moment.title} />
      <LinearTimeline orientation="horizontal" items={MOMENTS.slice(0, 2)} marker={() => <LargeMarker />} opposite={date} content={(moment) => moment.title} />
    </Stack>
  ),
  play: async ({ canvasElement }) => {
    for (const root of canvasElement.querySelectorAll<HTMLElement>('[data-ui~="linear-timeline"]')) {
      for (const item of itemsOf(root)) {
        const marker = item.querySelector<HTMLElement>('[data-ui~="linear-timeline-marker"]')!;
        await waitFor(async () => {
          const box = marker.getBoundingClientRect();
          const parent = root.getBoundingClientRect();
          await expect(box.left).toBeGreaterThanOrEqual(parent.left);
          await expect(box.right).toBeLessThanOrEqual(parent.right);
          await expectNoOverlap(marker, item.querySelector('[data-ui~="linear-timeline-content"]')!);
          await expectNoOverlap(marker, item.querySelector('[data-ui~="linear-timeline-opposite"]')!);
        });
      }
    }
  },
};

/** Before measurement, and while the row has no width, every moment renders and wraps. */
export const PremeasureFallback: Story = {
  tags: ['!autodocs'],
  decorators: [(Story) => <NarrowFrame hidden data-testid="frame"><Story /></NarrowFrame>],
  render: () => (
    <LinearTimeline aria-label="Library hours" orientation="horizontal" items={MOMENTS} opposite={date} content={(moment) => moment.title} />
  ),
  play: async ({ canvasElement }) => {
    const html = renderToString(
      <LinearTimeline aria-label="Library hours" orientation="horizontal" items={MOMENTS} opposite={date} content={(moment) => moment.title} />,
    );
    const template = canvasElement.ownerDocument.createElement('template');
    template.innerHTML = html;
    const server = template.content.querySelector('[data-ui~="linear-timeline-list"]')!;
    await expect(server.children).toHaveLength(MOMENTS.length);
    await expect(server.querySelector('[hidden]')).toBeNull();
    await expect(template.content.querySelector('[role="status"]')).toBeNull();

    // Zero width: nothing is hidden and no controls appear until the row has a size.
    await expect(itemsOf(canvasElement).some((item) => item.hidden)).toBe(false);
    await expect(canvasElement.querySelector('[role="status"]')).toBeNull();
    within(canvasElement).getByTestId('frame').hidden = false;
    await waitFor(() => expect(listOf(canvasElement)).toHaveAttribute('data-windowed'));
    await expect(visibleOf(canvasElement)).toHaveLength(fitCount(canvasElement));
  },
};

function LiveUpdatesDemo() {
  const [items, setItems] = useState<readonly Moment[]>(MOMENTS.slice(2));
  const remove = (label: string | null) => setItems((current) => current.filter((moment) => momentLabel(moment) !== label));
  return (
    <>
      <Toolbar>
        <Button size="sm" onClick={() => setItems(MOMENTS)}>
          Add earlier moments
        </Button>
      </Toolbar>
      <LinearTimeline
        aria-label="Library hours"
        orientation="horizontal"
        marker="dot"
        minItemSize="6rem"
        items={items}
        getLabel={momentLabel}
        details={momentDetails}
        slotProps={{
          trigger: {
            onKeyDown: (event) => {
              if (event.key === 'Delete') remove(event.currentTarget.getAttribute('aria-label'));
            },
          },
        }}
      />
    </>
  );
}

/** New moments keep the window on the moment in view, and removing the focused moment moves focus to a neighbor. */
export const LiveUpdates: Story = {
  tags: ['!autodocs'],
  decorators: [(Story) => <NarrowFrame><Story /></NarrowFrame>],
  render: () => <LiveUpdatesDemo />,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(listOf(canvasElement)).toHaveAttribute('data-windowed'));
    const next = canvas.getByRole('button', { name: 'Next items' });
    await fireEvent.click(next);
    const firstLabel = () => visibleOf(canvasElement)[0]!.querySelector('button')!.getAttribute('aria-label');
    const shown = firstLabel();
    await fireEvent.click(canvas.getByRole('button', { name: 'Add earlier moments' }));
    await waitFor(() => expect(itemsOf(canvasElement)).toHaveLength(MOMENTS.length));
    await expect(firstLabel()).toBe(shown);

    const visible = visibleOf(canvasElement);
    const doomed = visible.at(-1)!.querySelector<HTMLElement>('button')!;
    doomed.focus();
    await userEvent.keyboard('{Delete}');
    await waitFor(() => expect(itemsOf(canvasElement)).toHaveLength(MOMENTS.length - 1));
    const active = canvasElement.ownerDocument.activeElement as HTMLElement;
    await expect(active.dataset.ui).toContain('hover-card-trigger');
    await expect(listOf(canvasElement)).toContainElement(active);
    await expect(active.closest('li')!.hidden).toBe(false);
  },
};

/** Forced colors keep a real rail and real markers. */
export const ForcedColorsRules: Story = {
  tags: ['!autodocs'],
  render: () => <LinearTimeline aria-label="Library hours" items={MOMENTS.slice(0, 2)} content={(moment) => moment.title} />,
  play: async ({ canvasElement }) => {
    const declarations = (element: Element) =>
      Array.from(element.ownerDocument.styleSheets)
        .flatMap((sheet) => {
          try {
            return Array.from(sheet.cssRules);
          } catch {
            return [];
          }
        })
        .filter((rule): rule is CSSMediaRule => rule instanceof CSSMediaRule && rule.conditionText.includes('forced-colors'))
        .flatMap((rule) => Array.from(rule.cssRules))
        .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule && element.matches(rule.selectorText.replace(/::before$/, '')))
        .map((rule) => rule.style);
    const marker = canvasElement.querySelector('[data-ui~="linear-timeline-marker"]')!;
    const axis = canvasElement.querySelector('[data-ui~="linear-timeline-axis"]')!;
    await expect(declarations(marker).some((style) => style.backgroundColor === 'canvastext' || style.backgroundColor === 'CanvasText')).toBe(true);
    await expect(declarations(axis).some((style) => /canvastext/i.test(style.borderColor))).toBe(true);
  },
};
