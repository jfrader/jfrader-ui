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
  type CSSProperties,
  type ComponentPropsWithRef,
  type ComponentType,
  type MouseEventHandler,
  type ReactNode,
} from 'react';
import { useMergeRefs, type Placement } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { controlBlockSize, controlSizeStyles, controlTouchTargetStyles } from '../../styling/control-size';
import { css, keyframes } from '../../styling/css';
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

const tokens = (...values: Array<unknown>): string | undefined => {
  const list = [...new Set(values.flatMap((v) => (typeof v === 'string' ? v.split(/\s+/) : [])))].filter(Boolean);
  return list.join(' ') || undefined;
};

const FAMILY = 'SplitButton';

export type SplitButtonItemTone = MenuItemTone;

export type SplitButtonActionRecord = Readonly<{
  type?: 'item';
  key?: string;
  label: ReactNode;
  onSelect?: () => void;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  tone?: SplitButtonItemTone;
}>;

export type SplitButtonSeparatorRecord = Readonly<{
  type: 'separator';
  key?: string;
  label?: never;
  onSelect?: never;
  onClick?: never;
  disabled?: never;
  tone?: never;
}>;

export type SplitButtonItemRecord = SplitButtonActionRecord | SplitButtonSeparatorRecord;

type SplitButtonTriggerBaseProps = Omit<
  ButtonProps,
  'render' | 'variant' | 'tone' | 'size' | 'loading' | 'startIcon' | 'endIcon' | 'aria-haspopup' | 'aria-expanded' | 'aria-controls'
>;

export interface SplitButtonSlots {
  /** Container element wrapping the primary action and menu trigger. */
  root?: ComponentType<ComponentPropsWithRef<'div'>>;
  /** Primary action button on the split button. Default: `SplitButton.Action`. */
  action?: ComponentType<SplitButtonActionProps>;
  /** Menu disclosure button opening the dropdown menu. Default: `SplitButton.Trigger`. */
  trigger?: ComponentType<SplitButtonTriggerProps>;
  /** Floating dropdown menu panel holding menu items. Default: `SplitButton.Content`. */
  content?: ComponentType<SplitButtonContentProps>;
  /** Selectable menu item within the dropdown menu. Default: `SplitButton.Item`. */
  item?: ComponentType<SplitButtonItemProps>;
  /** Decorative divider line between menu items. Default: `SplitButton.Separator`. */
  separator?: ComponentType<SplitButtonSeparatorProps>;
}

export interface SplitButtonSlotProps {
  /** Container element wrapping the primary action and menu trigger. */
  root?: Omit<ComponentPropsWithRef<'div'>, 'children'> &
    SxProps & {

      [attribute: `data-${string}`]: unknown;
    };
  /** Primary action button on the split button. Default: `SplitButton.Action`. */
  action?: Partial<Omit<SplitButtonActionProps, 'children' | 'onClick' | 'disabled'>>;
  /** Menu disclosure button opening the dropdown menu. Default: `SplitButton.Trigger`. */
  trigger?: Partial<Omit<SplitButtonTriggerBaseProps, 'children' | 'disabled'>> & {
    'aria-label'?: string;
    'aria-labelledby'?: string;
  };
  /** Floating dropdown menu panel holding menu items. Default: `SplitButton.Content`. */
  content?: Partial<Omit<SplitButtonContentProps, 'children'>>;
  /** Selectable menu item within the dropdown menu. Default: `SplitButton.Item`. */
  item?: Partial<Omit<SplitButtonItemProps, 'children' | 'onSelect' | 'disabled'>>;
  /** Decorative divider line between menu items. Default: `SplitButton.Separator`. */
  separator?: Partial<SplitButtonSeparatorProps>;
}

export interface SplitButtonBaseProps extends Omit<ComponentPropsWithRef<'div'>, 'role' | 'onClick' | 'children'>, SxProps {
  /** Appearance of the Action; the Trigger uses the matching subdued fill. */
  variant?: ButtonVariant;
  /** Set the primary action and trigger color tone. Defaults to `accent`. */
  tone?: ButtonTone;
  /** Set both buttons' sizing. Defaults to `md`. */
  size?: ButtonSize;
  /** Disables Action, Trigger and items. Requests closure once if the menu is open. */
  disabled?: boolean;
  /** Control whether the alternative-action menu is open. */
  open?: boolean;
  /** Open the uncontrolled menu initially. Defaults to `false`. */
  defaultOpen?: boolean;
  /** Receive requests to open or close the menu. */
  onOpenChange?: (open: boolean) => void;
  /** Menu placement relative to the Trigger; `start`/`end` follow the group's direction. */
  placement?: Placement;
}

export interface SplitButtonComposedProps extends SplitButtonBaseProps {
  /** Compose the action, trigger, and menu using `SplitButton` parts. */
  children?: ReactNode;
  label?: never;
  onClick?: ComponentPropsWithRef<'div'>['onClick'];
  menuLabel?: never;
  items?: never;
  component?: never;
  slots?: never;
  slotProps?: never;
}

