// Toast notifications. The APG has no toast pattern (checked 2026-10-10); this follows the APG
// Alert pattern and the ARIA live-region roles instead:
// - Each toast's text-only message is a live region: `role="status"` (polite) or
//   `role="alert"` for `tone: 'danger'` (assertive). Set aria-atomic="true" explicitly
//   because some environments do not honor the role defaults. Controls are siblings.
// - A live region inserted already populated is generally not announced, so each toast mounts
//   empty and fills its content after ANNOUNCE_DELAY_MS (content change → announcement).
// - Appearing toasts never move focus. Removing a focused toast continues focus to the first
//   surviving toast's dismiss button; focus elsewhere is never moved.
// - Deviation from the APG Alert advice against auto-disappearing alerts: toasts auto-dismiss
//   by default (`duration`). The timer pauses on hover/focus; `duration: null` persists.
//   Consumers own equivalent access to timed content for WCAG 2.2.1's temporary-message
//   exception; pausing alone does not establish conformance.
// Keyboard map: no custom keys; Tab/Shift+Tab reach the action and dismiss buttons, Enter/Space
// activate them.
//
// State: the queue is provider-internal, app-owned imperative state (`toast()` / `dismiss()`),
// not a controlled prop axis, so `useControlledState` (controlled props only) does not apply.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type FocusEvent,
  type MouseEvent,
  type ReactNode,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { vars } from '@jfrader/tokens/vars';
import { css, type SerializedStyles } from '../../styling/css';
import { REDUCED_MOTION, FORCED_COLORS } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { ThemeBoundary, useThemeScope } from '../../styling/theme-scope';
import { isRenderable } from '../../utils/renderable';
import { Button } from '../button';
import { Spinner } from '../spinner';

// Bundlers replace `process.env.NODE_ENV` in consumer builds; library mode leaves it in place.
declare const process: { env: { NODE_ENV?: string } };

export type ToastTone = 'neutral' | 'success' | 'danger' | 'info' | 'warning';

export interface ToastAction {
  label: string;
  /** Runs on click; the toast then dismisses unless the handler calls `event.preventDefault()`. */
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}

export interface ToastOptions {
  title?: ReactNode;
  description?: ReactNode;
  tone?: ToastTone;
  /** Milliseconds before dismissal. `null` keeps the toast open; omitted uses the provider's delay. */
  duration?: number | null;
  action?: ToastAction;
  /** Decorative spinner; an omitted duration persists while loading. */
  loading?: boolean;
}

export interface ToastProviderProps {
  children?: ReactNode;
  /** Maximum toasts kept. Adding beyond this count removes the oldest immediately. */
  max?: number;
  /** Default delay when a toast is added. Changes do not affect existing toasts. */
  duration?: number;
  /** Accessible label for each toast's close button. */
  dismissLabel?: string;
}

export interface ToastViewportProps extends ComponentPropsWithRef<'div'>, SxProps {}

export interface ToastApi {
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
  /**
   * Patches an open toast in place; only a changed duration restarts the countdown.
   * Unknown or closing ids are ignored.
   */
  update: (id: string, patch: Partial<ToastOptions>) => void;
}

type ToastState = 'open' | 'closing';

interface ToastRecord {
  id: string;
  options: ToastOptions;
  state: ToastState;
}

interface ToastQueueContextValue {
  toasts: ToastRecord[];
  dismiss: (id: string) => void;
  remove: (id: string) => void;
  registerRoot: (id: string, root: HTMLDivElement | null) => void;
  dismissLabel: string;
  registerRenderer: () => () => void;
}

const DEFAULT_MAX = 4;
const DEFAULT_DURATION_MS = 5000;
const DEFAULT_DISMISS_LABEL = 'Dismiss';
/** Delay between mounting an empty live region and filling it, so the fill is announced. */
const ANNOUNCE_DELAY_MS = 100;
export const TOAST_VIEWPORT_INLINE_SIZE = 'min(380px, calc(100vw - 32px))';
const TONE_STRIPE_WIDTH = '3px';

