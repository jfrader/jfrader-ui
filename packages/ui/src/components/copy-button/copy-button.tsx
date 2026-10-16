'use client';

// APG pattern: button. Enter and Space write `text` to the clipboard once; the button keeps a
// stable accessible name (`label`) while the visible face and a polite status region report the
// result. A copy in flight is a lock: further activations are inert until it settles, and the
// pending face keeps focus through aria-disabled + aria-busy instead of the disabled attribute.
//
// The write happens inside the activation handler (no permission preflight), so the browser sees
// the user gesture. A missing Clipboard API (insecure context, old browser) and a rejected or
// throwing write all end in the `error` face, from any starting face; nothing is left as an
// unhandled rejection.
//
// Every face's label sits in the same grid cell, so the button keeps the widest label's width and
// switching faces never shifts the row. In a narrow row the labels wrap together and the button
// grows in height instead of truncating.
import {
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ComponentPropsWithRef,
  type ComponentType,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { flushSync } from 'react-dom';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type SerializedStyles, type Theme } from '../../styling/css';
import { loadingRing } from '../../styling/loading-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import type { SxProps } from '../../styling/sx';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import { Button, type ButtonSize, type ButtonTone, type ButtonVariant } from '../button';

export type CopyButtonValue = 'idle' | 'pending' | 'copied' | 'error';

export type CopyButtonIcons = Partial<Record<CopyButtonValue, ReactNode>>;

export interface CopyButtonSlotPartProps extends ComponentPropsWithoutRef<'span'> {
  css?: Interpolation<Theme>;
}

export interface CopyButtonSlotProps {
  /** Icon container displaying the copy state glyph. */
  icon?: CopyButtonSlotPartProps;
  /** Text label displayed inside the copy button. */
  label?: CopyButtonSlotPartProps;
  /** Screen-reader live region announcing copy feedback. */
  status?: CopyButtonSlotPartProps;
}

export interface CopyButtonProps
  extends Omit<ComponentPropsWithRef<'button'>, 'children' | 'value' | 'defaultValue' | 'color' | 'type'>,
    SxProps {
  /** The string written to the clipboard. An empty string is a valid payload. */
  text: string;
  /** Accessible name and label while idle, e.g. "Copy command". */
  label: string;
  /** Label and announcement while copying. */
  pendingLabel: string;
  /** Label and announcement after copying succeeds. */
  copiedLabel: string;
  /** Label and announcement when copying fails or is unavailable. */
  errorLabel: string;
  /** Hides the visible label; the accessible name and announcements stay. */
  iconOnly?: boolean;
  /** Icon for each state. A supplied key replaces the default; `null` removes it. */
  icons?: CopyButtonIcons;
  value?: CopyButtonValue;
  defaultValue?: CopyButtonValue;
  onValueChange?: (value: CopyButtonValue) => void;
  /** Called once per successful write with the text captured at activation. */
  onCopied?: (text: string) => void;
  /** Called once per failed write, including a missing Clipboard API. */
  onCopyError?: (error: unknown) => void;
  /** Milliseconds before `copied`/`error` request `idle`; 0 keeps the result label. */
  resetAfterMs?: number;
  variant?: ButtonVariant;
  tone?: ButtonTone;
  size?: ButtonSize;
  slotProps?: CopyButtonSlotProps;
  slots?: {
    /** Displays the copy state icons. */
    icon?: ComponentType<CopyButtonSlotPartProps>;
    /** Displays the copy state labels. */
    label?: ComponentType<CopyButtonSlotPartProps>;
    /** Announces copy feedback. */
    status?: ComponentType<CopyButtonSlotPartProps>;
  };
}

const DEFAULT_RESET_AFTER_MS = 1900;
const FACES = ['idle', 'pending', 'copied', 'error'] as const satisfies readonly CopyButtonValue[];

const rootStyle = css({
  label: 'copy-button',
  position: 'relative',
  maxInlineSize: '100%',
});

// Labelled buttons wrap long labels and grow from the size's height instead of truncating.
const wrappingStyle = css({
  whiteSpace: 'normal',
  blockSize: 'auto',
  paddingBlock: vars.space[1],
});

const minBlockStyles: Record<ButtonSize, SerializedStyles> = {
  sm: css({ minBlockSize: vars.space[8] }),
  md: css({ minBlockSize: vars.space[10] }),
  lg: css({ minBlockSize: vars.space[12] }),
};

