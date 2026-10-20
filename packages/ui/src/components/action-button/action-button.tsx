'use client';

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ComponentType,
  type ReactNode,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { animate, MotionConfig, motion, useMotionValue, useReducedMotion } from 'motion/react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { motionDurationMs } from '../../styling/motion-timings';
import { WithSx } from '../../styling/sx';
import { useControlledState } from '../../utils/use-controlled-state';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { Button, type ButtonProps } from '../button';
import { buttonBlockSizes } from '../button/button';
import { Spinner } from '../spinner';

export type ActionButtonValue = 'idle' | 'pending' | 'success' | 'error';
export type ActionButtonPartProps = ComponentPropsWithRef<'span'> & {
  sx?: Interpolation<Theme>;
};
export type ActionButtonRootProps = ComponentPropsWithRef<'button'> & {
  sx?: Interpolation<Theme>;
  /** Adds root identity tokens alongside `action-button`. */
  'data-ui'?: string;
};
export interface ActionButtonSlots {
  root?: ComponentType<ComponentPropsWithRef<'button'>>;
  icon?: ComponentType<ComponentPropsWithRef<'span'>>;
  label?: ComponentType<ComponentPropsWithRef<'span'>>;
  status?: ComponentType<ComponentPropsWithRef<'span'>>;
}
export interface ActionButtonProps extends Omit<
  ButtonProps,
  'children' | 'value' | 'defaultValue' | 'loading' | 'render'
> {
  /** Text shown while the action is idle. */
  label: string;
  /** Text shown and announced while the action is running. */
  pendingLabel: string;
  /** Text shown and announced after the action resolves. */
  successLabel: string;
  /** Text shown and announced after the action throws or rejects. */
  errorLabel: string;
  /** Runs on activation unless the click is prevented; overlapping runs are blocked. */
  onAction: () => void | Promise<void>;
  /** Receives the thrown or rejected error after requesting the error state. */
  onActionError?: (error: unknown) => void;
  /** Controls the displayed action state without starting an action. */
  value?: ActionButtonValue;
  /** Initial uncontrolled action state. Defaults to `idle`. */
  defaultValue?: ActionButtonValue;
  /** Requests an action state change, including the timed return to `idle`. */
  onValueChange?: (value: ActionButtonValue) => void;
  /** Success feedback delay in milliseconds; 0 retains the result. Defaults to 2400. */
  resetAfterMs?: number;
  /** Decorative icon shown after the action resolves. */
  successIcon?: ReactNode;
  /** Decorative icon shown after the action throws or rejects. */
  errorIcon?: ReactNode;
  /** Replaces the button root; `slots.root` takes precedence. */
  component?: ActionButtonSlots['root'];
  /** Replaces generated elements with components that forward supplied props and refs. */
  slots?: ActionButtonSlots;
  /** Supplies attributes, refs and `sx` to the generated elements. */
  slotProps?: {
    root?: ActionButtonRootProps;
    icon?: ActionButtonPartProps;
    label?: ActionButtonPartProps;
    status?: ActionButtonPartProps;
  };
  /** Adds root identity tokens alongside `action-button`. */
  'data-ui'?: string;
}

const DEFAULT_RESET_MS = 2400;
const WIDTH_SPRING = {
  type: 'spring',
  stiffness: 360,
  damping: 36,
  mass: 1,
} as const;
const rootStyle = css({
  maxInlineSize: '100%',
  whiteSpace: 'normal',
  blockSize: 'auto',
  paddingBlock: vars.space[2],
});
const contentStyle = css({
  display: 'inline-flex',
  minInlineSize: 0,
  maxInlineSize: '100%',
  alignItems: 'center',
  gap: vars.space[2],
});
const labelStyle = css({ overflowWrap: 'anywhere', minInlineSize: 0 });
const iconStyle = css({
  display: 'inline-flex',
  flexShrink: 0,
  '& svg': { inlineSize: '1em', blockSize: '1em' },
});
const heights = {
  sm: css({ minBlockSize: buttonBlockSizes.sm }),
  md: css({ minBlockSize: buttonBlockSizes.md }),
  lg: css({ minBlockSize: buttonBlockSizes.lg }),
};

function ActionButtonFace({ children, value }: { children: ReactNode; value: ActionButtonValue }) {
  const reduce = useReducedMotion();
  const element = useRef<HTMLSpanElement>(null);
  const width = useMotionValue<number | string>('auto');
  const previous = useRef<number | undefined>(undefined);
  useLayoutEffect(() => {
    const node = element.current;
    if (!node) return;
    let animation: ReturnType<typeof animate> | undefined;
    const measure = (spring: boolean) => {
      const frame = node.parentElement;
      if (!frame) return;
      const renderedWidth = frame.style.width;
      frame.style.width = 'auto';
      const next = node.getBoundingClientRect().width;
      frame.style.width = renderedWidth;
      if (next === previous.current) return;
      animation?.stop();
      if (previous.current !== undefined && spring && !reduce)
        animation = animate(width, next, WIDTH_SPRING);
      else width.set(next);
      previous.current = next;
    };
    measure(true);
    const Observer = node.ownerDocument.defaultView?.ResizeObserver;
    const observer = Observer ? new Observer(() => measure(false)) : undefined;
    observer?.observe(node);
    return () => {
      animation?.stop();
      observer?.disconnect();
    };
  }, [value, reduce, width]);
  return (
    <motion.span style={{ width, maxWidth: '100%', display: 'inline-flex' }}>
      <motion.span
        ref={element}
        data-action-face
        css={contentStyle}
        key={value}
        initial={reduce || previous.current === undefined ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduce ? 0 : motionDurationMs.base / 1000 }}
      >
        {children}
      </motion.span>
    </motion.span>
  );
}