const ToastApiContext = createContext<ToastApi | null>(null);
const ToastQueueContext = createContext<ToastQueueContextValue | null>(null);

// Fixed + portaled at the end of the body (or the ThemeRoot's `portalContainer`): later in DOM
// order than the page, so no z-index. ThemeBoundary carries the enclosing ThemeRoot's theme.
// The viewport ignores the pointer so the empty corner never blocks the page; toasts opt back in.
const viewportStyle = css({
  position: 'fixed',
  insetBlockEnd: 0,
  insetInlineEnd: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: vars.space[2],
  inlineSize: TOAST_VIEWPORT_INLINE_SIZE,
  margin: 0,
  paddingInlineEnd: vars.space[4],
  paddingBlockEnd: vars.space[4],
  pointerEvents: 'none',
  fontFamily: vars.font.sans,
});

const toastStyle = css({
  boxSizing: 'border-box',
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'start',
  gap: vars.space[2],
  backgroundColor: vars.color.surfaceRaised,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.lg,
  boxShadow: vars.shadow.floating,
  padding: vars.space[3],
  color: vars.color.text,
  lineHeight: vars.lineHeight.base,
  pointerEvents: 'auto',
  transitionProperty: 'opacity, transform',
  transitionDuration: vars.motion.duration.base,
  transitionTimingFunction: vars.motion.easeStandard,
  // The empty frame before the live region fills (see ANNOUNCE_DELAY_MS) stays invisible.
  '&[data-populated="false"][data-exposed="true"]': { opacity: 0 },
  '&[data-state="closing"]': {
    opacity: 0,
    transform: `translateY(${vars.space[2]})`,
    pointerEvents: 'none',
  },
  [REDUCED_MOTION]: {
    transitionDuration: '0s',
    '&[data-state="closing"]': { transform: 'none' },
  },
  [FORCED_COLORS]: { backgroundColor: 'Canvas', color: 'CanvasText', borderColor: 'CanvasText' },
});

// Tone is a decorative stripe; meaning is carried by the role (alert vs status) and the text.
// No text uses these colors, so text contrast is unaffected.
const toneStyles: Record<ToastTone, SerializedStyles> = {
  neutral: css({ borderInlineStart: `${TONE_STRIPE_WIDTH} solid ${vars.color.borderStrong}` }),
  success: css({ borderInlineStart: `${TONE_STRIPE_WIDTH} solid ${vars.color.success}` }),
  danger: css({ borderInlineStart: `${TONE_STRIPE_WIDTH} solid ${vars.color.danger}` }),
  info: css({ borderInlineStart: `${TONE_STRIPE_WIDTH} solid ${vars.color.info}` }),
  warning: css({ borderInlineStart: `${TONE_STRIPE_WIDTH} solid ${vars.color.warning}` }),
};

const bodyStyle = css({
  display: 'grid',
  gap: vars.space[1],
  alignSelf: 'center',
  minInlineSize: 0,
  overflowWrap: 'anywhere',
});

const titleStyle = css({
  margin: 0,
  fontSize: vars.textSize.sm,
  fontWeight: vars.fontWeight.semibold,
});

const descriptionStyle = css({
  margin: 0,
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
});

const dismissStyle = css({
  gridColumn: 2,
  gridRow: 1,
  inlineSize: '32px',
  paddingInline: 0,
});

const actionsStyle = css({
  display: 'contents',
});

const actionRowStyle = css({
  gridColumn: '1 / -1',
  display: 'flex',
  gap: vars.space[2],
});

const actionStyle = css({
  minInlineSize: 0,
  maxInlineSize: '100%',
  blockSize: 'auto',
  minBlockSize: '32px',
  paddingBlock: vars.space[2],
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
});

export function useToastQueueContext(part: string): ToastQueueContextValue {
  const context = useContext(ToastQueueContext);
  if (!context) throw new Error(`Toast.${part} must be rendered inside <Toast.Provider>.`);
  return context;
}

