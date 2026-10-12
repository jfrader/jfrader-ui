'use client';

// SplitButton: one default action joined to a menu of close alternatives. Two native buttons sit
// in a labelled role="group" (two controls are not an APG toolbar): the Action is a plain APG
// button, the Trigger is an APG menu button driving the shared menu controller.
// Keyboard map: Tab/Shift+Tab visit Action then Trigger. Enter/Space on the Action activate it
// once (loading blocks and keeps focus). On the Trigger, Enter/Space/ArrowDown open on the first
// enabled item and ArrowUp on the last; inside the menu the Menu contract applies (arrows wrap
// and skip disabled items, Home/End, 500ms typeahead, Enter/Space select, Escape and accepted
// selection return focus to the Trigger, Tab out closes without moving focus).
// The Trigger never runs the main action and selecting an alternative never replaces it.
// Consumer handlers run first; their preventDefault() vetoes the matching internal request.
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ReactNode,
} from 'react';
import { useMergeRefs, type Placement } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css, keyframes, type SerializedStyles } from '../../styling/css';
import { listboxSurfaceStyle } from '../../styling/listbox-style';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import { Button, type ButtonProps, type ButtonSize, type ButtonTone, type ButtonVariant } from '../button';
import {
  Menu,
  MenuContentPart,
  MenuItemPart,
  MenuSeparatorPart,
  MenuTriggerPart,
  menuItemStyles,
  menuItemToneStyles,
  menuSeparatorStyles,
  type MenuItemTone,
  type MenuContentProps,
  type MenuItemProps,
  type MenuSeparatorProps,
} from '../menu/menu';

const FAMILY = 'SplitButton';

export type SplitButtonItemTone = MenuItemTone;

export interface SplitButtonProps extends Omit<ComponentPropsWithRef<'div'>, 'role'>, SxProps {
  /** Appearance of the Action; the Trigger uses the matching subdued fill. */
  variant?: ButtonVariant;
  tone?: ButtonTone;
  size?: ButtonSize;
  /** Disables Action, Trigger and items, and asks once for an open menu to close. */
  disabled?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Menu placement relative to the Trigger; `start`/`end` follow the group's direction. */
  placement?: Placement;
  children?: ReactNode;
}

export interface SplitButtonActionProps extends Omit<ButtonProps, 'render'> {
  /**
   * Labels the Action may show. They share one grid cell so the Action keeps the width of the
   * longest one while its label changes; a label swap fades in.
   */
  reserveLabels?: readonly string[];
}

type SplitButtonTriggerBaseProps = Omit<
  ButtonProps,
  'render' | 'variant' | 'tone' | 'size' | 'loading' | 'startIcon' | 'endIcon' | 'aria-haspopup' | 'aria-expanded' | 'aria-controls'
>;

/** The Trigger has no visible text: it needs a localized `aria-label` or `aria-labelledby`. */
export type SplitButtonTriggerProps = SplitButtonTriggerBaseProps &
  ({ 'aria-label': string } | { 'aria-labelledby': string });

export interface SplitButtonContentProps extends Omit<MenuContentProps, 'role'> {}

export interface SplitButtonItemProps extends MenuItemProps {
  tone?: SplitButtonItemTone;
}

export interface SplitButtonSeparatorProps extends MenuSeparatorProps {}

type Direction = 'ltr' | 'rtl';

interface SplitButtonContextValue {
  variant: ButtonVariant;
  tone: ButtonTone;
  size: ButtonSize;
  disabled: boolean;
  direction: Direction | undefined;
  /** The Trigger's consumer label ids; the menu is named by them (accname does not follow
   * the Trigger's own aria-labelledby when the menu references the Trigger). */
  triggerLabelledBy: string | undefined;
  setTriggerLabelledBy: (ids: string | undefined) => void;
}

const SplitButtonContext = createContext<SplitButtonContextValue | null>(null);

function useSplitButtonContext(part: string): SplitButtonContextValue {
  const context = useContext(SplitButtonContext);
  if (!context) throw new Error(`${FAMILY}.${part} must be rendered inside <${FAMILY}>.`);
  return context;
}

// Only the Action carries solid weight; the disclosure stays subordinate.
const TRIGGER_VARIANT: Record<ButtonVariant, ButtonVariant> = {
  solid: 'soft',
  soft: 'soft',
  outline: 'outline',
  ghost: 'ghost',
};

const SIZE_PX: Record<ButtonSize, string> = { sm: '32px', md: '40px', lg: '48px' };

const rootStyle = css({
  label: 'split-button',
  display: 'inline-flex',
  alignItems: 'stretch',
  maxInlineSize: '100%',
  verticalAlign: 'middle',
  isolation: 'isolate',
});

// The focused half rises above its neighbour so the outset ring is never painted over.
const raisedFocus = { '&:focus-visible': { position: 'relative', zIndex: 1 } } as const;