export function ActionButton({
  label,
  pendingLabel,
  successLabel,
  errorLabel,
  onAction,
  onActionError,
  value,
  defaultValue = 'idle',
  onValueChange,
  resetAfterMs = DEFAULT_RESET_MS,
  successIcon,
  errorIcon,
  startIcon,
  endIcon,
  component,
  slots,
  slotProps,
  ref,
  className,
  style,
  sx,
  variant = 'solid',
  tone = 'accent',
  size = 'md',
  ...props
}: ActionButtonProps) {
  const [current = 'idle', request] = useControlledState(value, defaultValue, onValueChange);
  const operation = useRef<object | null>(null);
  const [inFlight, setInFlight] = useState(false);
  const latest = useRef({ request, onActionError });
  useLayoutEffect(() => {
    latest.current = { request, onActionError };
  });
  useEffect(
    () => () => {
      operation.current = null;
    },
    [],
  );
  const delay = Number.isFinite(resetAfterMs) && resetAfterMs > 0 ? resetAfterMs : 0;
  useEffect(() => {
    if (current !== 'success' || !delay || inFlight) return;
    const timer = setTimeout(() => latest.current.request('idle'), delay);
    return () => clearTimeout(timer);
  }, [current, delay, inFlight]);
  const {
    sx: rootCss,
    className: rootClass,
    style: rootInline,
    ref: rootRef,
    ...rootProps
  } = slotProps?.root ?? {};
  const merged = { ...props, ...rootProps };
  const mergedRef = useMergeRefs([ref, rootRef]);
  const Root = slots?.root ?? component ?? 'button';
  const Icon = slots?.icon ?? 'span';
  const Label = slots?.label ?? 'span';
  const Status = slots?.status ?? 'span';
  const { sx: iconCss, ...iconProps } = slotProps?.icon ?? {};
  const { sx: labelCss, ...labelProps } = slotProps?.label ?? {};
  const { sx: statusCss, ...statusProps } = slotProps?.status ?? {};
  const labels = {
    idle: label,
    pending: pendingLabel,
    success: successLabel,
    error: errorLabel,
  };
  const icons = {
    idle: startIcon,
    pending: <Spinner value="loading" decorative />,
    success: successIcon,
    error: errorIcon,
  };
  const marker = [
    ...new Set([
      'action-button',
      ...[props['data-ui'], rootProps['data-ui']].flatMap((x) => x?.split(/\s+/).filter(Boolean) ?? []),
    ]),
  ].join(' ');
  return (
    <MotionConfig reducedMotion="user">
      <Button
        {...merged}
        ref={mergedRef}
        variant={variant}
        tone={tone}
        size={size}
        className={[className, rootClass].filter(Boolean).join(' ')}
        style={{ ...style, ...rootInline }}
        data-ui={marker}
        aria-label={
          merged['aria-label'] ??
          (merged['aria-labelledby']
            ? undefined
            : current === 'idle'
              ? label
              : `${label}: ${labels[current]}`)
        }
        aria-busy={current === 'pending' ? true : merged['aria-busy']}
        aria-disabled={current === 'pending' ? true : merged['aria-disabled']}
        onClick={async (event) => {
          if (operation.current) {
            event.preventDefault();
            return;
          }
          merged.onClick?.(event);
          if (event.defaultPrevented) return;
          const token = {};
          operation.current = token;
          setInFlight(true);
          request('pending');
          try {
            await onAction();
            if (operation.current === token) latest.current.request('success');
          } catch (error) {
            if (operation.current === token) {
              latest.current.request('error');
              latest.current.onActionError?.(error);
            }
          } finally {
            if (operation.current === token) {
              operation.current = null;
              setInFlight(false);
            }
          }
        }}
        render={(buttonProps) => (
          <WithSx
            className={buttonProps.className}
            sx={[rootStyle, heights[size], rootCss, sx]}
          >
            {(resolved) => (
              <Root
                {...buttonProps}
                ref={mergedRef}
                type={merged.type ?? 'button'}
                disabled={merged.disabled}
                data-state={current}
                className={resolved}
              />
            )}
          </WithSx>
        )}
      >
        <ActionButtonFace value={current}>
          {icons[current] != null && (
            <Icon {...iconProps} css={[iconStyle, iconCss]} data-ui="action-button-icon" aria-hidden="true">
              {icons[current]}
            </Icon>
          )}
          <Label
            {...labelProps}
            css={[labelStyle, labelCss]}
            data-ui="action-button-label"
            aria-hidden="true"
          >
            {labels[current]}
          </Label>
          {endIcon != null && (
            <span css={iconStyle} aria-hidden="true">
              {endIcon}
            </span>
          )}
        </ActionButtonFace>
      </Button>
      <Status
        {...statusProps}
        css={[visuallyHiddenStyle, statusCss]}
        data-ui="action-button-status"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {current === 'idle' ? '' : labels[current]}
      </Status>
    </MotionConfig>
  );
}
ActionButton.displayName = 'ActionButton';