export function useToast(): ToastApi {
  const api = useContext(ToastApiContext);
  if (!api) throw new Error('useToast() must be called inside <Toast.Provider>.');
  return api;
}

function ToastProvider({
  children,
  max = DEFAULT_MAX,
  duration = DEFAULT_DURATION_MS,
  dismissLabel = DEFAULT_DISMISS_LABEL,
}: ToastProviderProps) {
  const idPrefix = useId();
  const counterRef = useRef(0);
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const queueRef = useRef<ToastRecord[]>([]);
  const mountedRef = useRef(true);
  const rootsRef = useRef(new Map<string, HTMLDivElement>());
  const pendingFocusRef = useRef<{ container: Element; ids: Set<string> } | null>(null);
  const rendererCount = useRef(0);
  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const registerRenderer = useCallback(() => {
    rendererCount.current += 1;
    if (process.env.NODE_ENV !== 'production' && rendererCount.current > 1)
      console.warn('Mount only one Toast queue renderer per provider.');
    return () => {
      rendererCount.current -= 1;
    };
  }, []);
  // An empty stack is not a usable limit, so zero/negative values are clamped.
  const limit = Math.max(1, Math.floor(Number.isFinite(max) ? max : DEFAULT_MAX));

  const registerRoot = useCallback((id: string, root: HTMLDivElement | null) => {
    if (root) rootsRef.current.set(id, root);
    else rootsRef.current.delete(id);
  }, []);

  const continueFocus = useCallback((departing: ToastRecord[], surviving: ToastRecord[]) => {
    // Continue only focus inside departing content, before inert/removal can drop it.
    // Use DOM order, skip other closing toasts, and leave focus alone if no toast survives.
    for (const record of departing) {
      const root = rootsRef.current.get(record.id);
      if (!root?.contains(root.ownerDocument.activeElement)) continue;
      const container =
        root.closest('[data-ui="toast-stack-list"], [data-ui="toast-viewport"]') ?? root.parentElement;
      if (container)
        pendingFocusRef.current = {
          container,
          ids: new Set(surviving.filter((item) => item.state === 'open').map((item) => item.id)),
        };
      break;
    }
  }, []);

  useLayoutEffect(() => {
    const pending = pendingFocusRef.current;
    if (!pending) return;
    pendingFocusRef.current = null;
    Array.from(pending.container.querySelectorAll<HTMLDivElement>('[data-ui="toast"]'))
      .find((root) => pending.ids.has(root.dataset.toastId!))
      ?.querySelector<HTMLButtonElement>('[data-toast-dismiss]')
      ?.focus();
  }, [toasts]);

  const toast = useCallback(
    (options: ToastOptions) => {
      counterRef.current += 1;
      const id = `${idPrefix}toast-${counterRef.current}`;
      if (!mountedRef.current) return id;
      // Resolve the provider default once; later provider changes do not retime this toast.
      const record: ToastRecord = {
        id,
        options: {
          ...options,
          duration: options.duration === undefined ? (options.loading ? null : duration) : options.duration,
        },
        state: 'open',
      };
      const current = queueRef.current;
      const next = [...current, record].slice(-limit);
      continueFocus(
        current.filter((item) => !next.includes(item)),
        next,
      );
      queueRef.current = next;
      setToasts(next);
      return id;
    },
    [idPrefix, limit, duration, continueFocus],
  );

  const update = useCallback(
    (id: string, patch: Partial<ToastOptions>) => {
      if (!mountedRef.current) return;
      const next = queueRef.current.map((record) => {
        if (record.id !== id || record.state !== 'open') return record;
        const options = { ...record.options, ...patch };
        if (patch.duration !== undefined) options.duration = patch.duration;
        else if (patch.loading !== undefined) options.duration = patch.loading ? null : duration;
        else options.duration = record.options.duration;
        return { ...record, options };
      });
      queueRef.current = next;
      setToasts(next);
    },
    [duration],
  );

  const dismiss = useCallback(
    (id: string) => {
      if (!mountedRef.current) return;
      const current = queueRef.current;
      continueFocus(
        current.filter((record) => record.id === id),
        current.filter((record) => record.id !== id),
      );
      const next = current.map((record): ToastRecord =>
        record.id === id && record.state === 'open' ? { ...record, state: 'closing' } : record,
      );
      queueRef.current = next;
      setToasts(next);
    },
    [continueFocus],
  );

  const remove = useCallback(
    (id: string) => {
      if (!mountedRef.current) return;
      const current = queueRef.current;
      const next = current.filter((record) => record.id !== id);
      continueFocus(
        current.filter((record) => record.id === id),
        next,
      );
      queueRef.current = next;
      setToasts(next);
    },
    [continueFocus],
  );

  // Two contexts: `useToast` consumers get a value that stays stable while the queue changes.
  const api = useMemo(() => ({ toast, dismiss, update }), [toast, dismiss, update]);
  const queue = useMemo(
    () => ({ toasts, dismiss, remove, registerRoot, dismissLabel, registerRenderer }),
    [toasts, dismiss, remove, registerRoot, dismissLabel, registerRenderer],
  );

  return (
    <ToastApiContext.Provider value={api}>
      <ToastQueueContext.Provider value={queue}>{children}</ToastQueueContext.Provider>
    </ToastApiContext.Provider>
  );
}