const actionStyle = css({
  label: 'split-button-action',
  flex: '0 1 auto',
  minInlineSize: 0,
  blockSize: 'auto',
  paddingBlock: vars.space[1],
  whiteSpace: 'normal',
  textAlign: 'center',
  borderStartEndRadius: 0,
  borderEndEndRadius: 0,
  borderInlineEndWidth: 0,
  ...raisedFocus,
  [FORCED_COLORS]: {
    borderColor: 'ButtonText',
  },
});

const triggerStyle = css({
  label: 'split-button-trigger',
  flexShrink: 0,
  blockSize: 'auto',
  paddingInline: 0,
  borderStartStartRadius: 0,
  borderEndStartRadius: 0,
  borderInlineStartColor: vars.color.borderControl,
  ...raisedFocus,
  [FORCED_COLORS]: {
    borderColor: 'ButtonText',
  },
});

const actionSizeStyles = Object.fromEntries(
  Object.entries(SIZE_PX).map(([size, px]) => [size, css({ minBlockSize: px })]),
) as Record<ButtonSize, SerializedStyles>;

const triggerSizeStyles = Object.fromEntries(
  Object.entries(SIZE_PX).map(([size, px]) => [size, css({ minBlockSize: px, inlineSize: px })]),
) as Record<ButtonSize, SerializedStyles>;

const chevronStyle = css({
  display: 'inline-flex',
  transitionProperty: 'transform',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '& svg': { inlineSize: '1em', blockSize: '1em' },
  '[aria-expanded="true"] > &': {
    transform: 'rotate(180deg)',
  },
  [REDUCED_MOTION]: {
    transitionDuration: '0s',
    '[aria-expanded="true"] > &': {
      transform: 'none',
    },
  },
  [FORCED_COLORS]: {
    color: 'ButtonText',
  },
});

const labelFadeIn = keyframes({
  from: { opacity: 0 },
  to: { opacity: 1 },
});

const reservedGridStyle = css({
  display: 'inline-grid',
  justifyItems: 'center',
  '& > *': { gridArea: '1 / 1' },
});

const reservedLabelStyle = css({
  visibility: 'hidden',
});

const liveLabelStyle = css({
  '&[data-swapped]': {
    animation: `${labelFadeIn} ${vars.motion.duration.base} ${vars.motion.easeStandard}`,
  },
  [REDUCED_MOTION]: {
    '&[data-swapped]': { animation: 'none' },
  },
});

const chevron = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 6l4 4 4-4" />
  </svg>
);

function SplitButtonRoot({
  ref,
  variant = 'solid',
  tone = 'accent',
  size = 'md',
  disabled = false,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  placement = 'bottom-end',
  className,
  sx,
  children,
  ...rest
}: SplitButtonProps) {
  const [open = false, requestOpenChange] = useControlledState<boolean>(openProp, defaultOpen, onOpenChange);
  const groupRef = useRef<HTMLDivElement>(null);
  const mergedRef = useMergeRefs([groupRef, ref]);
  const [direction, setDirection] = useState<Direction>();
  const [triggerLabelledBy, setTriggerLabelledBy] = useState<string>();
  const closeRequestedRef = useRef(false);

  // The menu is portaled out of the group, so it takes the group's effective direction (text
  // direction and start/end alignment) instead of the portal host's.
  useLayoutEffect(() => {
    if (groupRef.current) setDirection(getComputedStyle(groupRef.current).direction === 'rtl' ? 'rtl' : 'ltr');
  }, [open]);

  // Disabling is a prop change, not an interaction: an open menu is asked to close once, and a
  // controlled parent that keeps it open is not asked again while the pair stays disabled.
  useEffect(() => {
    if (!disabled) {
      closeRequestedRef.current = false;
      return;
    }
    if (open && !closeRequestedRef.current) {
      closeRequestedRef.current = true;
      requestOpenChange(false);
    }
  }, [disabled, open, requestOpenChange]);

  const handleOpenChange = (next: boolean) => {
    if (next && disabled) return;
    requestOpenChange(next);
  };

  const context = useMemo(
    () => ({ variant, tone, size, disabled, direction, triggerLabelledBy, setTriggerLabelledBy }),
    [variant, tone, size, disabled, direction, triggerLabelledBy],
  );

  return (
    <Menu open={open} onOpenChange={handleOpenChange} placement={placement}>
      <SplitButtonContext.Provider value={context}>
        <WithSx className={className} styles={rootStyle} sx={sx}>
          {(className) => (
            <div {...rest} ref={mergedRef} role="group" data-ui="split-button" className={className}>
              {children}
            </div>
          )}
        </WithSx>
      </SplitButtonContext.Provider>
    </Menu>
  );
}

SplitButtonRoot.displayName = 'SplitButton';

const labelKeyOf = (label: ReactNode) =>
  typeof label === 'string' || typeof label === 'number' ? String(label) : undefined;

