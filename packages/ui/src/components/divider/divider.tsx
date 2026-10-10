// Static separator, not interactive and never focusable.
// Horizontal without a label renders a native <hr>, whose implicit role is separator.
// Vertical renders a div with role="separator" aria-orientation="vertical". It has no intrinsic
// size on the block axis: it stretches to the cross size of its flex/grid parent row
// (align-self: stretch), so the parent row must give it a height through its content.
// A label (horizontal only) renders a div with role="separator" and a visible centred label.
// The separator role makes its children presentational, so the label is also wired as the
// separator's accessible name through aria-labelledby (merged with any consumer ids).
import { forwardRef, useId, type HTMLAttributes, type ReactNode, type Ref } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { isRenderable } from '../../utils/renderable';

export type DividerOrientation = 'horizontal' | 'vertical';

type DividerBaseProps = Omit<HTMLAttributes<HTMLElement>, 'children' | 'role' | 'aria-orientation'>;

export interface DividerHorizontalProps extends DividerBaseProps {
  orientation?: 'horizontal';
  label?: ReactNode;
}

export interface DividerVerticalProps extends DividerBaseProps {
  orientation: 'vertical';
  label?: never;
}

export type DividerProps = DividerHorizontalProps | DividerVerticalProps;

const FORCED_COLORS = '@media (forced-colors: active)';
const LINE_THICKNESS = '1px';

// Lines are painted as backgrounds, which forced-colors mode would erase; repaint them in CanvasText.
const lineFill = {
  backgroundColor: vars.color.border,
  [FORCED_COLORS]: {
    forcedColorAdjust: 'none',
    backgroundColor: 'CanvasText',
  },
} as const;

const horizontalStyle = css({
  ...lineFill,
  boxSizing: 'border-box',
  alignSelf: 'stretch',
  blockSize: LINE_THICKNESS,
  margin: 0,
  border: 0,
});

const verticalStyle = css({
  ...lineFill,
  boxSizing: 'border-box',
  alignSelf: 'stretch',
  flexShrink: 0,
  inlineSize: LINE_THICKNESS,
});

const labelledStyle = css({
  display: 'flex',
  alignItems: 'center',
  alignSelf: 'stretch',
  gap: vars.space[3],
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  lineHeight: vars.lineHeight.tight,
  color: vars.color.textMuted,
  '&::before, &::after': {
    ...lineFill,
    content: '""',
    flex: 1,
    blockSize: LINE_THICKNESS,
  },
});

export const Divider = forwardRef<HTMLElement, DividerProps>(function Divider(
  { orientation = 'horizontal', label, 'aria-labelledby': ariaLabelledBy, ...rest },
  ref,
) {
  const labelId = useId();

  if (orientation === 'vertical') {
    return (
      <div
        {...rest}
        ref={ref as Ref<HTMLDivElement>}
        role="separator"
        aria-orientation="vertical"
        aria-labelledby={ariaLabelledBy}
        data-ui="divider"
        data-orientation="vertical"
        css={verticalStyle}
      />
    );
  }

  if (isRenderable(label)) {
    return (
      <div
        {...rest}
        ref={ref as Ref<HTMLDivElement>}
        role="separator"
        aria-orientation="horizontal"
        aria-labelledby={[labelId, ariaLabelledBy].filter(Boolean).join(' ')}
        data-ui="divider"
        data-orientation="horizontal"
        css={labelledStyle}
      >
        <span id={labelId} data-ui="divider-label">
          {label}
        </span>
      </div>
    );
  }

  return (
    <hr
      {...rest}
      ref={ref as Ref<HTMLHRElement>}
      aria-labelledby={ariaLabelledBy}
      data-ui="divider"
      data-orientation="horizontal"
      css={horizontalStyle}
    />
  );
});
