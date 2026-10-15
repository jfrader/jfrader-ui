'use client';

import { useLayoutEffect, useRef, useState, type ComponentPropsWithRef, type ComponentType, type KeyboardEvent, type ReactElement } from 'react';
import { autoUpdate, flip, offset, shift, useDismiss, useFloating, useInteractions, useMergeRefs } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { WithSx, type SxProps } from '../../styling/sx';
import { FORCED_COLORS } from '../../styling/media';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { OverlayPortal } from '../../overlay/overlay-portal';
import { moveRovingFocus } from '../../utils/roving-focus';
import { Button } from '../button';
import type { ReactionCount } from './reaction-group';

export interface ReactionGroupLabels {
  addReaction: string;
  closeReactions: string;
  reactions: string;
  reactWith: (emoji: string) => string;
  reactionCount: (emoji: string, count: number, mine: boolean) => string;
}

export interface ReactionGroupViewProps extends Omit<ComponentPropsWithRef<'div'>, 'children' | 'onSelect' | 'onToggle'>, SxProps {
  ui?: string;
  counts: readonly ReactionCount[];
  offered: readonly string[];
  number: Intl.NumberFormat;
  labels: ReactionGroupLabels;
  readOnly: boolean;
  disabled: boolean;
  pickerOpen: boolean;
  onPickerOpenChange: (open: boolean) => void;
  onToggle: (emoji: string) => void;
  onSelect?: (emoji: string) => void;
  pickerId: string;
  partProps?: { className?: string; css?: Interpolation<Theme> };
  overlay?: boolean;
  component?: ComponentType<ComponentPropsWithRef<'div'>>;
}

const PICKER_GAP = 4;
const VIEWPORT_PADDING = 8;
const reactionsStyle = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: vars.space[1] });
const chipStyle = css({
  gap: vars.space[1], paddingInline: vars.space[2], fontVariantNumeric: 'tabular-nums',
  '&[aria-pressed="true"]': {
    borderWidth: '2px', borderColor: vars.color.accentBorder, backgroundColor: vars.color.accentSoft,
    color: vars.color.accentText, fontWeight: vars.fontWeight.semibold,
  },
  [FORCED_COLORS]: { '&[aria-pressed="true"]': { borderColor: 'Highlight' } },
});
const staticChipStyle = css({
  display: 'inline-flex', alignItems: 'center', gap: vars.space[1], minBlockSize: vars.space[6],
  paddingInline: vars.space[2], border: `1px solid ${vars.color.border}`, borderRadius: vars.radius.full,
  fontSize: vars.textSize.sm, fontVariantNumeric: 'tabular-nums',
});
const iconButtonStyle = css({ minInlineSize: vars.space[8], paddingInline: vars.space[2] });
const pickerStyle = css({
  display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: vars.space[1], padding: vars.space[1],
  border: `1px solid ${vars.color.border}`, borderRadius: vars.radius.md, backgroundColor: vars.color.surface,
  [FORCED_COLORS]: { borderColor: 'CanvasText' },
});
const glyphStyle = css({ display: 'block', inlineSize: '1em', blockSize: '1em' });
const smileGlyph = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" css={glyphStyle} aria-hidden="true">
    <circle cx="8" cy="8" r="6.25" />
    <path d="M5.5 9.5c.6.9 1.4 1.3 2.5 1.3s1.9-.4 2.5-1.3M6 6.25h.01M10 6.25h.01" strokeLinecap="round" />
  </svg>
);
const closeGlyph = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" css={glyphStyle} aria-hidden="true">
    <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
  </svg>
);

