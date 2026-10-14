'use client';

import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ComponentType,
  type CSSProperties,
  type Ref,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { animate, useMotionValue } from 'motion/react';
import { base } from '@jfrader/tokens';
import { vars } from '@jfrader/tokens/vars';
import { css, type SerializedStyles } from '../../styling/css';
import { FORCED_COLORS } from '../../styling/media';
import type { SxProps } from '../../styling/sx';
import { FieldSlot, type FieldSlots, type FieldParts } from '../field/field-slot';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import { Button, type ButtonProps } from '../button';
import {
  SearchField,
  type SearchFieldProps,
  type SearchFieldSize,
  type SearchFieldSlots,
  type SearchFieldSlotProps,
} from '../search-field';

type ExpandingSearchAnatomy = {
  root: 'div';
  container: 'div';
  measure: 'span';
  triggerWrapper: 'div';
  triggerIcon: 'span';
  region: 'div';
};
export type ExpandingSearchSlots = FieldSlots<ExpandingSearchAnatomy> &
  Omit<SearchFieldSlots, 'root'> & {
    field?: ComponentType<SearchFieldProps>;
    fieldRoot?: SearchFieldSlots['root'];
    trigger?: ComponentType<ButtonProps>;
  };
export type ExpandingSearchSlotProps = FieldParts<ExpandingSearchAnatomy> &
  SearchFieldSlotProps & {
    field?: Omit<SearchFieldProps, 'ref' | 'value' | 'defaultValue' | 'onValueChange'>;
    trigger?: ButtonProps;
  };

export type ExpandingSearchInputProps = Omit<
  ComponentPropsWithRef<'input'>,
  'ref' | 'type' | 'role' | 'size' | 'value' | 'defaultValue' | 'children' | 'disabled' | 'dir' | 'className'
>;

export interface ExpandingSearchProps
  extends
    Omit<ComponentPropsWithRef<'div'>, 'children' | 'defaultValue' | 'onChange'>,
    SxProps,
    Pick<
      SearchFieldProps,
      | 'value'
      | 'defaultValue'
      | 'onValueChange'
      | 'label'
      | 'description'
      | 'error'
      | 'clearable'
      | 'messages'
      | 'searchIcon'
      | 'clearIcon'
    > {
  /** Accessible name of the collapsed button; also the input's fallback name. */
  triggerLabel: string;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  anchor?: 'start' | 'end';
  expandedWidth?: CSSProperties['inlineSize'];
  size?: SearchFieldSize;
  disabled?: boolean;
  /** Native attributes and events of the search input. */
  inputProps?: ExpandingSearchInputProps;
  inputRef?: Ref<HTMLInputElement>;
  /** Replace the wrapper div; `slots.root` takes precedence. */
  component?: ExpandingSearchSlots['root'];
  /** Replace generated parts with components that forward props and ref. */
  slots?: ExpandingSearchSlots;
  slotProps?: ExpandingSearchSlotProps;
}

interface Geometry {
  expanded: number;
  size: number;
  radius: number;
}

const GEOMETRY_SPRING = {
  type: 'spring',
  visualDuration: Number.parseFloat(base.motion.duration.slow) / 1000, // '240ms' -> 0.24s
  bounce: 0,
} as const;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const rootStyle = css({
  position: 'relative',
  inlineSize: '100%',
  minInlineSize: 0,
  minBlockSize: 'var(--expanding-search-size)',
  pointerEvents: 'none',
});
const sizeStyles: Record<SearchFieldSize, SerializedStyles> = {
  sm: css({ '--expanding-search-size': vars.space[8] }),
  md: css({ '--expanding-search-size': vars.space[10] }),
  lg: css({ '--expanding-search-size': vars.space[12] }),
};
// Pre-measurement fallback; once measured, the geometry motion values own inline-size and radius.
const shellStyle = css({
  position: 'relative',
  marginInlineStart: 'auto',
  inlineSize: 'var(--expanding-search-size)',
  '--expanding-search-radius': vars.radius.full,
  minInlineSize: 0,
  maxInlineSize: '100%',
  pointerEvents: 'auto',
  overflow: 'clip',
  overflowClipMargin: vars.space[1],
  '&[data-state="open"]': { inlineSize: 'var(--expanding-search-width)', '--expanding-search-radius': vars.radius.sm },
  '&[data-anchor="start"]': { marginInlineStart: 0, marginInlineEnd: 'auto' },
});
const triggerWrapStyle = css({ position: 'absolute', insetBlockStart: 0, insetInline: 0 });
const measureStyle = css({
  position: 'absolute',
  inlineSize: 'var(--expanding-search-width)',
  maxInlineSize: '100%',
  blockSize: 'var(--expanding-search-size)',
  borderStartStartRadius: vars.radius.sm,
  visibility: 'hidden',
  pointerEvents: 'none',
});
const triggerStyle = css({
  inlineSize: '100%',
  paddingInline: 0,
  borderRadius: 'var(--expanding-search-radius)',
  borderColor: vars.color.borderControl,
  backgroundColor: vars.color.surfaceRaised,
  [FORCED_COLORS]: { borderColor: 'ButtonText', color: 'ButtonText' },
});
const fieldShellStyle = css({ borderRadius: 'var(--expanding-search-radius)', overflow: 'clip' });
const iconStyle = css({
  display: 'flex',
  inlineSize: vars.space[4],
  blockSize: vars.space[4],
  '& > svg': { inlineSize: '100%', blockSize: '100%' },
});
// Not mirrored under :dir(rtl): the magnifier is not directional, and SearchField keeps the same glyph unmirrored.
const searchGlyph = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m16 16 5 5" />
  </svg>
);