function ActionLabel({ reserveLabels, children }: { reserveLabels: readonly string[]; children: ReactNode }) {
  const key = labelKeyOf(children);
  const [previousKey, setPreviousKey] = useState(key);
  const [swapped, setSwapped] = useState(false);
  if (key !== previousKey) {
    setPreviousKey(key);
    setSwapped(true);
  }

  return (
    <span css={reservedGridStyle} data-ui="split-button-label">
      {reserveLabels.map((label) => (
        <span key={label} css={reservedLabelStyle} aria-hidden>
          {label}
        </span>
      ))}
      <span key={key} css={liveLabelStyle} data-swapped={swapped || undefined}>
        {children}
      </span>
    </span>
  );
}

function SplitButtonAction({
  ref,
  variant,
  tone,
  size,
  disabled = false,
  reserveLabels,
  children,
  className,
  sx,
  ...rest
}: SplitButtonActionProps) {
  const context = useSplitButtonContext('Action');
  const isDisabled = context.disabled || disabled;
  const resolvedSize = size ?? context.size;

  return (
    <Button
      {...rest}
      ref={ref}
      variant={variant ?? context.variant}
      tone={tone ?? context.tone}
      size={resolvedSize}
      disabled={isDisabled}
      data-ui="split-button-action"
      css={[actionStyle, actionSizeStyles[resolvedSize]]}
      className={className}
      sx={sx}
      render={({ 'data-ui': marker, ...props }) => (
        <button {...props} type={props.type ?? 'button'} data-ui={marker} disabled={isDisabled} />
      )}
    >
      {reserveLabels !== undefined && reserveLabels.length > 0 ? (
        <ActionLabel reserveLabels={reserveLabels}>{children}</ActionLabel>
      ) : (
        children
      )}
    </Button>
  );
}

SplitButtonAction.displayName = 'SplitButton.Action';

function SplitButtonTrigger({ ref, disabled = false, children = chevron, className, sx, ...rest }: SplitButtonTriggerProps) {
  const context = useSplitButtonContext('Trigger');
  const isDisabled = context.disabled || disabled;
  const labelledBy = 'aria-labelledby' in rest ? rest['aria-labelledby'] : undefined;
  const { setTriggerLabelledBy } = context;

  useLayoutEffect(() => {
    setTriggerLabelledBy(labelledBy);
    return () => setTriggerLabelledBy(undefined);
  }, [labelledBy, setTriggerLabelledBy]);

  return (
    <Button
      {...rest}
      ref={ref}
      variant={TRIGGER_VARIANT[context.variant]}
      tone={context.tone}
      size={context.size}
      disabled={isDisabled}
      data-ui="split-button-trigger"
      css={[triggerStyle, triggerSizeStyles[context.size]]}
      className={className}
      sx={sx}
      render={({ 'data-ui': marker, ref: renderRef, ...props }) => (
        <MenuTriggerPart
          {...props}
          ref={renderRef}
          type="button"
          disabled={isDisabled}
          family={FAMILY}
          marker={marker}
        />
      )}
    >
      {isRenderable(children) && children !== '' && (
        <span css={chevronStyle} aria-hidden>
          {children}
        </span>
      )}
    </Button>
  );
}

SplitButtonTrigger.displayName = 'SplitButton.Trigger';

function SplitButtonContent({ dir, 'aria-labelledby': ariaLabelledBy, ...props }: SplitButtonContentProps) {
  const { direction, triggerLabelledBy } = useSplitButtonContext('Content');
  const labelledBy = [ariaLabelledBy, props['aria-label'] === undefined ? triggerLabelledBy : undefined]
    .filter(Boolean)
    .join(' ');
  return (
    <MenuContentPart
      {...props}
      aria-labelledby={labelledBy || undefined}
      dir={dir ?? direction}
      family={FAMILY}
      marker="split-button-content"
      styles={listboxSurfaceStyle}
    />
  );
}

SplitButtonContent.displayName = 'SplitButton.Content';

function SplitButtonItem({ tone = 'neutral', disabled = false, ...props }: SplitButtonItemProps) {
  const context = useSplitButtonContext('Item');
  return (
    <MenuItemPart
      {...props}
      disabled={context.disabled || disabled}
      family={FAMILY}
      marker="split-button-item"
      styles={[menuItemStyles, menuItemToneStyles[tone]]}
    />
  );
}

SplitButtonItem.displayName = 'SplitButton.Item';

function SplitButtonSeparator(props: SplitButtonSeparatorProps) {
  useSplitButtonContext('Separator');
  return <MenuSeparatorPart {...props} marker="split-button-separator" styles={menuSeparatorStyles} />;
}

SplitButtonSeparator.displayName = 'SplitButton.Separator';

export const SplitButton = Object.assign(SplitButtonRoot, {
  Action: SplitButtonAction,
  Trigger: SplitButtonTrigger,
  Content: SplitButtonContent,
  Item: SplitButtonItem,
  Separator: SplitButtonSeparator,
});
