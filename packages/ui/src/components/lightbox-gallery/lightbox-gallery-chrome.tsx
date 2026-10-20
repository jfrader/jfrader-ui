import { withoutSx } from '../../styling/sx';
'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { ChromeAction, chromeIcons as icons, filmstripStyle, thumbStyle } from '../viewer-chrome/viewer-chrome';
import type { LightboxGalleryImage, LightboxGalleryLabels, LightboxGallerySlotProps, LightboxGallerySlots } from './lightbox-gallery';

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
  minInlineSize: 0,
  maxBlockSize: '20dvh',
  overflow: 'auto',
  '&:focus-visible': focusRingOutset,
});
const toolbarStyle = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, auto) minmax(0, 1fr)',
  alignItems: 'center',
  gap: vars.space[2],
  '@media (max-width: 40rem)': {
    gridTemplateColumns: 'minmax(0, 1fr)',
    justifyItems: 'center',
  },
});
const counterStyle = css({
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
  fontVariantNumeric: 'tabular-nums',
  overflowWrap: 'anywhere',
});
const controlsStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  minInlineSize: 0,
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

// React renders `autoFocus` as a focus() call on mount; the closed native dialog needs the attribute.
const autofocus = (element: HTMLButtonElement | null) => {
  element?.setAttribute('autofocus', '');
};

export function ViewerHeader({
  title,
  titleId,
  labels,
  slot,
  component,
  onClose,
}: {
  title: string;
  titleId: string;
  labels: LightboxGalleryLabels;
  slot?: LightboxGallerySlotProps['title'];
  component?: LightboxGallerySlots['title'];
  onClose: () => void;
}) {
  const Title = component ?? 'h2';
  return (
    <div css={headerStyle}>
      <Title {...withoutSx(slot)} id={titleId} tabIndex={slot?.tabIndex ?? 0} css={[titleStyle, slot?.sx]}>
        {title}
      </Title>
      <ChromeAction ref={autofocus} label={labels.close} icon={icons.close} placement="bottom" onClick={onClose} />
    </div>
  );
}

export interface ViewerToolbarProps {
  position: string;
  zoomText: string;
  labels: LightboxGalleryLabels;
  slotProps?: Pick<LightboxGallerySlotProps, 'controls' | 'status'>;
  slots?: Pick<LightboxGallerySlots, 'controls' | 'status'>;
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
  slotProps,
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
  const Status = slots?.status ?? 'div';
  const Controls = slots?.controls ?? 'div';
  return (
    <div css={toolbarStyle}>
      <Status {...withoutSx(slotProps?.status)} role="status" aria-live="polite" aria-atomic="true" css={[counterStyle, slotProps?.status?.sx]}>
        {position}
      </Status>
      <Controls {...withoutSx(slotProps?.controls)} css={[controlsStyle, slotProps?.controls?.sx]}>
        <ChromeAction label={labels.previous} icon={icons.previous} disabled={!canPrevious} onClick={onPrevious} />
        <ChromeAction label={labels.next} icon={icons.next} disabled={!canNext} onClick={onNext} />
        <span aria-hidden="true" css={dividerStyle} />
        <ChromeAction label={labels.zoomOut} icon={icons.zoomOut} disabled={!zoomed} onClick={onZoomOut} />
        <span css={readoutStyle}>{zoomText}</span>
        <ChromeAction label={labels.zoomIn} icon={icons.zoomIn} disabled={!canZoomIn} onClick={onZoomIn} />
        <ChromeAction label={labels.reset} icon={icons.reset} disabled={!zoomed} onClick={onReset} />
      </Controls>
    </div>
  );
}

export function Filmstrip({
  images,
  selected,
  labels,
  format,
  slot,
  component,
  onSelect,
  thumbnail,
}: {
  images: readonly LightboxGalleryImage[];
  selected: string | null | undefined;
  labels: LightboxGalleryLabels;
  format: Intl.NumberFormat;
  slot?: LightboxGallerySlotProps['thumbnails'];
  component?: LightboxGallerySlots['thumbnails'];
  onSelect: (id: string) => void;
  thumbnail: (image: LightboxGalleryImage) => ReactNode;
}) {
  const Thumbnails = component ?? 'div';
  const stripRef = useRef<HTMLDivElement | null>(null);
  const ref = useMergeRefs([stripRef, slot?.ref]);
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const reveal = () => {
      const current = strip.querySelector('[aria-current="true"]');
      if (!current) return;
      const frame = strip.getBoundingClientRect();
      const item = current.getBoundingClientRect();
      if (item.left < frame.left || item.right > frame.right) {
        strip.scrollBy({ left: item.left - frame.left - (strip.clientWidth - item.width) / 2, behavior: 'instant' });
      }
    };
    reveal();
    const observer = new ResizeObserver(reveal);
    observer.observe(strip);
    return () => observer.disconnect();
  }, [selected]);
  return (
    <Thumbnails {...withoutSx(slot)} ref={ref} role="group" aria-label={slot?.['aria-label'] ?? labels.thumbnails} css={[filmstripStyle, slot?.sx]}>
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
    </Thumbnails>
  );
}
