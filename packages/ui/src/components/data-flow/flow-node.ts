// Node card shared by DataFlow and PaymentFlow: raised material, a header row for the icon and
// label, and muted detail text. The host may set the inset and detail font variables.
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { FORCED_COLORS } from '../../styling/media';

export const FLOW_NODE_INSET = '--flow-node-inset';
export const FLOW_NODE_DETAIL_FONT = '--flow-node-detail-font';
export const FLOW_NODE_BORDER = '1px';

export const flowNodeStyle = css({
  position: 'relative',
  display: 'grid',
  gap: vars.space[1],
  alignContent: 'start',
  padding: `var(${FLOW_NODE_INSET}, ${vars.space[3]})`,
  border: `${FLOW_NODE_BORDER} solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.surfaceRaised,
  color: vars.color.text,
  [FORCED_COLORS]: { borderColor: 'CanvasText' },
});

export const flowNodeHeaderStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: vars.space[2],
});

export const flowNodeIconStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
});

export const flowNodeDetailStyle = css({
  color: vars.color.textMuted,
  fontSize: `var(${FLOW_NODE_DETAIL_FONT}, ${vars.textSize.xs})`,
});
