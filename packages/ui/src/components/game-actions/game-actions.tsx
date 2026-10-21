'use client';

import {
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ComponentType,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { moveRovingFocus, type OwnedItemsQuery } from '../../utils/roving-focus';
import { Button, type ButtonProps, type ButtonSize, type ButtonTone, type ButtonVariant } from '../button';
import { buttonBlockSizes } from '../button/button';

export interface GameActionItem {
  /** Unique key for the action. */
  key: string;
  /** Action label displayed to the player. */
  label: ReactNode;
  /** Whether the action is unavailable. Rendered with honest aria-disabled. */
  disabled?: boolean;
  /** Whether the action is executing. Shows a spinner and aria-busy. */
  pending?: boolean;
  /** Visual tone of the action. */
  tone?: ButtonTone;
  /** Visual variant override for this action. */
  variant?: ButtonVariant;
  /** Leading icon before label. */
  startIcon?: ReactNode;
  /** Trailing icon after label. */
  endIcon?: ReactNode;
  /** Accessible name override. */
  'aria-label'?: string;
  /** Optional description id relationship. */
  'aria-describedby'?: string;
  /** Callback fired when the action is chosen. */
  onSelect?: () => void;
}

export type GameActionsOrientation = 'horizontal' | 'vertical';

export interface GameActionsSlots {
  /** Replaces the root toolbar element. */
  root?: ComponentType<ComponentPropsWithRef<'div'>>;
  /** Replaces the action button element. */
  action?: ComponentType<ButtonProps>;
}

export interface GameActionsSlotProps {
  /** Props passed to the root toolbar element. */
  root?: Omit<ComponentPropsWithRef<'div'>, 'children'> &
    SxProps & {

      'data-ui'?: string;
      [attribute: `data-${string}`]: unknown;
    };
  /** Props passed to each action button. */
  action?: Partial<Omit<ButtonProps, 'children'>> & {

    'data-ui'?: string;
    [attribute: `data-${string}`]: unknown;
  };
}

export interface GameActionsProps
  extends Omit<ComponentPropsWithRef<'div'>, 'children'>,
    SxProps {
  /** Add space-separated root markers alongside `game-actions`. */
  'data-ui'?: string;
  /** Actions available in the toolbar. */
  actions: readonly GameActionItem[];
  /** Orientation of the toolbar layout and roving arrow keys. Defaults to 'horizontal'. */
  orientation?: GameActionsOrientation;
  /** Size for all actions in the toolbar. Defaults to 'md'. */
  size?: ButtonSize;
  /** Visual variant for all actions. Defaults to 'solid'. */
  variant?: ButtonVariant;
  /** Visual tone fallback for actions that do not set their own tone. Defaults to 'neutral'. */
  tone?: ButtonTone;
  /** Accessible label for the toolbar, in the page's language. */
  label: string;
  /** Disables the entire toolbar. Actions receive aria-disabled and cannot be activated. */
  disabled?: boolean;
  /** Sugar for slots.root. Replace the root element. */
  component?: GameActionsSlots['root'];
  /** Replaces internal parts. */
  slots?: GameActionsSlots;
  /** Props forwarded to internal parts. */
  slotProps?: GameActionsSlotProps;
}

const OWNER = '[data-ui~="game-actions"]';
const ACTION_QUERY: OwnedItemsQuery = {
  itemSelector: '[data-ui~="game-actions-action"]',
  ownerSelector: OWNER,
};

const rootBaseStyle = css({
  label: 'game-actions',
  display: 'inline-flex',
  alignItems: 'center',
  gap: vars.space[2],
  padding: vars.space[1],
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.lg,
  backgroundColor: vars.color.surfaceInset,
  boxSizing: 'border-box',
  maxInlineSize: '100%',
  transitionProperty: 'border-color, background-color',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  [REDUCED_MOTION]: {
    transitionDuration: '0s',
  },
  '&[data-orientation="horizontal"]': {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  '&[data-orientation="vertical"]': {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  '&[data-disabled="true"]': {
    opacity: 0.7,
  },
});

const actionStyle = css({
  minInlineSize: 0,
  maxInlineSize: '100%',
  blockSize: 'auto',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
});

const actionSizeStyles = {
  sm: css({ minBlockSize: buttonBlockSizes.sm }),
  md: css({ minBlockSize: buttonBlockSizes.md }),
  lg: css({ minBlockSize: buttonBlockSizes.lg }),
} satisfies Record<ButtonSize, ReturnType<typeof css>>;

function DefaultAction(props: ButtonProps) {
  return <Button {...props} render={(buttonProps) => <button {...buttonProps} />} />;
}

export function GameActions({
  ref,
  actions,
  orientation = 'horizontal',
  size = 'md',
  variant = 'solid',
  tone = 'neutral',
  label,
  'aria-label': ariaLabelProp,
  'aria-labelledby': ariaLabelledByProp,
  disabled = false,
  component,
  slots,
  slotProps,
  className,
  style,
  sx,
  onKeyDown,
  ...rest
}: GameActionsProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);

  const Root = slots?.root ?? component ?? 'div';
  const ActionComponent = slots?.action ?? DefaultAction;

  const {
    className: rootSlotClassName,
    style: rootSlotStyle,
    sx: rootSlotSx,
    ref: rootSlotRef,
    onKeyDown: rootSlotOnKeyDown,
    ...rootSlotRest
  } = slotProps?.root ?? {};

  const mergedRef = useMergeRefs([rootRef, ref, rootSlotRef]);
  const mergedStyle = { ...style, ...rootSlotStyle };
  const mergedClassName = [rootSlotClassName, className].filter(Boolean).join(' ') || undefined;

  const rootMarker = [
    ...new Set(
      ['game-actions', rest['data-ui'], rootSlotRest['data-ui']]
        .flatMap((value) => (typeof value === 'string' ? value.split(/\s+/).filter(Boolean) : [])),
    ),
  ].join(' ');

  const defaultKey =
    (actions.find((action) => !disabled && !action.disabled && !action.pending) ?? actions[0])?.key ??
    null;
  const effectiveFocusedKey =
    focusedKey !== null && actions.some((action) => action.key === focusedKey) ? focusedKey : defaultKey;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    rootSlotOnKeyDown?.(event);
    onKeyDown?.(event);
    if (event.defaultPrevented || !rootRef.current) return;
    moveRovingFocus(event, rootRef.current, orientation, ACTION_QUERY);
  };

  const {
    className: actionSlotClassName,
    style: actionSlotStyle,
    sx: actionSlotSx,
    onClick: actionSlotOnClick,
    onFocus: actionSlotOnFocus,
    ...actionSlotRest
  } = slotProps?.action ?? {};

  const accessibleName = label ?? ariaLabelProp;

  return (
    <WithSx
      className={mergedClassName}
      styles={[rootBaseStyle, rootSlotSx]}
      sx={sx}
    >
      {(resolvedClassName) => (
        <Root
          {...rest}
          {...rootSlotRest}
          ref={mergedRef}
          role="toolbar"
          aria-label={ariaLabelledByProp ? undefined : accessibleName}
          aria-labelledby={ariaLabelledByProp}
          aria-orientation={orientation}
          aria-disabled={disabled ? true : undefined}
          data-ui={rootMarker}
          data-orientation={orientation}
          data-disabled={disabled ? 'true' : undefined}
          onKeyDown={handleKeyDown}
          className={resolvedClassName}
          style={mergedStyle}
        >
          {actions.map((action) => {
            const isActionDisabled = Boolean(disabled || action.disabled || action.pending);
            const isTabStop = action.key === effectiveFocusedKey;
            const actionMarker = [
              ...new Set(
                ['game-actions-action', actionSlotRest['data-ui']]
                  .flatMap((value) => (typeof value === 'string' ? value.split(/\s+/).filter(Boolean) : [])),
              ),
            ].join(' ');

            const handleActionClick = (event: MouseEvent<HTMLButtonElement>) => {
              actionSlotOnClick?.(event);
              if (!event.defaultPrevented && !isActionDisabled) {
                action.onSelect?.();
              }
            };

            const handleActionFocus = (event: FocusEvent<HTMLButtonElement>) => {
              actionSlotOnFocus?.(event);
              if (!event.defaultPrevented) {
                setFocusedKey(action.key);
              }
            };

            return (
              <ActionComponent
                {...actionSlotRest}
                key={action.key}
                data-ui={actionMarker}
                data-action-key={action.key}
                data-state={action.pending ? 'pending' : isActionDisabled ? 'disabled' : 'ready'}
                variant={action.variant ?? variant}
                tone={action.tone ?? tone}
                size={size}
                loading={action.pending}
                aria-disabled={isActionDisabled ? true : undefined}
                tabIndex={isTabStop ? 0 : -1}
                startIcon={action.startIcon}
                endIcon={action.endIcon}
                aria-label={action['aria-label']}
                aria-describedby={action['aria-describedby']}
                className={actionSlotClassName}
                style={actionSlotStyle}
                sx={[actionStyle, actionSizeStyles[size], actionSlotSx]}
                onClick={handleActionClick}
                onFocus={handleActionFocus}
              >
                {action.label}
              </ActionComponent>
            );
          })}
        </Root>
      )}
    </WithSx>
  );
}

GameActions.displayName = 'GameActions';
