import { vars } from '@jfrader/tokens/vars';
import { css, keyframes } from '../../styling/css';
import { disclosureCaret } from '../../styling/disclosure-caret';
import { focusRingInset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { withoutSx } from '../../styling/sx';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { partId } from '../../utils/part-id';
import { isRenderable } from '../../utils/renderable';
import type { TimelineEvent, TimelineSlotProps, TimelineSlots } from './timeline';
import { TimelineMarker } from './timeline-marker';

const WIDE_LAYOUT = '@container timeline (min-width: 32rem)';
const fadeIn = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });
// Clips from the title downward; the clip ends with the animation, so open content can overflow.
const unfold = keyframes({ from: { clipPath: 'inset(0 0 100% 0)' }, to: { clipPath: 'inset(0)' } });

const itemStyle = css({
  position: 'relative',
  display: 'grid',
  gridTemplateColumns: 'var(--timeline-marker-size) minmax(0, 1fr)',
  columnGap: 'var(--timeline-column-gap)',
  paddingBlockEnd: 'var(--timeline-row-gap)',
  minInlineSize: 0,
  '&:last-child': { paddingBlockEnd: 0 },
  '&::before': {
    content: '""',
    position: 'absolute',
    insetBlockStart: `calc((var(--timeline-head-size) + var(--timeline-marker-size)) / 2 + ${vars.space[1]})`,
    insetBlockEnd: `calc((var(--timeline-marker-size) - var(--timeline-head-size)) / 2 + ${vars.space[1]})`,
    insetInlineStart: 'calc((var(--timeline-marker-size) - 1px) / 2)',
    borderInlineStart: `1px solid ${vars.color.borderStrong}`,
    pointerEvents: 'none',
  },
  '&:last-child::before': { content: 'none' },
  '&[data-new]': {
    animationName: fadeIn,
    animationDuration: vars.motion.duration.base,
    animationTimingFunction: vars.motion.easeStandard,
  },
  [REDUCED_MOTION]: { '&[data-new]': { animation: 'none' } },
  [FORCED_COLORS]: { '&::before': { borderInlineStartColor: 'GrayText' } },
});

const summaryStyle = css({
  display: 'grid',
  alignContent: 'start',
  minInlineSize: 0,
  [WIDE_LAYOUT]: {
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    columnGap: vars.space[4],
  },
});

const contentStyle = css({ minInlineSize: 0, overflowWrap: 'anywhere' });
const titleStyle = css({
  display: 'flex',
  alignItems: 'center',
  minBlockSize: 'var(--timeline-head-size)',
  fontWeight: vars.fontWeight.medium,
  lineHeight: vars.lineHeight.base,
});

const triggerStyle = css({
  appearance: 'none',
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  gap: vars.space[2],
  inlineSize: `calc(100% + ${vars.space[2]} + 1px)`,
  minBlockSize: 'var(--timeline-head-size)',
  margin: 0,
  marginInlineStart: `calc(-1 * (${vars.space[2]} + 1px))`,
  paddingBlock: vars.space[2],
  paddingInline: vars.space[2],
  border: '1px solid transparent',
  borderRadius: vars.radius.sm,
  backgroundColor: 'transparent',
  font: 'inherit',
  fontWeight: vars.fontWeight.medium,
  color: vars.color.text,
  textAlign: 'start',
  lineHeight: vars.lineHeight.base,
  overflowWrap: 'anywhere',
  cursor: 'pointer',
  transitionProperty: 'background-color',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '--timeline-caret-color': vars.color.textMuted,
  '&:hover, &[aria-expanded="true"]': { '--timeline-caret-color': vars.color.text },
  '&::after': { ...disclosureCaret, transitionProperty: 'transform, color', color: 'var(--timeline-caret-color)' },
  '&[aria-expanded="true"]::after': { transform: 'rotate(90deg)' },
  '&[aria-expanded="true"]:dir(rtl)::after': { transform: 'rotate(-90deg)' },
  '&:hover': { backgroundColor: vars.color.surfaceHover },
  '&:active': { backgroundColor: vars.color.surfaceRaised },
  '&:focus-visible': { ...focusRingInset },
  [REDUCED_MOTION]: { transitionDuration: '0s', '&::after': { transitionDuration: '0s' } },
  [FORCED_COLORS]: {
    '&:focus-visible': { outlineColor: 'Highlight' },
    '&::after': { forcedColorAdjust: 'none', color: 'ButtonText' },
  },
});

const triggerTextStyle = css({ minInlineSize: 0 });
const contextStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  gap: `${vars.space[1]} ${vars.space[2]}`,
  minInlineSize: 0,
  fontSize: vars.textSize.xs,
  color: vars.color.textMuted,
});
const actorStyle = css({ fontWeight: vars.fontWeight.medium });
const metaStyle = css({ minInlineSize: 0 });
const contextDividerStyle = css({ alignSelf: 'center', blockSize: '1em', borderInlineStart: `1px solid ${vars.color.borderStrong}` });
const timeStyle = css({
  display: 'block',
  minInlineSize: 0,
  marginBlockStart: vars.space[1],
  fontSize: vars.textSize.xs,
  color: vars.color.textMuted,
  fontVariantNumeric: 'tabular-nums',
  lineHeight: vars.lineHeight.base,
  overflowWrap: 'anywhere',
  [WIDE_LAYOUT]: {
    maxInlineSize: '18ch',
    marginBlockStart: 0,
    paddingBlockStart: `calc((var(--timeline-head-size) - 1lh) / 2)`,
    textAlign: 'end',
  },
});

