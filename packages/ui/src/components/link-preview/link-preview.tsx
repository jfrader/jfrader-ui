'use client';

import { type ComponentPropsWithRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, keyframes, type Interpolation, type Theme } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { isRenderable } from '../../utils/renderable';
import { useImageStatus } from '../../utils/use-image-status';

export type LinkPreviewStatus = 'pending' | 'ready' | 'none' | 'error';

export interface LinkPreviewData {
  /** Sets the destination and the fallback title/domain. Use an absolute HTTP(S) URL. */
  url: string;
  site?: string;
  title?: string;
  description?: ReactNode;
  /** Describe the image with `alt`, or use `''` if it adds no information. */
  image?: { src: string; alt: string };
  /** Decorative site icon URL. */
  favicon?: string;
  /** Replaces the unavailable label in the error state. */
  error?: string;
}

interface SlotStyle {
  className?: string;
  css?: Interpolation<Theme>;
}

type PartProps<E extends 'div' | 'a' | 'img'> = Omit<
  ComponentPropsWithoutRef<E>,
  'children' | 'id' | 'className' | 'dangerouslySetInnerHTML'
> & SlotStyle;

export interface LinkPreviewLabels {
  pending: string;
  unavailable: string;
}

export interface LinkPreviewSlotProps {
  /** Anchor element displaying the page title link. */
  title?: Omit<PartProps<'a'>, 'href'>;
  /** Image element displaying the preview thumbnail. */
  image?: Omit<PartProps<'img'>, 'src' | 'alt'>;
  /** Container element holding preview description and publisher details. */
  body?: Omit<PartProps<'div'>, 'hidden' | 'inert'>;
}

export interface LinkPreviewProps extends Omit<ComponentPropsWithRef<'div'>, 'children'>, SxProps {
  /** Supplies the address and metadata. No request ids or editor context are needed. */
  data: LinkPreviewData;
  /** Shows metadata or a pending/unavailable state. Defaults to `'ready'`. */
  status?: LinkPreviewStatus;
  /** Replaces the loading and unavailable text. */
  labels?: Partial<LinkPreviewLabels>;
  /** Disables decorative transitions and the loading sweep. Defaults to `'auto'`. */
  motion?: 'auto' | 'none';
  /** Passes attributes and styles to the title link, image and body. */
  slotProps?: LinkPreviewSlotProps;
}

const DEFAULT_LABELS: LinkPreviewLabels = { pending: 'Loading preview', unavailable: 'No preview' };
const CARD_MAX_INLINE_SIZE = '27.5rem';
const IMAGE_ASPECT_RATIO = '1.91';
const NARROW = '@container (max-width: 22.5rem)';
const PENDING_SWEEP_DURATION = '1.4s';

function splitPart<P extends SlotStyle>(part: P | undefined) {
  const { className, css: partCss, ...attributes } = part ?? ({} as P);
  return { className, partCss, attributes };
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export const previewSurfaceStyle = css({
  boxSizing: 'border-box',
  inlineSize: '100%',
  maxInlineSize: CARD_MAX_INLINE_SIZE,
  minInlineSize: 0,
  overflow: 'clip',
  backgroundColor: vars.color.surfaceRaised,
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.lg,
  boxShadow: vars.shadow.raised,
  [FORCED_COLORS]: { border: '1px solid CanvasText' },
});

export const previewHeaderStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[2],
  paddingBlock: vars.space[2],
  paddingInline: vars.space[3],
  [NARROW]: { paddingInline: vars.space[2] },
});

const faviconStyle = css({
  flex: 'none',
  inlineSize: vars.space[4],
  blockSize: vars.space[4],
  borderRadius: vars.radius.sm,
  objectFit: 'cover',
});

