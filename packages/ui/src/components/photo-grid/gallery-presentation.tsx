'use client';

import { useId, useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { useReducedMotion } from 'motion/react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { isRenderable } from '../../utils/renderable';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { ChromeAction, chromeIcons, filmstripStyle, thumbStyle } from '../viewer-chrome/viewer-chrome';
import type {
  PhotoGridColor,
  PhotoGridLabels,
  PhotoGridOption,
  PhotoGridPhoto,
  PhotoGridSlotProps,
  PhotoGridSlots,
} from './photo-grid';
import { PhotoImage } from './photo-image';

export function isPhotoGridOptionSoldOut(option: PhotoGridOption, color: string | undefined) {
  return typeof option.soldOut === 'boolean'
    ? option.soldOut
    : color !== undefined && !!option.soldOut?.includes(color);
}

const SWIPE_DISTANCE = 40;
const WHEEL_DISTANCE = 60;
const WHEEL_IDLE_MS = 180;
const COVER_SPACING = 68;
const COVER_ROTATION = 48;
const COVER_SCALE = 0.78;
const MAX_VISIBLE_DISTANCE = 2;
const INSPECTION_SCALE = 2.4;
export const PRODUCT_ASPECT_RATIO = 4 / 5;
const layoutStyle = css({
  display: 'grid', gap: vars.space[6], minInlineSize: 0, containerType: 'inline-size',
});
const productStyle = css({
  display: 'grid', gap: vars.space[6], minInlineSize: 0,
  '@container (min-width: 42.5rem)': { gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)' },
});
const mediaStyle = css({ display: 'grid', gap: vars.space[3], minInlineSize: 0 });
const stageStyle = css({
  position: 'relative', display: 'grid', placeItems: 'center', minInlineSize: 0,
  touchAction: 'pan-y', borderRadius: vars.radius.lg,
  '&:focus-visible': focusRingOutset,
});
const mainStyle = css({
  appearance: 'none', display: 'grid', placeItems: 'center', boxSizing: 'border-box',
  inlineSize: '100%', aspectRatio: 'var(--gallery-ratio)', overflow: 'hidden', padding: 0,
  border: `1px solid ${vars.color.borderControl}`, borderRadius: vars.radius.lg,
  background: vars.color.surfaceInset, color: vars.color.text, font: 'inherit', cursor: 'zoom-in',
  '& img': { objectFit: 'contain' }, '&:focus-visible': focusRingOutset,
  '@media (hover: hover) and (pointer: fine)': {
    '&[data-magnifier="true"]:hover img': { transform: `scale(${INSPECTION_SCALE})` },
  },
  [REDUCED_MOTION]: { '&[data-magnifier="true"]:hover img': { transform: 'none' } },
});
const imageWrapStyle = css({ display: 'grid', inlineSize: '100%', blockSize: '100%', minBlockSize: 0, '&[hidden]': { display: 'none' } });
const railStyle = css({
  blockSize: 'clamp(14rem, 48cqw, 24rem)', perspective: '60rem', overflow: 'clip',
  paddingBlock: vars.space[4],
  [FORCED_COLORS]: { perspective: 'none' },
});
const coverStyle = css({
  font: 'inherit',
  color: vars.color.text,
  '--gallery-direction': 1,
  '&:dir(rtl)': { '--gallery-direction': -1 },
  transform: 'translateX(calc(var(--gallery-offset) * var(--gallery-direction))) rotateY(calc(var(--gallery-rotation) * var(--gallery-direction))) scale(var(--gallery-scale))',
  opacity: 'var(--gallery-opacity)',
  transitionProperty: 'transform, opacity', transitionDuration: vars.motion.duration.slow, transitionTimingFunction: vars.motion.easeStandard,
  '&[data-flat="true"]': { transform: 'none', opacity: 1, transitionDuration: '0s' },
  position: 'absolute', inlineSize: 'clamp(10.5rem, 38cqw, 17rem)', maxInlineSize: '72%',
  aspectRatio: '1', display: 'grid', placeItems: 'center',
  border: `1px solid ${vars.color.borderControl}`, borderRadius: vars.radius.lg,
  background: vars.color.surfaceRaised, boxShadow: vars.shadow.raised,
  '&[data-current="true"]': { outline: `2px solid ${vars.color.borderControl}`, outlineOffset: vars.space[1] },
  [REDUCED_MOTION]: { '&:not([data-current="true"])': { visibility: 'hidden' }, transform: 'none', transitionDuration: '0s' },
  [FORCED_COLORS]: { '&:not([data-current="true"])': { visibility: 'hidden' }, boxShadow: 'none', transform: 'none' },
});
const selectedThumbStyle = css({ '&[aria-selected="true"]': { outline: `2px solid ${vars.color.borderControl}`, outlineOffset: vars.space[1] } });
const reflectionStyle = css({
  position: 'absolute', insetBlockStart: '100%', inlineSize: '100%', blockSize: '35%',
  objectFit: 'cover', transform: 'scaleY(-1)', opacity: 0.18,
  maskImage: 'linear-gradient(transparent, black)', pointerEvents: 'none',
  [FORCED_COLORS]: { display: 'none' },
});
const navigationStyle = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: vars.space[2] });
const detailsStyle = css({ display: 'grid', alignContent: 'start', gap: vars.space[4], minInlineSize: 0 });
const choicesStyle = css({
  display: 'flex', flexWrap: 'wrap', gap: vars.space[2], margin: 0, padding: vars.space[3],
  border: `1px solid ${vars.color.borderControl}`, borderRadius: vars.radius.md,
});
const choiceStyle = css({
  display: 'flex', alignItems: 'center', gap: vars.space[2], minBlockSize: vars.space[8],
  '& input:focus-visible': focusRingOutset,
});
const radioStyle = css({
  font: 'inherit',
  color: vars.color.text,
  accentColor: vars.color.accent,
  backgroundColor: vars.color.surfaceRaised,
  borderColor: vars.color.borderControl,
});
const captionStyle = css({ fontSize: vars.textSize.md, overflowWrap: 'anywhere', textAlign: 'center' });
const clearStyle = css({
  minBlockSize: vars.space[8], paddingInline: vars.space[3], border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.sm, background: vars.color.surfaceRaised, color: vars.color.text, font: 'inherit',
  '&:focus-visible': focusRingOutset,
});

