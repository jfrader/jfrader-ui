'use client';

import type { ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
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
      <Title {...slot} id={titleId} css={[titleStyle, slot?.css]}>
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
      <Status {...slotProps?.status} role="status" aria-live="polite" aria-atomic="true" css={[counterStyle, slotProps?.status?.css]}>
        {position}
      </Status>
      <Controls {...slotProps?.controls} css={[controlsStyle, slotProps?.controls?.css]}>
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
  return (
    <Thumbnails {...slot} role="group" aria-label={slot?.['aria-label'] ?? labels.thumbnails} css={[filmstripStyle, slot?.css]}>
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
