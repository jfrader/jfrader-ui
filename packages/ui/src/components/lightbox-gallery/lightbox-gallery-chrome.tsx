'use client';

import { useEffect, useState, type ReactNode, type Ref } from 'react';
import { useMergeRefs, type Placement } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { IsolatedOverlay } from '../../overlay/overlay-layer';
import { useOverlayFloating } from '../../overlay/use-overlay-floating';
import { css } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { Button } from '../button';
import { tooltipContentStyle, useTooltipInteractions } from '../tooltip/tooltip';
import type { LightboxGalleryImage, LightboxGalleryLabels, LightboxGallerySlotProps } from './lightbox-gallery';

const headerStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: vars.space[3],
});
const titleStyle = css({
  margin: 0,
  fontSize: vars.textSize.md,
  fontWeight: vars.fontWeight.semibold,
  overflowWrap: 'anywhere',
});
const toolbarStyle = css({
  display: 'grid',
  gridTemplateColumns: '1fr auto 1fr',
  alignItems: 'center',
  gap: vars.space[2],
});
const counterStyle = css({
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
  fontVariantNumeric: 'tabular-nums',
  overflowWrap: 'anywhere',
});
const controlsStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: vars.space[1],
});
const dividerStyle = css({
  alignSelf: 'stretch',
  marginBlock: vars.space[2],
  marginInline: vars.space[1],
  borderInlineStart: `1px solid ${vars.color.border}`,
});
const readoutStyle = css({
  minInlineSize: vars.space[10],
  fontSize: vars.textSize.xs,
  color: vars.color.textMuted,
  fontVariantNumeric: 'tabular-nums',
  textAlign: 'center',
});
const actionStyle = css({ flexShrink: 0, inlineSize: vars.space[8], paddingInline: 0 });
// Rendered inside the modal dialog, not portaled: a body portal sits behind the top layer.
const tooltipStyle = css({ zIndex: 1 });
const glyphStyle = css({ inlineSize: vars.space[4], blockSize: vars.space[4] });
const directionalGlyphStyle = css({ '&:dir(rtl)': { transform: 'scaleX(-1)' } });
const stripStyle = css({
  display: 'flex',
  justifyContent: 'safe center',
  gap: vars.space[2],
  overflowX: 'auto',
  padding: vars.space[1],
  minInlineSize: 0,
  scrollbarWidth: 'thin',
});
const thumbStyle = css({
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

function Glyph({ children, directional = false }: { children: ReactNode; directional?: boolean }) {
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

const icons = {
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
};

interface ChromeActionProps {
  ref?: Ref<HTMLButtonElement>;
  label: string;
  icon: ReactNode;
  disabled?: boolean;
  placement?: Placement;
  onClick: () => void;
}

// An icon-only Button named by `label`, which its tooltip repeats on hover and keyboard focus.
// The tooltip comes from Tooltip's interaction seam because the operative element is a Button.
function ChromeAction(props: ChromeActionProps) {
  return (
    <IsolatedOverlay>
      <ChromeActionButton {...props} />
    </IsolatedOverlay>
  );
}

function ChromeActionButton({ ref, label, icon, disabled = false, placement = 'top', onClick }: ChromeActionProps) {
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
  const { getReferenceProps, getFloatingProps } = useTooltipInteractions(context, { enabled: available });
  const { tabIndex: _tabIndex, ...floatingProps } = getFloatingProps();
  const merged = useMergeRefs([ref, refs.setReference]);
  return (
    <>
      <Button
        {...getReferenceProps({ onClick })}
        ref={merged}
        variant="ghost"
        size="sm"
        css={actionStyle}
        aria-label={label}
        disabled={disabled}
      >
        {icon}
      </Button>
      {available && open && (
        <div {...floatingProps} ref={refs.setFloating} css={[tooltipContentStyle, tooltipStyle]} style={floatingStyles}>
          {label}
        </div>
      )}
    </>
  );
}

// React renders `autoFocus` as a focus() call on mount; the closed native dialog needs the attribute.
const autofocus = (element: HTMLButtonElement | null) => {
  element?.setAttribute('autofocus', '');
};

export function ViewerHeader({
  title,
  titleId,
  labels,
  slot,
  onClose,
}: {
  title: string;
  titleId: string;
  labels: LightboxGalleryLabels;
  slot?: LightboxGallerySlotProps['title'];
  onClose: () => void;
}) {
  return (
    <div css={headerStyle}>
      <h2 {...slot} id={titleId} css={[titleStyle, slot?.css]}>
        {title}
      </h2>
      <ChromeAction ref={autofocus} label={labels.close} icon={icons.close} placement="bottom" onClick={onClose} />
    </div>
  );
}

export interface ViewerToolbarProps {
  position: string;
  zoomText: string;
  labels: LightboxGalleryLabels;
  slots?: Pick<LightboxGallerySlotProps, 'controls' | 'status'>;
  canPrevious: boolean;
  canNext: boolean;
  canZoomIn: boolean;
  zoomed: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

export function ViewerToolbar({
  position,
  zoomText,
  labels,
  slots,
  canPrevious,
  canNext,
  canZoomIn,
  zoomed,
  onPrevious,
  onNext,
  onZoomIn,
  onZoomOut,
  onReset,
}: ViewerToolbarProps) {
  return (
    <div css={toolbarStyle}>
      <div {...slots?.status} role="status" aria-live="polite" aria-atomic="true" css={[counterStyle, slots?.status?.css]}>
        {position}
      </div>
      <div {...slots?.controls} css={[controlsStyle, slots?.controls?.css]}>
        <ChromeAction label={labels.previous} icon={icons.previous} disabled={!canPrevious} onClick={onPrevious} />
        <ChromeAction label={labels.next} icon={icons.next} disabled={!canNext} onClick={onNext} />
        <span aria-hidden="true" css={dividerStyle} />
        <ChromeAction label={labels.zoomOut} icon={icons.zoomOut} disabled={!zoomed} onClick={onZoomOut} />
        <span css={readoutStyle}>{zoomText}</span>
        <ChromeAction label={labels.zoomIn} icon={icons.zoomIn} disabled={!canZoomIn} onClick={onZoomIn} />
        <ChromeAction label={labels.reset} icon={icons.reset} disabled={!zoomed} onClick={onReset} />
      </div>
    </div>
  );
}

export function Filmstrip({
  images,
  selected,
  labels,
  format,
  slot,
  onSelect,
  thumbnail,
}: {
  images: readonly LightboxGalleryImage[];
  selected: string | null | undefined;
  labels: LightboxGalleryLabels;
  format: Intl.NumberFormat;
  slot?: LightboxGallerySlotProps['thumbnails'];
  onSelect: (id: string) => void;
  thumbnail: (image: LightboxGalleryImage) => ReactNode;
}) {
  return (
    <div {...slot} role="group" aria-label={slot?.['aria-label'] ?? labels.thumbnails} css={[stripStyle, slot?.css]}>
      {images.map((item, index) => (
        <button
          key={item.id}
          type="button"
          aria-current={item.id === selected ? 'true' : undefined}
          aria-label={`${item.title || item.alt}, ${labels.position(format.format(index + 1), format.format(images.length))}`}
          css={thumbStyle}
          onClick={() => onSelect(item.id)}
        >
          {thumbnail(item)}
        </button>
      ))}
    </div>
  );
}
