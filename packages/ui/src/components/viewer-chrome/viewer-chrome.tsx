'use client';

import { useEffect, useState, type ComponentPropsWithRef, type ReactNode } from 'react';
import { useMergeRefs, type Placement } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { IsolatedOverlay } from '../../overlay/overlay-layer';
import { OverlayPortal } from '../../overlay/overlay-portal';
import { useOverlayFloating } from '../../overlay/use-overlay-floating';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { Button } from '../button';
import { tooltipContentStyle, useTooltipInteractions } from '../tooltip/tooltip';

// Icon chrome shared by the media viewers (LightboxGallery, PhotoGrid): ghost icon buttons with
// tooltips, their glyphs, and the thumbnail strip styles.

const actionStyle = css({
  flexShrink: 0,
  inlineSize: vars.space[8],
  paddingInline: 0,
  '&[aria-pressed="true"]': {
    backgroundColor: vars.color.surfaceRaised,
    borderColor: vars.color.borderControl,
    color: vars.color.text,
  },
  [FORCED_COLORS]: { '&[aria-pressed="true"]': { borderColor: 'Highlight' } },
});
// Unportaled tooltips sit above the chrome; inside a modal dialog a body portal sits behind the top layer.
const tooltipStyle = css({ zIndex: 1 });
const glyphStyle = css({ inlineSize: vars.space[4], blockSize: vars.space[4] });
const directionalGlyphStyle = css({ '&:dir(rtl)': { transform: 'scaleX(-1)' } });

export const filmstripStyle = css({
  display: 'flex',
  justifyContent: 'safe center',
  gap: vars.space[2],
  overflowX: 'auto',
  padding: vars.space[1],
  minInlineSize: 0,
  scrollbarWidth: 'thin',
});
export const thumbStyle = css({
  font: 'inherit',
  color: vars.color.text,
  position: 'relative',
  flexShrink: 0,
  overflow: 'hidden',
  ...focusRingOutset,
  outline: 'none',
  inlineSize: vars.space[10],
  blockSize: vars.space[10],
  padding: 0,
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.sm,
  background: 'transparent',
  cursor: 'pointer',
  '&::after': {
    content: '""',
    position: 'absolute',
    inset: 0,
    background: vars.color.scrim,
    pointerEvents: 'none',
    transitionProperty: 'opacity',
    transitionDuration: vars.motion.duration.fast,
    transitionTimingFunction: vars.motion.easeStandard,
  },
  '&[aria-current="true"]::after, &:hover::after, &:focus-visible::after': { opacity: 0 },
  '&:focus-visible': focusRingOutset,
  '&[aria-current="true"]': { outline: `2px solid ${vars.color.accentText}`, outlineOffset: '2px' },
  [REDUCED_MOTION]: { '&::after': { transitionDuration: '0s' } },
  [FORCED_COLORS]: { '&::after': { display: 'none' }, '&[aria-current="true"]': { outlineColor: 'Highlight' } },
});

const strokeProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

/** A decorative 16-unit stroke glyph; `directional` mirrors it in RTL. */
export function Glyph({ children, directional = false }: { children: ReactNode; directional?: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
      css={[glyphStyle, directional && directionalGlyphStyle]}
      {...strokeProps}
    >
      {children}
    </svg>
  );
}

const STAR_PATH = 'M8 2.2 9.8 5.9l4 .6-2.9 2.8.7 4L8 11.4l-3.6 1.9.7-4-2.9-2.8 4-.6Z';

export function StarGlyph({ filled }: { filled: boolean }) {
  return (
    <Glyph>
      <path d={STAR_PATH} fill={filled ? 'currentColor' : 'none'} />
    </Glyph>
  );
}

export const chromeIcons = {
  previous: (
    <Glyph directional>
      <path d="M10 3 5 8l5 5" />
    </Glyph>
  ),
  next: (
    <Glyph directional>
      <path d="m6 3 5 5-5 5" />
    </Glyph>
  ),
  zoomIn: (
    <Glyph>
      <circle cx="7" cy="7" r="4.5" />
      <path d="m10.5 10.5 3 3M5 7h4M7 5v4" />
    </Glyph>
  ),
  zoomOut: (
    <Glyph>
      <circle cx="7" cy="7" r="4.5" />
      <path d="m10.5 10.5 3 3M5 7h4" />
    </Glyph>
  ),
  reset: (
    <Glyph>
      <path d="M3 8a5 5 0 1 0 1.5-3.5L3 6M3 3v3h3" />
    </Glyph>
  ),
  close: (
    <Glyph>
      <path d="m4 4 8 8M12 4l-8 8" />
    </Glyph>
  ),
  panLeft: (
    <Glyph>
      <path d="M13 8H3m4-4L3 8l4 4" />
    </Glyph>
  ),
  panRight: (
    <Glyph>
      <path d="M3 8h10M9 4l4 4-4 4" />
    </Glyph>
  ),
  panUp: (
    <Glyph>
      <path d="M8 13V3M4 7l4-4 4 4" />
    </Glyph>
  ),
  panDown: (
    <Glyph>
      <path d="M8 3v10m-4-4 4 4 4-4" />
    </Glyph>
  ),
};

export interface ChromeActionProps
  extends Omit<ComponentPropsWithRef<'button'>, 'children' | 'type' | 'aria-label' | 'aria-pressed'> {
  label: string;
  icon: ReactNode;
  /** Renders `aria-pressed` for toggles; leave undefined for plain actions. */
  pressed?: boolean;
  placement?: Placement;
  /** Portal the tooltip. Leave off inside a modal dialog, where a body portal sits behind the top layer. */
  portaled?: boolean;
  /** Styles applied after the chrome's own (a `css` prop would reach the Button as a className, before them). */
  styles?: Interpolation<Theme>;
}

// An icon-only Button named by `label`, which its tooltip repeats on hover and keyboard focus.
// The tooltip comes from Tooltip's interaction seam because the operative element is a Button.
export function ChromeAction(props: ChromeActionProps) {
  return (
    <IsolatedOverlay>
      <ChromeActionButton {...props} />
    </IsolatedOverlay>
  );
}

function ChromeActionButton({
  ref,
  label,
  icon,
  pressed,
  disabled = false,
  placement = 'top',
  portaled = false,
  onClick,
  styles,
  ...rest
}: ChromeActionProps) {
  const [open, setOpen] = useState(false);
  const available = !disabled;
  const { refs, floatingStyles, context } = useOverlayFloating({
    open: available && open,
    placement,
    onOpenChange: setOpen,
  });
  useEffect(() => {
    if (!available) setOpen(false);
  }, [available]);
  const { getReferenceProps, getFloatingProps } = useTooltipInteractions(context, { enabled: available, focusVisibleOnly: true });
  const { tabIndex: _tabIndex, ...floatingProps } = getFloatingProps();
  const merged = useMergeRefs([ref, refs.setReference]);
  const tooltip = available && open && (
    <div {...floatingProps} ref={refs.setFloating} css={[tooltipContentStyle, tooltipStyle]} style={floatingStyles}>
      {label}
    </div>
  );
  return (
    <>
      <Button
        {...getReferenceProps({ ...rest, onClick })}
        ref={merged}
        variant="ghost"
        size="sm"
        css={[actionStyle, styles]}
        aria-label={label}
        aria-pressed={pressed}
        disabled={disabled}
      >
        {icon}
      </Button>
      {tooltip && (portaled ? <OverlayPortal>{tooltip}</OverlayPortal> : tooltip)}
    </>
  );
}