interface Props {
  photos: readonly PhotoGridPhoto[];
  selected: string | null | undefined;
  select: (id: string | null) => void;
  variant: 'product' | 'cover-flow';
  depth: boolean;
  reflection: boolean;
  magnifier: boolean;
  aspectRatio: number;
  labels: PhotoGridLabels;
  format: Intl.NumberFormat;
  slots?: PhotoGridSlots;
  slotProps?: PhotoGridSlotProps;
  colors: readonly PhotoGridColor[];
  options: readonly PhotoGridOption[];
  color: string | undefined;
  option: string | null | undefined;
  onColorChange: (value: string) => void;
  onOptionChange: (value: string | null) => void;
  onOpen: () => void;
  header?: ReactNode;
  footer?: ReactNode;
  renderCaption?: (photo: PhotoGridPhoto, index: number) => ReactNode;
}

export function GalleryPresentation({
  photos,
  selected,
  select,
  variant,
  depth,
  reflection,
  magnifier,
  aspectRatio,
  labels,
  format,
  slots,
  slotProps,
  colors,
  options,
  color,
  option,
  onColorChange,
  onOptionChange,
  onOpen,
  header,
  footer,
  renderCaption,
}: Props) {
  const id = useId();
  const reduced = useReducedMotion();
  const swiped = useRef(false);
  const pointer = useRef<{ id: number; x: number; y: number } | null>(null);
  const wheel = useRef({ delta: 0, time: 0 });
  const index = photos.findIndex((photo) => photo.id === selected);
  const photo = photos[index];
  const product = variant === 'product';
  const caption = photo && (renderCaption ? renderCaption(photo, index) : photo.detail ?? photo.title);
  const Stage = slots?.presentationStage ?? 'div';
  const Main = slots?.main ?? 'button';
  const Thumbnails = slots?.thumbnails ?? 'div';
  const Details = slots?.details ?? 'div';
  const Colors = slots?.colors ?? 'fieldset';
  const Options = slots?.options ?? 'fieldset';
  const Caption = slots?.caption ?? 'div';
  const Position = slots?.position ?? 'button';
  const Navigation = slots?.navigation ?? 'div';
  const position = (item: PhotoGridPhoto, itemIndex: number) =>
    labels.position(format.format(itemIndex + 1), format.format(photos.length), item.title);
  const navigate = (next: number) => {
    if (!photo) return;
    const candidate = photos[Math.max(0, Math.min(photos.length - 1, next))];
    if (candidate) select(candidate.id);
  };
  const handleKey = (event: KeyboardEvent<HTMLElement>, focusTab = false) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const rtl = event.currentTarget.matches(':dir(rtl)') ? -1 : 1;
    const targets: Record<string, number> = {
      ArrowLeft: index - rtl,
      ArrowRight: index + rtl,
      Home: 0,
      End: photos.length - 1,
    };
    const next = targets[event.key];
    if (next === undefined || !photo) return;
    event.preventDefault();
    const bounded = Math.max(0, Math.min(photos.length - 1, next));
    navigate(bounded);
    if (focusTab) {
      event.currentTarget.parentElement
        ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[bounded]?.focus();
    }
  };

  return (
    <div css={layoutStyle}>
      {!product && <span id={`${id}-keys`} css={visuallyHiddenStyle}>{labels.navigationHint}</span>}
      <div css={product ? productStyle : undefined}>
        <div css={mediaStyle}>
          <Stage
            {...slotProps?.presentationStage}
            data-ui="photo-grid-presentation-stage"
            role="group"
            aria-label={slotProps?.presentationStage?.['aria-label'] ?? labels.filmstrip}
            aria-describedby={[slotProps?.presentationStage?.['aria-describedby'], !product && `${id}-keys`].filter(Boolean).join(' ') || undefined}
            tabIndex={0}
            css={[stageStyle, !product && railStyle, slotProps?.presentationStage?.css]}
            onKeyDown={(event) => { slotProps?.presentationStage?.onKeyDown?.(event); if (event.target === event.currentTarget) handleKey(event); }}
            onPointerDown={(event) => {
              slotProps?.presentationStage?.onPointerDown?.(event);
              if (event.defaultPrevented || event.button !== 0 || !photo) return;
              swiped.current = false;
              pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
            }}
            onPointerUp={(event) => {
              slotProps?.presentationStage?.onPointerUp?.(event);
              const start = pointer.current;
              pointer.current = null;
              if (event.defaultPrevented || !start || start.id !== event.pointerId) return;
              const dx = event.clientX - start.x;
              const dy = event.clientY - start.y;
              if (Math.abs(dy) >= SWIPE_DISTANCE && Math.abs(dy) >= Math.abs(dx)) return;
              if (!product && Math.abs(dx) < SWIPE_DISTANCE) {
                const current = event.currentTarget.querySelector<HTMLElement>('[data-current="true"]')?.getBoundingClientRect();
                if (current && event.clientX < current.left) navigate(index + (event.currentTarget.matches(':dir(rtl)') ? 1 : -1));
                else if (current && event.clientX > current.right) navigate(index + (event.currentTarget.matches(':dir(rtl)') ? -1 : 1));
                return;
              }
              if (Math.abs(dx) < SWIPE_DISTANCE || Math.abs(dx) <= Math.abs(dy)) return;
              const rtl = event.currentTarget.matches(':dir(rtl)') ? -1 : 1;
              swiped.current = true;
              navigate(index + (dx < 0 ? 1 : -1) * rtl);
            }}
            onPointerCancel={(event) => { slotProps?.presentationStage?.onPointerCancel?.(event); pointer.current = null; }}
            onWheel={(event) => {
              slotProps?.presentationStage?.onWheel?.(event);
              if (event.defaultPrevented || event.ctrlKey || !photo || product || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
              const now = event.timeStamp;
              if (now - wheel.current.time > WHEEL_IDLE_MS) wheel.current.delta = 0;
              wheel.current.time = now;
              wheel.current.delta += event.deltaX;
              if (Math.abs(wheel.current.delta) < WHEEL_DISTANCE) return;
              const rtl = event.currentTarget.matches(':dir(rtl)') ? -1 : 1;
              navigate(index + Math.sign(wheel.current.delta) * rtl);
              wheel.current.delta = 0;
            }}
          >
            {product ? photos.map((item, itemIndex) => (
              <div key={item.id} role="tabpanel" id={`${id}-panel-${itemIndex}`} aria-labelledby={`${id}-tab-${itemIndex}`} hidden={item.id !== selected} css={imageWrapStyle}>
                <Main
                  {...slotProps?.main} type="button" data-ui="photo-grid-main"
                  aria-label={`${labels.inspect}: ${labels.position(format.format(itemIndex + 1), format.format(photos.length), labels.openPhoto(item.title, item.alt, false))}`}
                  data-magnifier={magnifier}
                  css={[mainStyle, slotProps?.main?.css]}
                  style={{ ...slotProps?.main?.style, '--gallery-ratio': Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : PRODUCT_ASPECT_RATIO } as CSSProperties}
                  onClick={(event) => { slotProps?.main?.onClick?.(event); if (!event.defaultPrevented && !swiped.current) onOpen(); swiped.current = false; }}
                  onPointerMove={(event) => {
                    slotProps?.main?.onPointerMove?.(event);
                    if (event.defaultPrevented || !magnifier || reduced || event.pointerType === 'touch') return;
                    const box = event.currentTarget.getBoundingClientRect();
                    const image = event.currentTarget.querySelector('img');
                    if (image) image.style.transformOrigin = `${(event.clientX - box.left) / box.width * 100}% ${(event.clientY - box.top) / box.height * 100}%`;
                  }}
                >
                  <PhotoImage key={`${item.src}\u0000${item.srcSet ?? ''}`} photo={item} meaningful unavailable={labels.imageUnavailable} />
                </Main>
              </div>
            )) : photos.map((item, itemIndex) => {
              const distance = itemIndex - index;
              const flat = reduced || !depth;
              const hidden = !photo || Math.abs(distance) > MAX_VISIBLE_DISTANCE || (flat && distance !== 0);
              return (
                <div key={item.id} data-current={distance === 0} data-flat={flat} aria-hidden={distance !== 0 || undefined} inert={distance !== 0} role="group" aria-roledescription={labels.slide} aria-label={position(item, itemIndex)}
                  css={coverStyle} style={{ visibility: hidden ? 'hidden' : undefined, zIndex: photos.length - Math.abs(distance), '--gallery-offset': `${distance * COVER_SPACING}%`, '--gallery-rotation': `${-Math.sign(distance) * COVER_ROTATION}deg`, '--gallery-scale': distance === 0 ? 1 : COVER_SCALE, '--gallery-opacity': distance === 0 ? 1 : 0.65 } as CSSProperties}
                >
                  <PhotoImage key={`${item.src}\u0000${item.srcSet ?? ''}`} photo={item} meaningful unavailable={labels.imageUnavailable} />
                  {reflection && <img src={item.src} alt="" aria-hidden="true" draggable={false} css={reflectionStyle} />}
                </div>
              );
            })}
            {!photo && <span>{photos.length || (product && colors.length > 0 && !colors.some((item) => item.value === color)) ? labels.unavailable : labels.empty}</span>}
          </Stage>
          <Navigation {...slotProps?.navigation} css={[navigationStyle, slotProps?.navigation?.css]}>
            <ChromeAction portaled label={labels.previous} icon={chromeIcons.previous} disabled={!photo || index <= 0} onClick={() => navigate(index - 1)} />
            {product && <ChromeAction portaled label={labels.inspect} icon={chromeIcons.zoomIn} disabled={!photo} onClick={onOpen} />}
            <ChromeAction portaled label={labels.next} icon={chromeIcons.next} disabled={!photo || index >= photos.length - 1} onClick={() => navigate(index + 1)} />
          </Navigation>
          {photos.length > 0 && <Thumbnails {...slotProps?.thumbnails} role={product ? 'tablist' : 'group'} aria-label={slotProps?.thumbnails?.['aria-label'] ?? labels.filmstrip} css={[filmstripStyle, slotProps?.thumbnails?.css]}>
            {photos.map((item, itemIndex) => <Position
              {...slotProps?.position} key={item.id} type="button"
              role={product ? 'tab' : undefined} id={`${id}-tab-${itemIndex}`}
              aria-controls={product ? `${id}-panel-${itemIndex}` : undefined}
              aria-selected={product ? item.id === selected : undefined}
              aria-current={!product && item.id === selected ? 'true' : undefined}
              tabIndex={product ? item.id === selected || (!photo && itemIndex === 0) ? 0 : -1 : undefined}
              aria-label={position(item, itemIndex)} css={[thumbStyle, selectedThumbStyle, slotProps?.position?.css]}
              onKeyDown={(event) => { slotProps?.position?.onKeyDown?.(event); if (product) handleKey(event, true); }}
              onClick={(event) => { slotProps?.position?.onClick?.(event); if (!event.defaultPrevented) select(item.id); }}
            ><PhotoImage key={`${item.src}\u0000${item.srcSet ?? ''}`} photo={item} unavailable={labels.imageUnavailable} /></Position>)}
          </Thumbnails>}
          {isRenderable(caption) && <Caption {...slotProps?.caption} css={[captionStyle, slotProps?.caption?.css]}>{caption}</Caption>}
        </div>
        {product && <Details {...slotProps?.details} css={[detailsStyle, slotProps?.details?.css]}>
          {isRenderable(header) && header}
          {colors.length > 0 && <Colors {...slotProps?.colors} css={[choicesStyle, slotProps?.colors?.css]}>
            <legend>{labels.colors}</legend>
            {colors.map((item) => <label key={item.value} css={choiceStyle}>
              <input css={radioStyle} type="radio" name={`${id}-color`} value={item.value} checked={color === item.value} disabled={item.soldOut} onChange={() => onColorChange(item.value)} />
              {item.label}{item.soldOut && ` — ${labels.soldOut}`}
            </label>)}
          </Colors>}
          {options.length > 0 && <Options {...slotProps?.options} css={[choicesStyle, slotProps?.options?.css]}>
            <legend>{labels.options}</legend>
            {options.map((item) => {
              const unavailable = isPhotoGridOptionSoldOut(item, color);
              return <label key={item.value} css={choiceStyle}>
                <input css={radioStyle} type="radio" name={`${id}-option`} value={item.value} checked={option === item.value} disabled={unavailable} onChange={() => onOptionChange(item.value)} />
                {item.label}{unavailable && ` — ${labels.soldOut}`}
              </label>;
            })}
            <button type="button" css={clearStyle} disabled={option == null} onClick={() => onOptionChange(null)}>{labels.clearOption}</button>
          </Options>}
          {isRenderable(footer) && footer}
        </Details>}
      </div>
    </div>
  );
}
