import { createRef, type ComponentPropsWithRef } from 'react';
import { LinearTimeline, type LinearTimelineProps } from './index';

interface Moment {
  id: string;
  at: string;
  headlines: readonly string[];
  weight: 'major' | 'minor';
}

interface Reading {
  slug: string;
  value: number;
}

const moments: readonly Moment[] = [{ id: 'a', at: '2026-02-03', headlines: ['Opening'], weight: 'major' }];
const readings: readonly Reading[] = [{ slug: 'r1', value: 3 }];

export function linearTimelineTypeContracts() {
  // Item metadata reaches every renderer through inference from `items`.
  <LinearTimeline
    items={moments}
    marker={(moment) => (moment.weight === 'major' ? 'M' : null)}
    opposite={(moment) => moment.at}
    content={(moment, index) => moment.headlines.map((headline) => `${index}: ${headline}`)}
  />;
  // @ts-expect-error Renderers do not widen the item type.
  <LinearTimeline items={moments} content={(moment) => moment.missing} />;
  // @ts-expect-error A narrower callback parameter cannot redefine the item type.
  <LinearTimeline items={moments} content={(moment: Reading) => moment.value} />;

  // Items without `id` need `getKey`; items with `id` may still choose another identity.
  <LinearTimeline items={readings} getKey={(reading) => reading.slug} content={(reading) => reading.value} />;
  // @ts-expect-error `getKey` is required when items have no `id`.
  <LinearTimeline items={readings} content={(reading) => reading.value} />;
  <LinearTimeline items={moments} getKey={(moment) => moment.at} content={(moment) => moment.at} />;
  // @ts-expect-error Keys are strings or numbers.
  <LinearTimeline items={readings} getKey={() => ({})} content={() => null} />;

  // Markers-only timelines name every marker; details are optional.
  <LinearTimeline items={moments} orientation="horizontal" marker="dot" getLabel={(moment) => moment.at} />;
  <LinearTimeline items={moments} getLabel={(moment) => moment.at} details={(moment) => moment.headlines.join(', ')} />;
  // @ts-expect-error A timeline needs content, an opposite label, or marker labels.
  <LinearTimeline items={moments} />;
  // @ts-expect-error Marker details are for markers-only timelines.
  <LinearTimeline items={moments} content={(moment) => moment.at} details={(moment) => moment.at} />;
  // @ts-expect-error Marker labels must be strings.
  <LinearTimeline items={moments} getLabel={(moment) => moment.headlines} />;
  // @ts-expect-error Marker shapes are a closed set.
  <LinearTimeline items={moments} marker="star" content={(moment) => moment.at} />;
  // @ts-expect-error Orientation is a closed set.
  <LinearTimeline items={moments} orientation="diagonal" content={(moment) => moment.at} />;

  // Slots receive the element they replace; slot props complete native attributes.
  const itemSlot = (props: ComponentPropsWithRef<'li'>) => <li {...props} />;
  <LinearTimeline
    items={moments}
    content={(moment) => moment.at}
    ref={createRef<HTMLDivElement>()}
    slots={{ item: itemSlot, list: (props) => <ol {...props} /> }}
    slotProps={{
      list: { 'aria-labelledby': 'heading', onKeyDown: (event) => event.currentTarget.focus() },
      item: { className: 'moment', sx: { minInlineSize: 0 } },
      previousButton: { variant: 'outline' },
      trigger: { onPointerEnter: (event) => event.currentTarget.blur() },
    }}
  />;
  // @ts-expect-error The root ref is a div.
  <LinearTimeline items={moments} content={(moment) => moment.at} ref={createRef<HTMLButtonElement>()} />;
  // @ts-expect-error List replacements receive ordered-list props, not button props.
  <LinearTimeline items={moments} content={(moment) => moment.at} slots={{ list: (props: ComponentPropsWithRef<'button'>) => <button {...props} /> }} />;
  // @ts-expect-error Repeated parts share one props object, so per-item ids are rejected.
  <LinearTimeline items={moments} content={(moment) => moment.at} slotProps={{ item: { id: 'one' } }} />;
  // @ts-expect-error Window visibility belongs to the timeline, not the repeated item template.
  <LinearTimeline items={moments} content={(moment) => moment.at} slotProps={{ item: { hidden: false } }} />;
  // @ts-expect-error Unknown slots are rejected.
  <LinearTimeline items={moments} content={(moment) => moment.at} slots={{ rail: () => null }} />;
  // @ts-expect-error Unknown slot props are rejected.
  <LinearTimeline items={moments} content={(moment) => moment.at} slotProps={{ rail: {} }} />;

  type HasPublicCss<P> = 'css' extends keyof P ? true : false;
  const rootHasCss: HasPublicCss<LinearTimelineProps<Moment>> = false;
  return [rootHasCss];
}