const detailStyle = css({
  gridColumn: 2,
  minInlineSize: 0,
  marginBlockStart: vars.space[2],
  color: vars.color.textMuted,
  lineHeight: vars.lineHeight.relaxed,
  overflowWrap: 'anywhere',
  '& > :first-child': { marginBlockStart: 0 },
  '& > :last-child': { marginBlockEnd: 0 },
  '&[hidden]': { display: 'none' },
  '&[data-enter]': {
    animationName: unfold,
    animationDuration: vars.motion.duration.slow,
    animationTimingFunction: vars.motion.easeStandard,
  },
  [REDUCED_MOTION]: { '&[data-enter]': { animation: 'none' } },
});

interface TimelineRowProps {
  event: TimelineEvent;
  epoch: number | null;
  timeLabel: string;
  fullDate: string;
  baseId: string;
  expanded: boolean;
  /** Opened since the previous commit, so the detail unfolds. */
  opening: boolean;
  entering: boolean;
  onToggle: (id: string) => void;
  slotProps?: TimelineSlotProps;
  slots?: TimelineSlots;
}

export function TimelineRow({
  event,
  epoch,
  timeLabel,
  fullDate,
  baseId,
  expanded,
  opening,
  entering,
  onToggle,
  slotProps,
  slots,
}: TimelineRowProps) {
  const Item = slots?.item ?? 'li';
  const Trigger = slots?.trigger ?? 'button';
  const Time = slots?.time ?? 'time';
  const Detail = slots?.detail ?? 'div';
  const expandable = isRenderable(event.detail) && event.detail !== '';
  const state = expanded ? 'open' : 'closed';
  const hasMeta = isRenderable(event.meta) && event.meta !== '';
  const detailId = partId(baseId, 'detail', event.id);
  const fullDateId = partId(baseId, 'when', event.id);
  const describedBy = [slotProps?.trigger?.['aria-describedby'], epoch === null ? undefined : fullDateId].filter(Boolean).join(' ') || undefined;

  return (
    <Item
      {...withoutSx(slotProps?.item)}
      data-ui="timeline-item"
      data-event-id={event.id}
      data-tone={event.tone ?? 'neutral'}
      data-state={expandable ? state : undefined}
      data-new={entering ? '' : undefined}
      className={slotProps?.item?.className}
      css={[itemStyle, slotProps?.item?.sx]}
    >
      <TimelineMarker event={event} part={slotProps?.marker} component={slots?.marker} />
      <div data-ui="timeline-summary" css={summaryStyle}>
        <div css={contentStyle}>
          {expandable ? (
            <Trigger
              {...withoutSx(slotProps?.trigger)}
              type="button"
              data-ui="timeline-trigger"
              aria-expanded={expanded}
              aria-controls={detailId}
              aria-describedby={describedBy}
              onClick={(click) => {
                slotProps?.trigger?.onClick?.(click);
                if (!click.defaultPrevented) onToggle(event.id);
              }}
              className={slotProps?.trigger?.className}
              css={[triggerStyle, slotProps?.trigger?.sx]}
            >
              <span css={triggerTextStyle}>{event.title}</span>
            </Trigger>
          ) : (
            <div data-ui="timeline-title" css={titleStyle}>{event.title}</div>
          )}
          {event.actor || hasMeta ? (
            <div data-ui="timeline-context" css={contextStyle}>
              {event.actor ? <span data-ui="timeline-actor" css={actorStyle}>{event.actor}</span> : null}
              {event.actor && hasMeta ? <span aria-hidden="true" css={contextDividerStyle} /> : null}
              {hasMeta ? <div data-ui="timeline-meta" css={metaStyle}>{event.meta}</div> : null}
            </div>
          ) : null}
        </div>
        {epoch === null ? null : (
          <Time
            {...withoutSx(slotProps?.time)}
            dateTime={new Date(epoch).toISOString()}
            data-ui="timeline-time"
            className={slotProps?.time?.className}
            css={[timeStyle, slotProps?.time?.sx]}
          >
            {timeLabel}
            <span id={fullDateId} css={visuallyHiddenStyle}>{fullDate}</span>
          </Time>
        )}
      </div>
      {expandable ? (
        <Detail
          {...withoutSx(slotProps?.detail)}
          id={detailId}
          hidden={!expanded}
          data-ui="timeline-detail"
          data-state={state}
          data-enter={opening ? '' : undefined}
          onFocus={(focus) => {
            slotProps?.detail?.onFocus?.(focus);
            for (const animation of focus.currentTarget.getAnimations()) {
              if ('animationName' in animation && animation.animationName === unfold.name) animation.finish();
            }
          }}
          className={slotProps?.detail?.className}
          css={[detailStyle, slotProps?.detail?.sx]}
        >
          {event.detail}
        </Detail>
      ) : null}
    </Item>
  );
}
