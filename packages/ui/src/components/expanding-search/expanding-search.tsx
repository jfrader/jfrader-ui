'use client';

import { useId, useLayoutEffect, useRef, useState, type ComponentPropsWithRef, type CSSProperties, type Ref } from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css, type SerializedStyles } from '../../styling/css';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { WithSx } from '../../styling/sx';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import { Button } from '../button';
import { SearchField, type SearchFieldProps, type SearchFieldSize } from '../search-field';

export interface ExpandingSearchProps extends Omit<SearchFieldProps, 'ref'> {
  ref?: Ref<HTMLDivElement>;
  inputRef?: Ref<HTMLInputElement>;
  /** Accessible name of the collapsed button; also the input's fallback name. */
  triggerLabel: string;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  anchor?: 'start' | 'end';
  expandedWidth?: CSSProperties['inlineSize'];
  rootProps?: Omit<ComponentPropsWithRef<'div'>, 'ref' | 'children' | 'className'>;
}

const rootStyle = css({
  position: 'relative', inlineSize: '100%', minInlineSize: 0,
  minBlockSize: 'var(--expanding-search-size)', pointerEvents: 'none',
});
const sizeStyles: Record<SearchFieldSize, SerializedStyles> = {
  sm: css({ '--expanding-search-size': vars.space[8] }),
  md: css({ '--expanding-search-size': vars.space[10] }),
  lg: css({ '--expanding-search-size': vars.space[12] }),
};
const shellStyle = css({
  position: 'relative', marginInlineStart: 'auto',
  minInlineSize: 0, maxInlineSize: '100%', pointerEvents: 'auto', overflow: 'clip', overflowClipMargin: vars.space[1],
  transitionProperty: 'inline-size', transitionDuration: vars.motion.duration.slow,
  transitionTimingFunction: vars.motion.easeStandard,
  '&[data-anchor="start"]': { marginInlineStart: 0, marginInlineEnd: 'auto' },
  [REDUCED_MOTION]: { transitionDuration: '0s' },
});
const fieldStyle = css({
  inlineSize: 'var(--expanding-search-measured-width)',
  '&[data-anchor="end"]': { position: 'relative', insetInlineStart: 'calc(100% - var(--expanding-search-measured-width))' },
});
const triggerWrapStyle = css({ position: 'absolute', insetBlockStart: 0, insetInlineStart: 0 });
const measureStyle = css({
  position: 'absolute', inlineSize: 'var(--expanding-search-width)', maxInlineSize: '100%',
  blockSize: 0, visibility: 'hidden', pointerEvents: 'none',
});
const triggerStyle = css({
  inlineSize: 'var(--expanding-search-size)', paddingInline: 0, borderRadius: vars.radius.full,
  borderColor: vars.color.borderControl, backgroundColor: vars.color.surfaceRaised,
  [FORCED_COLORS]: { borderColor: 'ButtonText', color: 'ButtonText' },
});
const iconStyle = css({
  display: 'flex', inlineSize: vars.space[4], blockSize: vars.space[4],
  '& > svg': { inlineSize: '100%', blockSize: '100%' },
});
const searchGlyph = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>;