ToastProvider.displayName = 'Toast.Provider';

function ToastViewport({ ref, className, sx, ...props }: ToastViewportProps) {
  const { toasts, registerRenderer } = useToastQueueContext('Viewport');
  useEffect(registerRenderer, [registerRenderer]);
  return (
    <ToastPortal>
      <WithSx className={className} styles={viewportStyle} sx={sx}>
        {(className) => (
          <div {...props} ref={ref} data-ui="toast-viewport" className={className}>
            {toasts.map((record) => (
              <ToastItem key={record.id} record={record} />
            ))}
          </div>
        )}
      </WithSx>
    </ToastPortal>
  );
}

export function ToastPortal({ children, contained = false }: { children: ReactNode; contained?: boolean }) {
  // The local anchor selects the host document (including iframe/other-document mounts),
  // not the global realm's document. It also renders on the server; the portal waits for mount.
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [bodyRoot, setBodyRoot] = useState<HTMLElement | null>(null);
  // Same contract as OverlayPortal: an explicit container wins and `null` waits for the host.
  const container = useThemeScope()?.portalContainer;
  const portalRoot = container === undefined ? bodyRoot : container;

  useEffect(() => {
    setBodyRoot(anchorRef.current?.ownerDocument.body ?? null);
  }, []);

  return (
    <>
      <span hidden ref={anchorRef} />
      {contained
        ? children
        : portalRoot && createPortal(<ThemeBoundary>{children}</ThemeBoundary>, portalRoot)}
    </>
  );
}

ToastViewport.displayName = 'Toast.Viewport';