// Icon-only buttons are square at every size.
const iconOnlyStyles: Record<ButtonSize, SerializedStyles> = {
  sm: css({ inlineSize: vars.space[8], paddingInline: 0 }),
  md: css({ inlineSize: vars.space[10], paddingInline: 0 }),
  lg: css({ inlineSize: vars.space[12], paddingInline: 0 }),
};

const stackStyle = css({
  display: 'grid',
  minInlineSize: 0,
});

const iconSlotStyle = css({
  flexShrink: 0,
  inlineSize: vars.space[4],
  blockSize: vars.space[4],
});

const labelSlotStyle = css({
  textAlign: 'start',
});

// Faces share one grid cell; only the active one is opaque.
const faceStyle = css({
  gridArea: '1 / 1',
  minInlineSize: 0,
  opacity: 0,
  transitionProperty: 'opacity',
  transitionDuration: vars.motion.duration.base,
  transitionTimingFunction: vars.motion.easeStandard,
  '&[data-active]': { opacity: 1 },
  [REDUCED_MOTION]: { transitionDuration: '0s' },
});

const labelFaceStyle = css({
  overflowWrap: 'anywhere',
});

const iconFaceStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  '& svg': { inlineSize: '100%', blockSize: '100%' },
});

// Result glyphs add color on top of the face text; solid fills keep the button's own text color
// because the status colors do not reach 3:1 against them.
const copiedGlyphStyle = css({
  color: vars.color.success,
  [FORCED_COLORS]: { color: 'ButtonText' },
});
const errorGlyphStyle = css({
  color: vars.color.dangerText,
  [FORCED_COLORS]: { color: 'ButtonText' },
});
const resultGlyphs: Partial<Record<CopyButtonValue, SerializedStyles>> = {
  copied: copiedGlyphStyle,
  error: errorGlyphStyle,
};
const resultGlyphStyles: Record<ButtonVariant, Partial<Record<CopyButtonValue, SerializedStyles>>> = {
  solid: {},
  soft: resultGlyphs,
  outline: resultGlyphs,
  ghost: resultGlyphs,
};

const ringStyle = css({
  ...loadingRing,
  boxSizing: 'border-box',
  inlineSize: '100%',
  blockSize: '100%',
  [REDUCED_MOTION]: { animation: 'none' },
});

