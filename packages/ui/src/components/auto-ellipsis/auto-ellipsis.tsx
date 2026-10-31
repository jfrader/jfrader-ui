// Single-line text cut to a real string ending in `…`, sized to the root's content box.
// Measurement: canvas `measureText` with the root's computed font, plus its letter and word
// spacing, binary-searched over grapheme boundaries (`fitText`). It runs in a layout effect and
// again on ResizeObserver, text change, and web-font loads; never during render, so the server and
// the first client render both carry the full text.
import { useEffect, useLayoutEffect, useRef, useState, type ComponentPropsWithRef } from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { css } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { WithSx, type SxProps } from '../../styling/sx';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { Tooltip } from '../tooltip';

export interface AutoEllipsisProps extends Omit<ComponentPropsWithRef<'span'>, 'children'>, SxProps {
  /** Text shown on one line, cut with `…` at the inline end when it does not fit. */
  text: string;
  /** Show the full text in a tooltip on hover and keyboard focus while it is cut. Defaults to `true`. */
  tooltip?: boolean;
  /** Cut text to one line. Set false for wrapping full text without measurement or a tooltip. Defaults to `true`. */
  truncate?: boolean;
  /** Fix the root's inline size, in px. Measurement still reads the rendered box. */
  width?: number;
  /** Add root markers alongside the built-in `auto-ellipsis` marker. */
  'data-ui'?: string;
}

const ELLIPSIS = '…';
// `white-space: nowrap` collapses runs of these to one space and drops them at the line edges.
const COLLAPSIBLE_RUN = /[ \t\n\r\f]+/g;
const COLLAPSIBLE_EDGES = /^[ \t\n\r\f]+|[ \t\n\r\f]+$/g;
// `word-spacing` applies to the space and the no-break space.
const WORD_SEPARATORS = / |\xa0/g;

const TEXT_TRANSFORMS: Partial<Record<string, (text: string) => string>> = {
  uppercase: (text) => text.toUpperCase(),
  lowercase: (text) => text.toLowerCase(),
};

const rootStyle = css({
  label: 'auto-ellipsis',
  position: 'relative',
  display: 'block',
  minInlineSize: 0,
  maxInlineSize: '100%',
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  minBlockSize: '1lh',
  '&:focus-visible': focusRingOutset,
  '&[data-truncate="false"]': { whiteSpace: 'normal', overflowWrap: 'anywhere' },
});

const visibleTextStyle = css({ display: 'inline' });

const contexts = new WeakMap<Document, CanvasRenderingContext2D | null>();

function measuringContext(document: Document) {
  if (!contexts.has(document)) contexts.set(document, document.createElement('canvas').getContext('2d'));
  return contexts.get(document) ?? null;
}

function contentInlineSize(style: CSSStyleDeclaration) {
  const width = Number.parseFloat(style.width);
  if (style.boxSizing !== 'border-box') return width;
  const edges = [style.paddingLeft, style.paddingRight, style.borderLeftWidth, style.borderRightWidth];
  return edges.reduce((size, edge) => size - Number.parseFloat(edge), width);
}

function lengthPx(value: string) {
  return Number.parseFloat(value) || 0;
}

function graphemeEnds(text: string) {
  const segments =
    typeof Intl.Segmenter === 'function'
      ? Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), ({ segment }) => segment)
      : Array.from(text);
  let end = 0;
  return segments.map((segment) => (end += segment.length));
}

/**
 * `text` when it fits the element's content box, otherwise the longest grapheme prefix of its
 * collapsed form that fits once `…` is added.
 */
