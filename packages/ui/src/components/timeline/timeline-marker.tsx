import { vars } from '@jfrader/tokens/vars';
import { css, keyframes, type SerializedStyles } from '../../styling/css';
import { iconWrapperStyle } from '../../styling/icon-wrapper';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { withoutSx } from '../../styling/sx';
import { isRenderable } from '../../utils/renderable';
import { Avatar } from '../avatar';
import type { TimelineEvent, TimelineSlotProps, TimelineSlots, TimelineTone } from './timeline';

// One ring in the marker's tone spreads out and fades; a shadow, so it never moves the marker's box.
const halo = keyframes({
  from: { boxShadow: '0 0 0 0 currentColor' },
  to: { boxShadow: `0 0 0 ${vars.space[2]} transparent` },
});

const markerStyle = css({
  position: 'relative',
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  inlineSize: 'var(--timeline-marker-size)',
  blockSize: 'var(--timeline-marker-size)',
  marginBlockStart: 'calc((var(--timeline-head-size) - var(--timeline-marker-size)) / 2)',
  border: `1px solid ${vars.color.borderStrong}`,
  borderRadius: vars.radius.full,
  backgroundColor: vars.color.surfaceHover,
  color: vars.color.textMuted,
  fontSize: vars.textSize.xs,
  '&[data-kind="avatar"], &[data-kind="dot"]': { borderWidth: 0, backgroundColor: 'transparent' },
  '[data-new] > &': {
    animationName: halo,
    animationDuration: vars.motion.duration.presence,
    animationTimingFunction: vars.motion.easeStandard,
  },
  [REDUCED_MOTION]: { '[data-new] > &': { animation: 'none' } },
  [FORCED_COLORS]: { borderColor: 'CanvasText', color: 'CanvasText' },
});

const toneStyles: Record<TimelineTone, SerializedStyles> = {
  neutral: css({}),
  success: css({ borderColor: vars.color.success, backgroundColor: vars.color.successSoft, color: vars.color.success }),
  danger: css({ borderColor: vars.color.dangerText, backgroundColor: vars.color.dangerSoft, color: vars.color.dangerText }),
};

const avatarStyle = css({ inlineSize: '100%', blockSize: '100%', fontSize: 'inherit' });
const dotStyle = css({
  inlineSize: vars.space[2],
  blockSize: vars.space[2],
  borderRadius: vars.radius.full,
  backgroundColor: 'currentColor',
  [FORCED_COLORS]: { backgroundColor: 'CanvasText', forcedColorAdjust: 'none' },
});

interface TimelineMarkerProps {
  event: TimelineEvent;
  part?: TimelineSlotProps['marker'];
  component?: TimelineSlots['marker'];
}

export function TimelineMarker({ event, part, component }: TimelineMarkerProps) {
  const Marker = component ?? 'span';
  const tone = event.tone ?? 'neutral';
  let kind: 'avatar' | 'icon' | 'dot' = 'dot';
  if (event.actor) kind = 'avatar';
  if (isRenderable(event.icon) && event.icon !== '') kind = 'icon';
  if (event.avatar) kind = 'avatar';
  const content = {
    avatar: <Avatar name={event.actor ?? ''} src={event.avatar} sx={avatarStyle} />,
    icon: <span css={iconWrapperStyle}>{event.icon}</span>,
    dot: <span css={dotStyle} />,
  }[kind];

  return (
    <Marker
      {...withoutSx(part)}
      aria-hidden="true"
      data-ui="timeline-marker"
      data-kind={kind}
      data-tone={tone}
      className={part?.className}
      css={[markerStyle, toneStyles[tone], part?.sx]}
    >
      {content}
    </Marker>
  );
}