const glyphProps = {
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const DEFAULT_ICONS: Record<CopyButtonValue, ReactNode> = {
  idle: (
    <svg {...glyphProps}>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M10.5 3.5v-.5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h.5" />
    </svg>
  ),
  pending: <span css={ringStyle} />,
  copied: (
    <svg {...glyphProps}>
      <path d="M3 8.5l3.25 3.25L13 5" />
    </svg>
  ),
  error: (
    <svg {...glyphProps}>
      <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
    </svg>
  ),
};

const isResult = (value: CopyButtonValue) => value === 'copied' || value === 'error';
const isAriaTrue = (value: unknown) => value === true || value === 'true';

export function CopyButton({
  ref,
  text,
  label,
  pendingLabel,
  copiedLabel,
  errorLabel,
  iconOnly = false,
  icons,
  value,
  defaultValue = 'idle',
  onValueChange,
  onCopied,
  onCopyError,
  resetAfterMs = DEFAULT_RESET_AFTER_MS,
  variant = 'outline',
  tone = 'neutral',
  size = 'sm',
  slotProps,
  slots,
  disabled,
  onClick,
  className,
  sx,
  ...rest
}: CopyButtonProps) {
  const [state, requestChange] = useControlledState<CopyButtonValue>(value, defaultValue, onValueChange);
  const current = state ?? 'idle';
  // The ref blocks same-tick duplicates; the state re-arms the reset timer once the write settles.
  const inFlightRef = useRef<object | null>(null);
  const [inFlight, setInFlight] = useState(false);
  const mountedRef = useRef(false);
  const requestRef = useRef(requestChange);
  const callbacksRef = useRef({ onCopied, onCopyError });

  useEffect(() => {
    requestRef.current = requestChange;
    callbacksRef.current = { onCopied, onCopyError };
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      inFlightRef.current = null;
    };
  }, []);

  // The reset timer starts when a result face commits (controlled results too) and stops as soon
  // as the face leaves it or another copy starts.
  const resetDelay = Number.isFinite(resetAfterMs) && resetAfterMs > 0 ? resetAfterMs : 0;
  useEffect(() => {
    if (inFlight || !isResult(current) || resetDelay === 0) return;
    const timer = setTimeout(() => requestRef.current('idle'), resetDelay);
    return () => clearTimeout(timer);
  }, [current, inFlight, resetDelay]);

  const settle = (request: object, outcome: { ok: true; text: string } | { ok: false; error: unknown }) => {
    if (!mountedRef.current || inFlightRef.current !== request) return;
    inFlightRef.current = null;
    setInFlight(false);
    if (outcome.ok) {
      requestRef.current('copied');
      callbacksRef.current.onCopied?.(outcome.text);
    } else {
      requestRef.current('error');
      callbacksRef.current.onCopyError?.(outcome.error);
    }
  };

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (inFlightRef.current) return;
    onClick?.(event);
    if (event.defaultPrevented) return;

    const captured = text;
    const clipboard = event.currentTarget.ownerDocument.defaultView?.navigator.clipboard;
    const request = {};
    inFlightRef.current = request;
    // Commit `pending` now: requests dedupe against the committed face, so a synchronous failure
    // requested from an uncommitted `pending` would be dropped when the face was already `error`.
    flushSync(() => {
      setInFlight(true);
      requestChange('pending');
    });

    if (typeof clipboard?.writeText !== 'function') {
      settle(request, { ok: false, error: new Error('Clipboard API is unavailable') });
      return;
    }
    let write: PromiseLike<void>;
    try {
      write = clipboard.writeText(captured);
    } catch (error) {
      settle(request, { ok: false, error });
      return;
    }
    Promise.resolve(write).then(
      () => settle(request, { ok: true, text: captured }),
      (error: unknown) => settle(request, { ok: false, error }),
    );
  };

  const isPending = current === 'pending';
  const faceLabels: Record<CopyButtonValue, string> = {
    idle: label,
    pending: pendingLabel,
    copied: copiedLabel,
    error: errorLabel,
  };
  const faceIcons = FACES.map((face) => (icons?.[face] !== undefined ? icons[face] : DEFAULT_ICONS[face]));
  const hasIcons = faceIcons.some(isRenderable);
  const { css: iconSlotCss, ...iconSlotProps } = slotProps?.icon ?? {};
  const { css: labelSlotCss, ...labelSlotProps } = slotProps?.label ?? {};
  const { css: statusSlotCss, ...statusSlotProps } = slotProps?.status ?? {};
  const Icon = slots?.icon ?? 'span';
  const Label = slots?.label ?? 'span';
  const Status = slots?.status ?? 'span';

  return (
    <>
      <Button
        {...rest}
        ref={ref}
        type="button"
        variant={variant}
        tone={tone}
        size={size}
        data-ui="copy-button"
        data-state={current}
        aria-busy={isPending ? true : rest['aria-busy']}
        aria-disabled={isPending || isAriaTrue(rest['aria-disabled']) ? true : rest['aria-disabled']}
        onClick={handleClick}
        className={className}
        css={[rootStyle, iconOnly ? iconOnlyStyles[size] : [wrappingStyle, minBlockStyles[size]]]}
        sx={sx}
        render={(buttonProps) => <button {...buttonProps} type="button" disabled={disabled} />}
      >
        <span css={visuallyHiddenStyle}>{label}</span>
        {hasIcons && (
          <Icon
            {...iconSlotProps}
            aria-hidden="true"
            data-ui="copy-button-icon"
            css={[stackStyle, iconSlotStyle, iconSlotCss]}
          >
            {FACES.map((face, index) => (
              <span
                key={face}
                data-active={face === current || undefined}
                css={[faceStyle, iconFaceStyle, resultGlyphStyles[variant][face]]}
              >
                {faceIcons[index]}
              </span>
            ))}
          </Icon>
        )}
        {!iconOnly && (
          <Label
            {...labelSlotProps}
            aria-hidden="true"
            data-ui="copy-button-label"
            css={[stackStyle, labelSlotStyle, labelSlotCss]}
          >
            {FACES.map((face) => (
              <span key={face} data-active={face === current || undefined} css={[faceStyle, labelFaceStyle]}>
                {faceLabels[face]}
              </span>
            ))}
          </Label>
        )}
      </Button>
      <Status
        {...statusSlotProps}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-ui="copy-button-status"
        css={[visuallyHiddenStyle, statusSlotCss]}
      >
        {current === 'idle' ? '' : faceLabels[current]}
      </Status>
    </>
  );
}

CopyButton.displayName = 'CopyButton';