function fitText(element: HTMLElement, text: string, ends: (line: string) => number[]) {
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  const context = measuringContext(element.ownerDocument);
  // A root without a box (`display: none`) reports `auto`; keep the text until it is laid out.
  const available = style ? contentInlineSize(style) : Number.NaN;
  if (!style || !context || Number.isNaN(available)) return text;
  context.font = style.font || `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  context.fontKerning = style.fontKerning as CanvasFontKerning;
  context.direction = style.direction === 'rtl' ? 'rtl' : 'ltr';
  const letterSpacing = lengthPx(style.letterSpacing);
  const wordSpacing = lengthPx(style.wordSpacing);
  const nativeSpacing = 'letterSpacing' in context && 'wordSpacing' in context;
  if (nativeSpacing) {
    context.letterSpacing = `${letterSpacing}px`;
    context.wordSpacing = `${wordSpacing}px`;
  }
  const transform = TEXT_TRANSFORMS[style.textTransform];
  // Native canvas spacing follows shaping, including transformed and combining characters.
  const width = (candidate: string) => {
    const shown = transform ? transform(candidate) : candidate;
    const separators = shown.match(WORD_SEPARATORS)?.length ?? 0;
    const spacing = nativeSpacing ? 0 : Array.from(shown).length * letterSpacing + separators * wordSpacing;
    return context.measureText(shown).width + spacing;
  };

  const line = text.replace(COLLAPSIBLE_RUN, ' ').replace(COLLAPSIBLE_EDGES, '');
  const boundaries = ends(line);
  if (width(line) <= available) return text;
  if (width(ELLIPSIS) > available) return '';
  const cut = (count: number) => `${line.slice(0, count === 0 ? 0 : boundaries[count - 1]).trimEnd()}${ELLIPSIS}`;
  let low = 0;
  let high = boundaries.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (width(cut(middle)) <= available) low = middle;
    else high = middle - 1;
  }
  return cut(low);
}

interface Fit {
  text: string;
  shown: string;
}

/**
 * Fit plain text without changing its readable content. Tooltip.Trigger uses its native span host
 * so headings retain text semantics. The tooltip repeats the visually hidden full text, so it is
 * visual-only and does not add a second accessible description. Measurement uses a detached canvas,
 * not a second text node in the layout. If even the ellipsis cannot fit, the visible string is empty.
 */
export function AutoEllipsis({
  text,
  tooltip = true,
  truncate = true,
  width,
  ref,
  className,
  style,
  sx,
  'data-ui': dataUiProp,
  ...rest
}: AutoEllipsisProps) {
  const [fit, setFit] = useState<Fit | null>(null);
  const shown = truncate && fit?.text === text ? fit.shown : text;
  const truncated = shown !== text;
  const shownRef = useRef(shown);
  const rootRef = useRef<HTMLSpanElement>(null);

  const [open, setOpen] = useState(false);
  const hasTooltip = tooltip && truncated;
  const mergedRef = useMergeRefs([ref, rootRef]);
  useEffect(() => {
    if (!hasTooltip) setOpen(false);
  }, [hasTooltip]);

  useLayoutEffect(() => {
    shownRef.current = shown;
  });

  useLayoutEffect(() => {
    const element = rootRef.current;
    if (!element || !truncate) return;
    let ends: number[] | undefined;
    const update = () => {
      const next = fitText(element, text, (line) => (ends ??= graphemeEnds(line)));
      if (next !== shownRef.current) setFit({ text, shown: next });
    };
    update();
    const view = element.ownerDocument.defaultView;
    const observer = view && 'ResizeObserver' in view ? new view.ResizeObserver(update) : undefined;
    observer?.observe(element);
    const fonts = element.ownerDocument.fonts as FontFaceSet | undefined;
    let active = true;
    void fonts?.ready.then(() => active && update());
    fonts?.addEventListener('loadingdone', update);
    return () => {
      active = false;
      observer?.disconnect();
      fonts?.removeEventListener('loadingdone', update);
    };
  }, [text, truncate]);

  const dataUi = [
    ...new Set(['auto-ellipsis', ...(dataUiProp?.split(/\s+/).filter(Boolean) ?? [])]),
  ].join(' ');

  return (
    <Tooltip open={hasTooltip && open} onOpenChange={(next) => setOpen(hasTooltip && next)}>
      <WithSx className={className} styles={rootStyle} sx={sx}>
        {(resolvedClassName) => (
          <Tooltip.Trigger
            as="span"
            describe={false}
            tabIndex={hasTooltip ? 0 : undefined}
            {...rest}
            ref={mergedRef}
            className={resolvedClassName}
            style={width === undefined ? style : { ...style, inlineSize: width }}
            data-ui={dataUi}
            data-truncated={truncated || undefined}
            data-truncate={truncate ? undefined : 'false'}
          >
            {truncated && (
              <span css={visuallyHiddenStyle} data-ui="auto-ellipsis-full">{text}</span>
            )}
            <span css={visibleTextStyle} data-ui="auto-ellipsis-text" aria-hidden={truncated || undefined}>
              {shown}
            </span>
          </Tooltip.Trigger>
        )}
      </WithSx>
      <Tooltip.Content aria-hidden="true">{text}</Tooltip.Content>
    </Tooltip>
  );
}

AutoEllipsis.displayName = 'AutoEllipsis';
