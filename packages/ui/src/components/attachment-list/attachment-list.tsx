'use client';

import { useMemo, useState, type ComponentPropsWithRef, type ComponentType } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { FORCED_COLORS } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { fileSize, safeUrl } from '../../utils/attachment';
import { numberFormatter } from '../../utils/intl';
import { Button, type ButtonProps } from '../button';

export interface Attachment {
  id: string;
  name: string;
  kind: 'image' | 'file';
  /** Link and thumbnail URL. Unsafe schemes render as plain text. */
  url?: string;
  /** File size in bytes. */
  size?: number;
  width?: number;
  height?: number;
  alt?: string;
  /** Download filename, or false to navigate to the URL. Defaults to `name`. */
  download?: string | boolean;
  /** Browsing context for a link. */
  target?: ComponentPropsWithRef<'a'>['target'];
}

export interface AttachmentListLabels {
  attachments: string;
  showAttachments: (count: number) => string;
}

type PartProps = { className?: string; css?: Interpolation<Theme> };

export interface AttachmentListSlots {
  /** Replaces the list item wrapping an individual attachment; renders `li` by default. */
  item?: ComponentType<ComponentPropsWithRef<'li'>>;
  /** Replaces the anchor element wrapping a downloadable attachment link; renders `a` by default. */
  link?: ComponentType<ComponentPropsWithRef<'a'>>;
  /** Replaces the button revealing remaining hidden attachments; renders `Button` by default. */
  expandButton?: ComponentType<ButtonProps>;
}

export interface AttachmentListSlotProps {
  /** List item wrapping an individual attachment. */
  item?: PartProps;
  /** Anchor element wrapping a downloadable attachment link. */
  link?: PartProps;
  /** Button revealing remaining hidden attachments; renders `Button`. */
  expandButton?: Omit<ButtonProps, 'children' | 'type' | 'render'>;
}

export interface AttachmentListProps extends Omit<ComponentPropsWithRef<'ul'>, 'children'>, SxProps {
  /** Files and images to display. */
  attachments: readonly Attachment[];
  /** Locale used to format file sizes and the remaining count. */
  locale?: Intl.LocalesArgument;
  /** Translate the list name and expand button. */
  labels?: Partial<AttachmentListLabels>;
  /** Maximum visible items before expansion. Defaults to 4; Infinity shows all. */
  previewCount?: number;
  /** Replacement components for interior parts. */
  slots?: AttachmentListSlots;
  /** Style items and links, or pass props to the expand button. */
  slotProps?: AttachmentListSlotProps;
}

interface AttachmentListViewProps extends AttachmentListProps {
  owner?: string;
  partProps?: PartProps;
}

export const DEFAULT_PREVIEW_COUNT = 4;
export const fileStyle = css({
  display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: vars.space[2], padding: vars.space[2],
  border: `1px solid ${vars.color.borderControl}`, borderRadius: vars.radius.sm,
  minInlineSize: 0, overflowWrap: 'anywhere', [FORCED_COLORS]: { borderColor: 'CanvasText' },
});
export const imageStyle = css({
  display: 'block', maxInlineSize: '100%', blockSize: 'auto', aspectRatio: '4 / 3',
  objectFit: 'contain', borderRadius: vars.radius.sm,
});
export const previewStyle = css({ inlineSize: vars.space[12], blockSize: vars.space[12], objectFit: 'cover' });
const attachmentsStyle = css({ display: 'grid', gap: vars.space[2], listStyle: 'none', padding: 0, margin: 0 });
const typographyStyle = css({ fontFamily: vars.font.sans, fontSize: vars.textSize.sm, lineHeight: vars.lineHeight.base, color: vars.color.text });
const linkStyle = css({ color: vars.color.accentText, overflowWrap: 'anywhere', '&:focus-visible': focusRingOutset });
const glyphStyle = css({ inlineSize: '1em', blockSize: '1em', verticalAlign: 'middle', marginInlineEnd: vars.space[2] });

const fileGlyph = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" css={glyphStyle} aria-hidden="true">
    <path d="M3 1h6l4 4v10H3V1Z M9 1v4h4" />
  </svg>
);
const imageGlyph = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" css={glyphStyle} aria-hidden="true">
    <rect x="2" y="2" width="12" height="12" rx="2" /><circle cx="5.5" cy="5.5" r="1" />
    <path d="m2 12 4-4 3 3 2-2 3 3" />
  </svg>
);

export function AttachmentListView({
  attachments, locale, labels: labelProps, previewCount = DEFAULT_PREVIEW_COUNT,
  owner, partProps, slots, slotProps, className, sx, ...rootProps
}: AttachmentListViewProps) {
  const Item = slots?.item ?? 'li';
  const Link = slots?.link ?? 'a';
  const ExpandButton = slots?.expandButton ?? Button;
  const [expanded, setExpanded] = useState(false);
  const limit = previewCount === Infinity ? Infinity : Number.isFinite(previewCount) ? Math.max(0, Math.floor(previewCount)) : DEFAULT_PREVIEW_COUNT;
  const shown = expanded ? attachments : attachments.slice(0, limit);
  const labels = useMemo(() => {
    const number = numberFormatter(locale);
    const plural = new Intl.PluralRules(locale);
    return {
      attachments: 'Attachments',
      showAttachments: (count: number) => `Show ${number.format(count)} more ${plural.select(count) === 'one' ? 'attachment' : 'attachments'}`,
      ...labelProps,
    };
  }, [locale, labelProps]);

  return (
    <>
      <WithSx className={[className, partProps?.className].filter(Boolean).join(' ') || undefined}
        styles={[attachmentsStyle, !owner && typographyStyle, partProps?.css]} sx={sx}>
        {(rootClass) => (
          <ul role="list" aria-label={labels.attachments} {...rootProps}
            data-ui={owner ? `${owner}-attachments` : 'attachment-list'} className={rootClass}>
            {shown.map((attachment) => {
              const url = safeUrl(attachment.url);
              const content = (
                <>
                  {attachment.kind === 'image' && url ? (
                    <img src={url} alt={attachment.alt ?? attachment.name} width={attachment.width} height={attachment.height}
                      style={attachment.width && attachment.height ? { aspectRatio: `${attachment.width} / ${attachment.height}` } : undefined}
                      css={imageStyle} />
                  ) : null}
                  <span>
                    {!owner ? attachment.kind === 'image' ? imageGlyph : fileGlyph : null}
                    {attachment.name}{attachment.size !== undefined ? ` · ${fileSize(attachment.size, locale)}` : ''}
                  </span>
                </>
              );
              return (
                <Item key={attachment.id} className={slotProps?.item?.className} css={[fileStyle, slotProps?.item?.css]}>
                  {url ? (
                    <Link href={url} download={attachment.download === false ? undefined : attachment.download ?? attachment.name}
                      target={attachment.target} rel={attachment.target === '_blank' ? 'noopener noreferrer' : undefined}
                      className={slotProps?.link?.className} css={[linkStyle, slotProps?.link?.css]}>{content}</Link>
                  ) : content}
                </Item>
              );
            })}
          </ul>
        )}
      </WithSx>
      {!expanded && attachments.length > limit ? (
        <ExpandButton size="sm" variant="outline" {...slotProps?.expandButton} onClick={(event) => {
          slotProps?.expandButton?.onClick?.(event);
          if (!event.defaultPrevented) setExpanded(true);
        }}>{labels.showAttachments(attachments.length - limit)}</ExpandButton>
      ) : null}
    </>
  );
}

export function AttachmentList(props: AttachmentListProps) {
  return <AttachmentListView {...props} />;
}

AttachmentList.displayName = 'AttachmentList';