const headingStyle = css({ display: 'grid', flex: '1 1 12rem', minInlineSize: 0 });
const titleFade = keyframes({ from: { opacity: 0 } });
const titleStyle = css({
  justifySelf: 'start',
  minBlockSize: vars.space[6],
  minInlineSize: vars.space[6],
  '&[data-resolved]': { animation: `${titleFade} ${vars.motion.duration.base} ${vars.motion.easeStandard}` },
  '[data-motion="none"] &': { animation: 'none' },
  [REDUCED_MOTION]: { '&[data-resolved]': { animation: 'none' } },
  color: vars.color.accentText,
  fontWeight: vars.fontWeight.medium,
  overflowWrap: 'anywhere',
  textDecoration: 'none',
  borderRadius: vars.radius.sm,
  '&:hover': { textDecoration: 'underline' },
  '&:focus-visible': focusRingOutset,
  [FORCED_COLORS]: { textDecoration: 'underline' },
});

const metaStyle = css({ color: vars.color.textMuted, overflowWrap: 'anywhere' });
const errorTextStyle = css({ color: vars.color.dangerText });
const sweep = keyframes({ from: { backgroundPosition: '100% 0' }, to: { backgroundPosition: '0 0' } });
const pendingStyle = css({
  color: vars.color.textMuted,
  backgroundImage: `linear-gradient(90deg, transparent 30%, ${vars.color.accentSoft} 50%, transparent 70%)`,
  backgroundSize: '300% 100%',
  borderRadius: vars.radius.sm,
  animation: `${sweep} ${PENDING_SWEEP_DURATION} linear infinite`,
  '[data-offscreen] &, [data-motion="none"] &': { animationPlayState: 'paused', animationName: 'none' },
  [REDUCED_MOTION]: { animation: 'none' },
  [FORCED_COLORS]: { backgroundImage: 'none' },
});

export const previewBodyStyle = css({
  display: 'grid',
  gap: vars.space[2],
  padding: vars.space[3],
  borderBlockStart: `1px solid ${vars.color.border}`,
  '&[hidden]': { display: 'none' },
  [NARROW]: { padding: vars.space[2] },
  [FORCED_COLORS]: { borderBlockStartColor: 'CanvasText' },
});

const imageFrameStyle = css({
  aspectRatio: IMAGE_ASPECT_RATIO,
  inlineSize: '100%',
  overflow: 'hidden',
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.surfaceHover,
});

const imageStyle = css({
  display: 'block',
  inlineSize: '100%',
  blockSize: '100%',
  objectFit: 'cover',
  transitionProperty: 'opacity',
  transitionDuration: vars.motion.duration.slow,
  transitionTimingFunction: vars.motion.easeStandard,
  '&[data-image-state="loading"]': { opacity: 0, transitionDuration: '0s' },
  '[data-motion="none"] &': { opacity: 1, transitionDuration: '0s' },
  [REDUCED_MOTION]: { transitionDuration: '0s' },
});

const descriptionStyle = css({ margin: 0, color: vars.color.textMuted, overflowWrap: 'anywhere' });
const titleClampStyle = css({
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 2,
  overflow: 'hidden',
});
const descriptionClampStyle = css({
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 3,
  overflow: 'hidden',
});
const typographyStyle = css({
  color: vars.color.text,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  lineHeight: vars.lineHeight.base,
});

interface PreviewHeadingProps {
  data: LinkPreviewData;
  status: LinkPreviewStatus | 'idle';
  labels: LinkPreviewLabels;
  titleId?: string;
  titleText?: string;
  ui?: string;
  truncate?: boolean;
  slotProps?: LinkPreviewSlotProps;
}