export function ExpandingSearch({
  ref, inputRef, triggerLabel, open: openProp, defaultOpen = false, onOpenChange,
  anchor = 'end', expandedWidth = `calc(${vars.space[12]} * 8)`, rootProps,
  size = 'md', className, sx, dir, disabled, searchIcon = searchGlyph,
  onKeyDown, 'aria-label': ariaLabel, ...fieldProps
}: ExpandingSearchProps) {
  const [open = false, requestOpen] = useControlledState(openProp, defaultOpen, onOpenChange);
  const rootRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const mergedRootRef = useMergeRefs([rootRef, ref]);
  const mergedInputRef = useMergeRefs([editorRef, inputRef]);
  const regionId = useId();
  const focusRequest = useRef<'input' | 'trigger' | null>(null);
  const [width, setWidth] = useState<number>();

  useLayoutEffect(() => {
    const root = rootRef.current;
    const measure = measureRef.current;
    if (!root || !measure) return;
    const update = () => setWidth(measure.getBoundingClientRect().width);
    update();
    const Resize = root.ownerDocument.defaultView?.ResizeObserver;
    if (!Resize) return;
    const observer = new Resize(update);
    observer.observe(root);
    observer.observe(measure);
    return () => observer.disconnect();
  }, [expandedWidth]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const active = root.ownerDocument.activeElement;
    if (open && focusRequest.current === 'input') {
      focusRequest.current = null;
      if (root.contains(active) || active === root.ownerDocument.body) editorRef.current?.focus();
    } else if (!open && focusRequest.current === 'trigger') {
      focusRequest.current = null;
      if (root.contains(active) || active === root.ownerDocument.body) triggerRef.current?.focus();
    }
  }, [open]);

  return (
    <WithSx className={className} styles={[rootStyle, sizeStyles[size]]} sx={sx}>
      {(rootClass) => (
        <div
          {...rootProps} ref={mergedRootRef} className={rootClass} dir={dir}
          data-ui="expanding-search" data-state={open ? 'open' : 'closed'}
          style={{ '--expanding-search-width': expandedWidth, '--expanding-search-measured-width': width === undefined ? 'var(--expanding-search-width)' : `${width}px`, ...rootProps?.style } as CSSProperties}
          onKeyDown={(event) => {
            rootProps?.onKeyDown?.(event);
            if (event.defaultPrevented || !open || disabled || event.key !== 'Escape' || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
            event.preventDefault();
            focusRequest.current = 'trigger';
            requestOpen(false);
          }}
          onBlur={(event) => {
            rootProps?.onBlur?.(event);
            if (event.defaultPrevented || !open) return;
            const root = event.currentTarget;
            const next = event.relatedTarget;
            if (next && !root.contains(next)) {
              focusRequest.current = null;
              requestOpen(false);
            } else if (!next) {
              queueMicrotask(() => {
                if (root.isConnected && root.ownerDocument.hasFocus() && !root.contains(root.ownerDocument.activeElement)) {
                  focusRequest.current = null;
                  requestOpen(false);
                }
              });
            }
          }}
        >
          <span ref={measureRef} aria-hidden css={measureStyle} />
          <div css={shellStyle} data-anchor={anchor} style={{ inlineSize: open ? width ?? 'var(--expanding-search-width)' : 'var(--expanding-search-size)' }}>
            <div hidden={open} inert={open} css={triggerWrapStyle}>
              <Button ref={triggerRef} size={size} variant="outline" disabled={disabled}
                aria-label={triggerLabel} aria-expanded={open} aria-controls={regionId} css={triggerStyle}
                onClick={() => { focusRequest.current = 'input'; requestOpen(true); }}>
                <span aria-hidden css={iconStyle}>{searchIcon}</span>
              </Button>
            </div>
            <div id={regionId} aria-hidden={!open || undefined} inert={!open} data-anchor={anchor} css={fieldStyle} style={{ visibility: open ? 'visible' : 'hidden' }}>
              <SearchField {...fieldProps} ref={mergedInputRef} size={size} dir={dir} disabled={disabled}
                searchIcon={searchIcon} aria-label={ariaLabel ?? (!isRenderable(fieldProps.label) || fieldProps.label === '' ? triggerLabel : undefined)}
                onKeyDown={(event) => {
                  onKeyDown?.(event);
                  if (event.defaultPrevented || disabled || event.key !== 'Escape' || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
                  event.preventDefault();
                  focusRequest.current = 'trigger';
                  requestOpen(false);
                }} />
            </div>
          </div>
        </div>
      )}
    </WithSx>
  );
}
ExpandingSearch.displayName = 'ExpandingSearch';