export function ReactionGroupView({
  ui: owner, counts, offered, number, labels, readOnly, disabled, pickerOpen, onPickerOpenChange,
  onToggle, onSelect = onToggle, pickerId, partProps, overlay = false, component, className, sx, ...rootProps
}: ReactionGroupViewProps) {
  const Root = component ?? 'div';
  const rootUi = owner ? `${owner}-reactions` : 'reaction-group';
  const pickerUi = owner ? `${owner}-picker` : 'reaction-group-picker';
  const addRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const [rovingIndex, setRovingIndex] = useState(0);
  const emojiQuery = { itemSelector: '[data-part="emoji"]:not([disabled])', ownerSelector: `[data-ui="${pickerUi}"]` };
  const canPick = !readOnly && offered.length > 0;
  const showPicker = canPick && pickerOpen;
  const { refs, context, floatingStyles } = useFloating({
    open: overlay && showPicker, onOpenChange: onPickerOpenChange, placement: 'bottom-start',
    middleware: [offset(PICKER_GAP), flip(), shift({ padding: VIEWPORT_PADDING })], whileElementsMounted: autoUpdate,
  });
  const dismiss = useDismiss(context, { enabled: overlay, escapeKey: false });
  const { getFloatingProps } = useInteractions([dismiss]);
  const addRefs = useMergeRefs([addRef, refs.setReference]);

  useLayoutEffect(() => {
    if (pickerOpen || !restoreFocus.current) return;
    restoreFocus.current = false;
    addRef.current?.focus();
  }, [pickerOpen]);

  const close = () => { restoreFocus.current = true; onPickerOpenChange(false); };
  if (counts.length === 0 && !canPick) return null;

  const handlePickerKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation(); close(); return;
    }
    moveRovingFocus(event, event.currentTarget, 'horizontal', emojiQuery);
  };

  return (
    <WithSx className={[className, partProps?.className].filter(Boolean).join(' ') || undefined} styles={[reactionsStyle, partProps?.css]} sx={sx}>
      {(rootClass) => (
        <Root {...rootProps} data-ui={rootUi} className={rootClass}>
          {counts.map(({ emoji, count, mine = false }) => {
            const name = labels.reactionCount(emoji, count, mine);
            const content = <><span aria-hidden="true">{emoji}</span><span aria-hidden="true">{number.format(count)}</span></>;
            return readOnly ? (
              <span key={emoji} data-part="reaction" css={staticChipStyle}>
                {content}<span css={visuallyHiddenStyle}>{name}</span>
              </span>
            ) : (
              <Button key={emoji} variant="outline" size="sm" data-part="reaction" aria-label={name}
                aria-pressed={mine} disabled={disabled} onClick={() => onToggle(emoji)} css={chipStyle}>
                {content}
              </Button>
            );
          })}
          {canPick ? (
            <Button ref={addRefs} variant="ghost" size="sm" aria-label={labels.addReaction}
              aria-expanded={showPicker} aria-controls={showPicker ? pickerId : undefined} disabled={disabled}
              data-action="react" onClick={() => onPickerOpenChange(!pickerOpen)} css={iconButtonStyle}>
              {smileGlyph}
            </Button>
          ) : null}
          {showPicker ? (
            <PickerOverlay overlay={overlay}>
              <div {...(overlay ? getFloatingProps() : {})} ref={overlay ? refs.setFloating : undefined}
                style={overlay ? floatingStyles : undefined}
                dir={overlay && addRef.current ? addRef.current.ownerDocument.defaultView?.getComputedStyle(addRef.current).direction : undefined}
                id={pickerId} role="group" aria-label={labels.reactions} data-ui={pickerUi}
                onKeyDown={handlePickerKeyDown}
                onBlur={(event) => {
                  if (overlay && !event.currentTarget.contains(event.relatedTarget) && event.relatedTarget !== addRef.current) onPickerOpenChange(false);
                }} css={pickerStyle}>
                {offered.map((emoji, index) => (
                  <Button key={emoji} variant="ghost" size="sm" data-part="emoji" aria-label={labels.reactWith(emoji)}
                    tabIndex={index === Math.min(rovingIndex, offered.length - 1) ? 0 : -1} autoFocus={index === 0}
                    disabled={disabled} onFocus={() => setRovingIndex(index)}
                    onClick={() => { onSelect(emoji); close(); }} css={iconButtonStyle}>
                    <span aria-hidden="true">{emoji}</span>
                  </Button>
                ))}
                <Button variant="ghost" size="sm" aria-label={labels.closeReactions} onClick={close} css={iconButtonStyle}>
                  {closeGlyph}
                </Button>
              </div>
            </PickerOverlay>
          ) : null}
        </Root>
      )}
    </WithSx>
  );
}

function PickerOverlay({ overlay, children }: { overlay: boolean; children: ReactElement }) {
  return overlay ? <OverlayPortal>{children}</OverlayPortal> : children;
}