export function PreviewHeading({
  data,
  status,
  labels,
  titleId,
  titleText,
  ui = 'link-preview',
  truncate,
  slotProps,
}: PreviewHeadingProps) {
  const ready = status === 'ready';
  const title = (ready && data.title) || titleText || data.url;
  const site = (ready && data.site) || hostOf(data.url);
  const titlePart = splitPart(slotProps?.title);
  const statusText: Partial<Record<PreviewHeadingProps['status'], ReactNode>> = {
    pending: <span data-ui={`${ui}-pending`} css={pendingStyle}>{labels.pending}</span>,
    none: <span css={metaStyle}>{labels.unavailable}</span>,
    error: <span css={errorTextStyle}>{data.error || labels.unavailable}</span>,
  };
  return (
    <>
      {ready && data.favicon ? <img src={data.favicon} alt="" css={faviconStyle} /> : null}
      <span css={headingStyle}>
        <a
          {...titlePart.attributes}
          id={titleId}
          href={data.url}
          rel={titlePart.attributes.target?.toLowerCase() === '_blank'
            ? [titlePart.attributes.rel, 'noopener noreferrer'].filter(Boolean).join(' ')
            : titlePart.attributes.rel}
          data-ui={`${ui}-title`}
          data-resolved={ready || undefined}
          className={titlePart.className}
          css={[titleStyle, truncate && titleClampStyle, titlePart.partCss]}
        >
          <bdi>{title}</bdi>
        </a>
        <span css={metaStyle}><bdi dir="ltr">{site}</bdi></span>
        {statusText[status]}
      </span>
    </>
  );
}

interface PreviewBodyProps extends Omit<ComponentPropsWithRef<'div'>, 'children'> {
  data: LinkPreviewData;
  ui?: string;
  truncate?: boolean;
  baseStyle?: Interpolation<Theme>;
  slotProps?: LinkPreviewSlotProps;
}

export function PreviewBody({
  data,
  ui = 'link-preview',
  truncate,
  baseStyle,
  slotProps,
  ...rest
}: PreviewBodyProps) {
  const image = data.image;
  const imageStatus = useImageStatus(image?.src);
  const showImage = image !== undefined && image.src !== '' && imageStatus.status !== 'error';
  const body = splitPart(slotProps?.body);
  const imagePart = splitPart(slotProps?.image);
  return (
    <div
      {...body.attributes}
      {...rest}
      data-ui={`${ui}-card`}
      className={body.className}
      css={[previewBodyStyle, baseStyle, body.partCss]}
    >
      {image !== undefined ? (
        <div data-ui={`${ui}-image-frame`} css={imageFrameStyle}>
          {showImage ? (
            <img
              {...imagePart.attributes}
              src={image.src}
              alt={image.alt}
              ref={imageStatus.ref}
              data-image-state={imageStatus.status}
              onLoad={(event) => {
                imagePart.attributes.onLoad?.(event);
                imageStatus.onLoad();
              }}
              onError={(event) => {
                imagePart.attributes.onError?.(event);
                imageStatus.onError();
              }}
              className={imagePart.className}
              css={[imageStyle, imagePart.partCss]}
            />
          ) : null}
        </div>
      ) : null}
      {isRenderable(data.description) && data.description !== '' ? (
        <p css={[descriptionStyle, truncate && descriptionClampStyle]}>{data.description}</p>
      ) : null}
    </div>
  );
}

export function LinkPreview({
  ref,
  data,
  status = 'ready',
  labels,
  motion = 'auto',
  slotProps,
  className,
  sx,
  ...rest
}: LinkPreviewProps) {
  return (
    <WithSx className={className} styles={[previewSurfaceStyle, typographyStyle]} sx={sx}>
      {(rootClassName) => (
        <div
          {...rest}
          ref={ref}
          data-ui="link-preview"
          data-status={status}
          data-motion={motion}
          className={rootClassName}
        >
          <div css={previewHeaderStyle}>
            <PreviewHeading
              data={data}
              status={status}
              labels={{ ...DEFAULT_LABELS, ...labels }}
              slotProps={slotProps}
              truncate
            />
          </div>
          {status === 'ready' ? <PreviewBody data={data} slotProps={slotProps} truncate /> : null}
        </div>
      )}
    </WithSx>
  );
}

LinkPreview.displayName = 'LinkPreview';