export function ToastItem({
  record,
  exposed = true,
  paused = false,
  style,
  className,
  escapeDismiss = false,
}: {
  record: ToastRecord;
  exposed?: boolean;
  paused?: boolean;
  style?: CSSProperties;
  className?: string;
  escapeDismiss?: boolean;
}) {
  const { dismiss, remove, registerRoot, dismissLabel } = useToastQueueContext('Viewport');
  const { id, options, state } = record;
  const { title, description, tone = 'neutral', action, loading } = options;
  const duration = options.duration;

  const rootRef = useRef<HTMLDivElement>(null);
  const setRoot = useCallback(
    (root: HTMLDivElement | null) => {
      rootRef.current = root;
      registerRoot(id, root);
    },
    [id, registerRoot],
  );
  const [populated, setPopulated] = useState(false);
  const [pointerInside, setPointerInside] = useState(false);
  const [focusInside, setFocusInside] = useState(false);
  const remainingRef = useRef(duration ?? 0);
  const [documentHidden, setDocumentHidden] = useState(false);

  useEffect(() => {
    const document = rootRef.current?.ownerDocument;
    if (!document) return;
    const sync = () => setDocumentHidden(document.hidden);
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  useEffect(() => {
    remainingRef.current = duration ?? 0;
  }, [duration]);

  useEffect(() => {
    if (!exposed || populated) return;
    const timer = setTimeout(() => setPopulated(true), ANNOUNCE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [exposed, populated]);

  // Auto-dismiss counts down only while visible, open and not paused. Pausing
  // runs the cleanup, which banks the elapsed time; resuming continues from what is left.
  const timerRunning =
    populated &&
    exposed &&
    !paused &&
    !documentHidden &&
    state === 'open' &&
    duration !== null &&
    !pointerInside &&
    !focusInside;
  useEffect(() => {
    if (!timerRunning) return;
    const startedAt = performance.now();
    const timer = setTimeout(() => dismiss(id), remainingRef.current);
    return () => {
      clearTimeout(timer);
      remainingRef.current -= performance.now() - startedAt;
    };
  }, [timerRunning, dismiss, id, duration]);

  // Exit: wait for the closing transition, then remove. With reduced motion (0s) or no
  // Web Animations support there is nothing to wait for and removal is immediate.
  useEffect(() => {
    if (state !== 'closing') return;
    const element = rootRef.current;
    const animations = element && typeof element.getAnimations === 'function' ? element.getAnimations() : [];
    let cancelled = false;
    void Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
      if (!cancelled) remove(id);
    });
    return () => {
      cancelled = true;
    };
  }, [state, remove, id]);

  const handleFocus = () => setFocusInside(true);
  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setFocusInside(false);
  };

  const handleAction = (event: MouseEvent<HTMLButtonElement>) => {
    action?.onClick(event);
    if (!event.defaultPrevented) dismiss(id);
  };

  return (
    <div
      ref={setRoot}
      inert={state === 'closing' || !exposed}
      aria-hidden={state === 'closing' || !exposed ? true : undefined}
      data-toast-id={id}
      style={style}
      className={className}
      onKeyDown={(event) => {
        if (escapeDismiss && event.key === 'Escape' && !event.defaultPrevented) {
          event.preventDefault();
          event.stopPropagation();
          dismiss(id);
        }
      }}
      data-ui="toast"
      data-tone={tone}
      data-state={state}
      data-populated={populated}
      data-exposed={exposed}
      onPointerEnter={() => setPointerInside(true)}
      onPointerLeave={() => setPointerInside(false)}
      onFocus={handleFocus}
      onBlur={handleBlur}
      css={[toastStyle, toneStyles[tone]]}
    >
      <div role={tone === 'danger' ? 'alert' : 'status'} aria-atomic="true" css={bodyStyle}>
        {populated && (
          <>
            {isRenderable(title) && <div css={titleStyle}>{title}</div>}
            {isRenderable(description) && <div css={descriptionStyle}>{description}</div>}
          </>
        )}
      </div>
      {loading && <Spinner aria-hidden="true" label="" size="sm" />}
      {(populated || (escapeDismiss && exposed)) && (
        <div css={actionsStyle}>
          <Button
            variant="ghost"
            size="sm"
            aria-label={dismissLabel}
            data-toast-dismiss=""
            onClick={() => dismiss(id)}
            css={dismissStyle}
          >
            <DismissGlyph />
          </Button>
          {action && (
            <div css={actionRowStyle}>
              <Button variant="outline" size="sm" onClick={handleAction} css={actionStyle}>
                {action.label}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DismissGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <line x1="4" y1="4" x2="12" y2="12" />
      <line x1="12" y1="4" x2="4" y2="12" />
    </svg>
  );
}

// `Toast` and `Toast.Provider` share one implementation in the public API, but each
// public name needs its own displayName for devtools and the docs code panels.
function ToastRoot(props: ToastProviderProps) {
  return <ToastProvider {...props} />;
}
ToastRoot.displayName = 'Toast';

export const Toast = Object.assign(ToastRoot, { Provider: ToastProvider, Viewport: ToastViewport });