const sameGeometry = (a: Geometry | undefined, b: Geometry) =>
  a?.expanded === b.expanded && a.size === b.size && a.radius === b.radius;

export function ExpandingSearch({
  ref,
  inputRef,
  triggerLabel,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  anchor = 'end',
  expandedWidth = `calc(${vars.space[12]} * 8)`,
  size = 'md',
  disabled,
  value,
  defaultValue,
  onValueChange,
  label,
  description,
  error,
  clearable,
  messages,
  searchIcon = searchGlyph,
  clearIcon,
  component,
  slots,
  slotProps,
  inputProps,
  className,
  sx,
  dir,
  style,
  onKeyDown,
  onBlur,
  ...rootProps
}: ExpandingSearchProps) {
  const Field = slots?.field ?? SearchField;
  const Trigger = slots?.trigger ?? Button;
  const [open = false, requestOpen] = useControlledState(openProp, defaultOpen, onOpenChange);
  const rootRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const mergedRootRef = useMergeRefs([rootRef, ref]);
  const mergedInputRef = useMergeRefs([editorRef, inputRef]);
  const mergedTriggerRef = useMergeRefs([triggerRef, slotProps?.trigger?.ref]);
  const regionId = useId();
  const focusRequest = useRef<'input' | 'trigger' | null>(null);
  const [geometry, setGeometry] = useState<Geometry>();
  const width = useMotionValue(0);
  const radius = useMotionValue(0);
  const settledOpen = useRef<boolean>(undefined);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const measure = measureRef.current;
    if (!root || !measure) return;
    const update = () => {
      const rect = measure.getBoundingClientRect();
      const next = {
        expanded: rect.width,
        size: rect.height,
        radius: Number.parseFloat(getComputedStyle(measure).borderStartStartRadius),
      };
      setGeometry((current) => (sameGeometry(current, next) ? current : next));
    };
    update();
    const Resize = root.ownerDocument.defaultView?.ResizeObserver;
    if (!Resize) return;
    const observer = new Resize(update);
    observer.observe(root);
    observer.observe(measure);
    return () => observer.disconnect();
  }, [expandedWidth]);

  // Open/close springs; first paint, lane resizes and reduced motion snap.
  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell || !geometry) return;
    const target = open
      ? { width: geometry.expanded, radius: geometry.radius }
      : { width: geometry.size, radius: geometry.size / 2 };
    const write = () => {
      shell.style.inlineSize = `${width.get()}px`;
      shell.style.setProperty('--expanding-search-radius', `${radius.get()}px`);
    };
    const snap = () => {
      width.jump(target.width);
      radius.jump(target.radius);
      write();
    };
    const unsubscribe = [width.on('change', write), radius.on('change', write)];
    const reduced = shell.ownerDocument.defaultView?.matchMedia(REDUCED_MOTION_QUERY);
    if (settledOpen.current === undefined || settledOpen.current === open || reduced?.matches) snap();
    else {
      animate(width, target.width, GEOMETRY_SPRING);
      animate(radius, target.radius, GEOMETRY_SPRING);
    }
    settledOpen.current = open;
    const onPreference = () => {
      if (reduced?.matches) snap();
    };
    reduced?.addEventListener('change', onPreference);
    return () => {
      unsubscribe.forEach((stop) => stop());
      reduced?.removeEventListener('change', onPreference);
      width.stop();
      radius.stop();
    };
  }, [open, geometry, width, radius]);

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

  const ariaLabel = inputProps?.['aria-label'] ?? (!isRenderable(label) || label === '' ? triggerLabel : undefined);

  return (
    <FieldSlot
      behavior={{
        onKeyDown: (event) => {
          if (
            event.defaultPrevented ||
            !open ||
            disabled ||
            event.key !== 'Escape' ||
            event.nativeEvent.isComposing ||
            event.nativeEvent.keyCode === 229
          )
            return;
          event.preventDefault();
          focusRequest.current = 'trigger';
          requestOpen(false);
        },
        onBlur: (event) => {
          if (event.defaultPrevented || !open) return;
          const root = event.currentTarget;
          const next = event.relatedTarget;
          if (next && !root.contains(next)) {
            focusRequest.current = null;
            requestOpen(false);
          } else if (!next) {
            queueMicrotask(() => {
              if (
                root.isConnected &&
                root.ownerDocument.hasFocus() &&
                !root.contains(root.ownerDocument.activeElement)
              ) {
                focusRequest.current = null;
                requestOpen(false);
              }
            });
          }
        },
      }}
      element="div"
      component={slots?.root ?? component}
      slotProps={slotProps?.root}
      root
      styles={[rootStyle, sizeStyles[size]]}
      sx={sx}
      {...rootProps}
      ref={mergedRootRef}
      className={className}
      dir={dir}
      data-ui="expanding-search"
      data-state={open ? 'open' : 'closed'}
      style={{ '--expanding-search-width': expandedWidth, ...style } as CSSProperties}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
    >
      <FieldSlot
        element="span"
        component={slots?.measure}
        slotProps={slotProps?.measure}
        ref={measureRef}
        aria-hidden
        styles={measureStyle}
      />
      <FieldSlot
        element="div"
        component={slots?.container}
        slotProps={slotProps?.container}
        ref={shellRef}
        styles={shellStyle}
        data-anchor={anchor}
        data-state={open ? 'open' : 'closed'}
      >
        <FieldSlot
          element="div"
          component={slots?.triggerWrapper}
          slotProps={slotProps?.triggerWrapper}
          hidden={open}
          inert={open}
          styles={triggerWrapStyle}
        >
          <Trigger
            {...slotProps?.trigger}
            ref={mergedTriggerRef}
            size={size}
            variant="outline"
            disabled={disabled}
            aria-label={triggerLabel}
            aria-expanded={open}
            aria-controls={regionId}
            css={[triggerStyle, slotProps?.trigger?.css]}
            onClick={(event) => {
              slotProps?.trigger?.onClick?.(event);
              if (event.defaultPrevented) return;
              focusRequest.current = 'input';
              requestOpen(true);
            }}
          >
            <FieldSlot
              element="span"
              component={slots?.triggerIcon}
              slotProps={slotProps?.triggerIcon}
              aria-hidden
              styles={iconStyle}
            >
              {searchIcon}
            </FieldSlot>
          </Trigger>
        </FieldSlot>
        <FieldSlot
          element="div"
          component={slots?.region}
          slotProps={slotProps?.region}
          id={regionId}
          aria-hidden={!open || undefined}
          inert={!open}
          style={{ visibility: open ? 'visible' : 'hidden' }}
        >
          <Field
            {...slotProps?.field}
            {...inputProps}
            ref={mergedInputRef}
            size={size}
            dir={dir}
            disabled={disabled}
            value={value}
            defaultValue={defaultValue}
            onValueChange={onValueChange}
            label={label}
            description={description}
            error={error}
            clearable={clearable}
            messages={messages}
            searchIcon={searchIcon}
            clearIcon={clearIcon}
            aria-label={ariaLabel}
            slots={{ ...slots, root: slots?.fieldRoot }}
            slotProps={{
              ...slotProps,
              ...slotProps?.field?.slotProps,
              root: slotProps?.field?.slotProps?.root ?? {
                className: slotProps?.root?.className,
                css: slotProps?.root?.css,
              },
              shell: {
                ...slotProps?.shell,
                ...slotProps?.field?.slotProps?.shell,
                css: [fieldShellStyle, slotProps?.shell?.css, slotProps?.field?.slotProps?.shell?.css],
              },
            }}
            onKeyDown={(event) => {
              inputProps?.onKeyDown?.(event);
              if (
                event.defaultPrevented ||
                disabled ||
                event.key !== 'Escape' ||
                event.nativeEvent.isComposing ||
                event.nativeEvent.keyCode === 229
              )
                return;
              event.preventDefault();
              focusRequest.current = 'trigger';
              requestOpen(false);
            }}
          />
        </FieldSlot>
      </FieldSlot>
    </FieldSlot>
  );
}
ExpandingSearch.displayName = 'ExpandingSearch';