export interface SplitButtonShorthandProps extends SplitButtonBaseProps {
  /** Name the primary action. */
  label: ReactNode;
  /** Called only when the primary action is activated; does NOT bubble from or attach to the root. */
  onClick?: MouseEventHandler<HTMLButtonElement>;
  /** Accessible name for the dropdown trigger. */
  menuLabel: string;
  /** Alternative actions and separators rendered in the dropdown menu. */
  items: readonly SplitButtonItemRecord[];
  children?: never;
  /** Replace the wrapper `div`; takes precedence over `slots.root`. */
  component?: SplitButtonSlots['root'];
  /** Replace generated parts with components that forward props and ref. */
  slots?: SplitButtonSlots;
  /** Pass props and `sx` to generated buttons, menu parts, and wrapper. */
  slotProps?: SplitButtonSlotProps;
}

export type SplitButtonProps = SplitButtonComposedProps | SplitButtonShorthandProps;

export interface SplitButtonActionProps extends Omit<ButtonProps, 'render'> {
  /**
   * Labels Action may show. Reserves the width of the longest label; changed labels fade in.
   */
  reserveLabels?: readonly string[];
}

  /** Trigger has no text. Supply a translated `aria-label` or `aria-labelledby`. */
export type SplitButtonTriggerProps = SplitButtonTriggerBaseProps &
  ({ 'aria-label': string } | { 'aria-labelledby': string });

export interface SplitButtonContentProps extends Omit<MenuContentProps, 'role'> {}

export interface SplitButtonItemProps extends MenuItemProps {
  /** Set the menu item's color tone. Defaults to `neutral`. */
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
  /** Label ids for Trigger and the menu. Referencing Trigger alone does not follow its `aria-labelledby`. */
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

const actionSizeStyles = {
  sm: css(controlSizeStyles.sm, controlTouchTargetStyles.sm),
  md: css(controlSizeStyles.md, controlTouchTargetStyles.md),
  lg: css(controlSizeStyles.lg, controlTouchTargetStyles.lg),
};

const triggerSizeStyles = {
  sm: css(actionSizeStyles.sm, { inlineSize: controlBlockSize.sm }),
  md: css(actionSizeStyles.md, { inlineSize: controlBlockSize.md }),
  lg: css(actionSizeStyles.lg, { inlineSize: controlBlockSize.lg }),
};

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
  style,
  label,
  onClick,
  menuLabel,
  items,
  children,
  component,
  slots,
  slotProps,
  ...rest
}: SplitButtonProps) {
  const isShorthandMode = items !== undefined;
  const Root = component ?? slots?.root ?? 'div';
  const Action = slots?.action ?? SplitButtonAction;
  const Trigger = slots?.trigger ?? SplitButtonTrigger;
  const Content = slots?.content ?? SplitButtonContent;
  const Item = slots?.item ?? SplitButtonItem;
  const Separator = slots?.separator ?? SplitButtonSeparator;

  const [open = false, requestOpenChange] = useControlledState<boolean>(openProp, defaultOpen, onOpenChange);
  const groupRef = useRef<HTMLDivElement>(null);
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

  const {
    className: rootSlotClassName,
    style: rootSlotStyle,
    sx: rootSlotSx,
    ref: rootSlotRef,
    'data-ui': rootSlotDataUi,
    onClick: rootSlotOnClick,
    ...rootSlotRest
  } = slotProps?.root ?? {};

  const mergedRef = useMergeRefs([groupRef, ref, rootSlotRef]);
  const mergedClassName = [rootSlotClassName, className].filter(Boolean).join(' ') || undefined;
  const mergedStyle = { ...style, ...rootSlotStyle };

  const rootOnClick = isShorthandMode
    ? rootSlotOnClick
    : (rootSlotOnClick ?? (onClick as ComponentPropsWithRef<'div'>['onClick']));

  return (
    <Menu open={open} onOpenChange={handleOpenChange} placement={placement}>
      <SplitButtonContext.Provider value={context}>
        <WithSx className={mergedClassName} styles={[rootStyle, rootSlotSx]} sx={sx}>
          {(resolvedClassName) => (
            <Root
              {...rest}
              {...rootSlotRest}
              ref={mergedRef}
              role="group"
              data-ui={tokens('split-button', rootSlotDataUi) ?? 'split-button'}
              style={mergedStyle}
              className={resolvedClassName}
              onClick={rootOnClick}
            >
              {isShorthandMode ? (
                <>
                  <Action
                    {...slotProps?.action}
                    disabled={disabled}
                    onClick={onClick as MouseEventHandler<HTMLButtonElement> | undefined}
                  >
                    {label}
                  </Action>
                  <Trigger
                    {...slotProps?.trigger}
                    disabled={disabled}
                    aria-label={slotProps?.trigger?.['aria-label'] ?? menuLabel}
                  />
                  <Content {...slotProps?.content}>
                    {items.map((item, index) => {
                      const key = item.key ?? (item.type === 'separator' ? `sep-${index}` : (typeof item.label === 'string' ? item.label : index));
                      if (item.type === 'separator') {
                        return (
                          <Separator
                            key={key}
                            {...slotProps?.separator}
                          />
                        );
                      }
                      return (
                        <Item
                          key={key}
                          {...slotProps?.item}
                          disabled={item.disabled}
                          tone={item.tone ?? slotProps?.item?.tone}
                          onSelect={item.onSelect}
                          onClick={item.onClick ?? slotProps?.item?.onClick}
                        >
                          {item.label}
                        </Item>
                      );
                    })}
                  </Content>
                </>
              ) : (
                children
              )}
            </Root>
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

/** Offer an alternate action in the split button's menu. */
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
