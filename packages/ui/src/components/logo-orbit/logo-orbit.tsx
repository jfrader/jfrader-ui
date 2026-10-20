'use client';

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ComponentType,
  type ReactNode,
} from 'react';
import {
  animate,
  MotionConfig,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from 'motion/react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { WithSx, type SxProps } from '../../styling/sx';
import { motionDurationMs } from '../../styling/motion-timings';
import {
  GeneratedRoot,
  type GeneratedRootSlotProps,
} from '../../utils/generated-root';
import { useControlledState } from '../../utils/use-controlled-state';
import { safeUrl } from '../../utils/attachment';
import { moveRovingFocus } from '../../utils/roving-focus';
import { Button } from '../button';

export interface OrbitLogo {
  id: string;
  name: string;
  logo: ReactNode;
  category?: string;
  description?: ReactNode;
  connected?: boolean;
  href?: string;
}
type Part<P> = P & { sx?: Interpolation<Theme> };
type DivProps = ComponentPropsWithRef<'div'>;
type ButtonProps = ComponentPropsWithRef<'button'>;
export interface LogoOrbitSlots {
  root?: ComponentType<DivProps>;
  stage?: ComponentType<DivProps>;
  center?: ComponentType<DivProps>;
  filters?: ComponentType<DivProps>;
  filterButton?: ComponentType<ButtonProps>;
  pauseButton?: ComponentType<ButtonProps>;
  list?: ComponentType<ComponentPropsWithRef<'ul'>>;
  item?: ComponentType<ComponentPropsWithRef<'li'>>;
  logoButton?: ComponentType<ButtonProps>;
  detail?: ComponentType<ComponentPropsWithRef<'section'>>;
  connectButton?: ComponentType<ButtonProps>;
  docsLink?: ComponentType<ComponentPropsWithRef<'a'>>;
  previousButton?: ComponentType<ButtonProps>;
  nextButton?: ComponentType<ButtonProps>;
  closeButton?: ComponentType<ButtonProps>;
  status?: ComponentType<DivProps>;
}
export interface LogoOrbitLabels {
  all: string;
  categories: string;
  pause: string;
  resume: string;
  connect: string;
  connecting: string;
  retry: string;
  connected: string;
  unconnected: string;
  close: string;
  previous: string;
  next: string;
  docs: string;
  empty: string;
  failed: (name: string) => string;
}
export interface LogoOrbitProps
  extends Omit<DivProps, 'children' | 'defaultValue' | 'onChange'>, SxProps {
  items: readonly OrbitLogo[];
  center?: ReactNode;
  label?: string;
  variant?: 'orbit' | 'list';
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (id: string | null) => void;
  filter?: string | null;
  defaultFilter?: string | null;
  onFilterChange?: (category: string | null) => void;
  paused?: boolean;
  defaultPaused?: boolean;
  onPausedChange?: (paused: boolean) => void;
  speed?: number;
  onConnect?: (id: string) => Promise<void>;
  labels?: Partial<LogoOrbitLabels>;
  component?: LogoOrbitSlots['root'];
  slots?: LogoOrbitSlots;
  slotProps?: {
    root?: GeneratedRootSlotProps;
    stage?: Part<DivProps>;
    center?: Part<DivProps>;
    filters?: Part<DivProps>;
    filterButton?: Part<ButtonProps>;
    pauseButton?: Part<ButtonProps>;
    list?: Part<ComponentPropsWithRef<'ul'>>;
    item?: Part<ComponentPropsWithRef<'li'>>;
    logoButton?: Part<ButtonProps>;
    detail?: Part<ComponentPropsWithRef<'section'>>;
    connectButton?: Part<ButtonProps>;
    docsLink?: Part<ComponentPropsWithRef<'a'>>;
    previousButton?: Part<ButtonProps>;
    nextButton?: Part<ButtonProps>;
    closeButton?: Part<ButtonProps>;
    status?: Part<DivProps>;
  };
}
const ORBIT_SECONDS = 64;
const OUTER_RADIUS_RATIO = 0.38;
const INNER_RADIUS_RATIO = 0.29;
const OUTER_HEIGHT_RATIO = 0.7;
const defaultLabels: LogoOrbitLabels = {
  all: 'All',
  categories: 'Categories',
  pause: 'Pause',
  resume: 'Resume',
  connect: 'Connect',
  connecting: 'Connecting',
  retry: 'Retry',
  connected: 'Connected',
  unconnected: 'Not connected',
  close: 'Close',
  previous: 'Previous',
  next: 'Next',
  docs: 'Docs',
  empty: 'No integrations',
  failed: (name) => `${name}: connection failed`,
};
const rootStyle = css({
  color: vars.color.text,
  fontFamily: vars.font.sans,
  maxInlineSize: '100%',
});
const controlsStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: vars.space[2],
  alignItems: 'center',
  marginBlockEnd: vars.space[3],
});
const filterStyle = css({ borderRadius: vars.radius.full });
const buttonStyle = css({
  font: 'inherit',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minBlockSize: vars.space[10],
  minInlineSize: vars.space[10],
  paddingInline: vars.space[3],
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.md,
  background: vars.color.surfaceRaised,
  color: vars.color.text,
  cursor: 'pointer',
  '&:focus-visible': focusRingOutset,
  '&[aria-pressed="true"]': {
    background: vars.color.accentSoft,
    color: vars.color.accentText,
  },
  '&:disabled, &[aria-disabled="true"]': {
    cursor: 'not-allowed',
    color: vars.color.textMuted,
  },
});
const stageStyle = css({
  position: 'relative',
  inlineSize: '100%',
  maxInlineSize: '32rem',
  aspectRatio: '1',
  marginInline: 'auto',
  '&:not([data-list="true"])::before, &:not([data-list="true"])::after': {
    content: '""',
    position: 'absolute',
    insetInlineStart: '50%',
    insetBlockStart: '50%',
    transform: 'translate(-50%, -50%)',
    border: `1px solid ${vars.color.border}`,
    borderRadius: vars.radius.full,
    pointerEvents: 'none',
  },
  '&:not([data-list="true"])::before': {
    inlineSize: `${OUTER_RADIUS_RATIO * 200}%`,
    blockSize: `${OUTER_RADIUS_RATIO * OUTER_HEIGHT_RATIO * 200}%`,
  },
  '&:not([data-list="true"])::after': {
    inlineSize: `${INNER_RADIUS_RATIO * 200}%`,
    blockSize: `${INNER_RADIUS_RATIO * 200}%`,
  },
  '&[data-list="true"]': { aspectRatio: 'auto', paddingBlock: vars.space[4] },
});
const centerStyle = css({
  position: 'absolute',
  insetInlineStart: '50%',
  insetBlockStart: '50%',
  transform: 'translate(-50%, -50%)',
  fontSize: vars.textSize['3xl'],
  color: vars.color.accentText,
  pointerEvents: 'none',
});
const listStyle = css({
  listStyle: 'none',
  padding: 0,
  margin: 0,
  position: 'absolute',
  inset: 0,
  '&[data-list="true"]': {
    position: 'relative',
    display: 'flex',
    flexWrap: 'wrap',
    gap: vars.space[3],
  },
});
const logoStyle = css({
  padding: vars.space[2],
  minInlineSize: vars.space[12],
  minBlockSize: vars.space[12],
  '& svg': { inlineSize: vars.space[6], blockSize: vars.space[6] },
});
const detailStyle = css({
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.lg,
  background: vars.color.surfaceRaised,
  padding: vars.space[4],
  display: 'grid',
  gap: vars.space[3],
  '& h3, & p': { margin: 0 },
  '& h3': { fontSize: vars.textSize.lg },
});
const statusStyle = css({
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
  marginBlockStart: vars.space[2],
});
const linkStyle = css({
  color: vars.color.accentText,
  '&:focus-visible': focusRingOutset,
});
const positionCenterStyle = css({ transform: 'translate(-50%, -50%)' });

function OrbitPosition({
  angle,
  index,
  count,
  staticList,
  width,
  height,
  children,
}: {
  angle: MotionValue<number>;
  index: number;
  count: number;
  staticList: boolean;
  width: MotionValue<number>;
  height: MotionValue<number>;
  children: ReactNode;
}) {
  const phase = (index / Math.max(1, count)) * 360;
  const ring = index % 2 === 0 ? OUTER_RADIUS_RATIO : INNER_RADIUS_RATIO;
  const x = useTransform(
    () =>
      Math.cos(((angle.get() + phase) * Math.PI) / 180) * ring * width.get(),
  );
  const y = useTransform(
    () =>
      Math.sin(((angle.get() + phase) * Math.PI) / 180) *
      ring *
      (index % 2 === 0 ? OUTER_HEIGHT_RATIO : 1) *
      height.get(),
  );
  return (
    <motion.div
      style={
        staticList
          ? undefined
          : { position: 'absolute', left: '50%', top: '50%', x, y }
      }
    >
      <div css={staticList ? undefined : positionCenterStyle}>{children}</div>
    </motion.div>
  );
}

/** Explore and select logos arranged around a central item. */
export function LogoOrbit(props: LogoOrbitProps) {
  return (
    <MotionConfig reducedMotion="user">
      <LogoOrbitBody {...props} />
    </MotionConfig>
  );
}
function LogoOrbitBody({
  items,
  center,
  label = 'Integrations',
  variant = 'orbit',
  value,
  defaultValue = null,
  onValueChange,
  filter,
  defaultFilter = null,
  onFilterChange,
  paused,
  defaultPaused = false,
  onPausedChange,
  speed = 1,
  onConnect,
  labels,
  component,
  slots,
  slotProps,
  className,
  sx,
  ...props
}: LogoOrbitProps) {
  const [selected, requestSelection] = useControlledState(
    value,
    defaultValue,
    onValueChange,
  );
  const [category, requestFilter] = useControlledState(
    filter,
    defaultFilter,
    onFilterChange,
  );
  const [stopped = false, requestPause] = useControlledState(
    paused,
    defaultPaused,
    onPausedChange,
  );
  const reduce = useReducedMotion();
  const angle = useMotionValue(0);
  const stageWidth = useMotionValue(0);
  const stageHeight = useMotionValue(0);
  const stage = useRef<HTMLDivElement | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const [resting, setResting] = useState(false);
  const [visible, setVisible] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);
  const [focused, setFocused] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const operation = useRef<object | null>(null);
  const returnFocus = useRef<string | null>(null);
  const titleId = useId();
  const copy = { ...defaultLabels, ...labels };
  const matches = items.filter(
    (item) => category == null || item.category === category,
  );
  const detail = items.find((item) => item.id === selected);
  const currentFocus = matches.some((item) => item.id === focused)
    ? focused
    : matches[0]?.id;
  const categories = [
    ...new Set(items.flatMap((item) => (item.category ? [item.category] : []))),
  ];
  const staticList = variant === 'list';
  const rate = Number.isFinite(speed) && speed >= 0 ? speed : 1;
  useLayoutEffect(() => {
    const node = stage.current;
    if (!node) return;
    const measure = () => {
      stageWidth.set(node.clientWidth);
      stageHeight.set(node.clientHeight);
    };
    measure();
    const Observer = node.ownerDocument.defaultView?.ResizeObserver;
    const observer = Observer ? new Observer(measure) : undefined;
    observer?.observe(node);
    return () => observer?.disconnect();
  }, [stageWidth, stageHeight, staticList]);
  useEffect(
    () => () => {
      operation.current = null;
    },
    [],
  );
  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    const doc = node.ownerDocument;
    const visibility = () => setPageVisible(!doc.hidden);
    visibility();
    doc.addEventListener('visibilitychange', visibility);
    const Observer = doc.defaultView?.IntersectionObserver;
    const observer = Observer
      ? new Observer(([entry]) => setVisible(entry?.isIntersecting ?? false))
      : undefined;
    observer?.observe(node);
    return () => {
      observer?.disconnect();
      doc.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  useEffect(() => {
    if (
      staticList ||
      reduce ||
      stopped ||
      resting ||
      detail ||
      !visible ||
      !pageVisible ||
      rate === 0
    )
      return;
    const start = angle.get();
    const animation = animate(angle, [start, start + 360], {
      duration: ORBIT_SECONDS / rate,
      ease: 'linear',
      repeat: Infinity,
    });
    return () => animation.stop();
  }, [
    angle,
    staticList,
    reduce,
    stopped,
    resting,
    detail,
    visible,
    pageVisible,
    rate,
  ]);
  useEffect(() => {
    if (selected != null || returnFocus.current == null) return;
    buttons.current.get(returnFocus.current)?.focus();
    returnFocus.current = null;
  }, [selected]);
  const select = (id: string | null) => {
    returnFocus.current = null;
    requestSelection(id);
  };
  const connect = async (item: OrbitLogo) => {
    if (!onConnect || operation.current) return;
    const token = {};
    operation.current = token;
    setPending(item.id);
    setError(null);
    setStatus(`${item.name}: ${copy.connecting}`);
    try {
      await onConnect(item.id);
      if (operation.current === token) setStatus('');
    } catch {
      if (operation.current === token) {
        setError(item.id);
        setStatus(copy.failed(item.name));
      }
    } finally {
      if (operation.current === token) {
        operation.current = null;
        setPending(null);
      }
    }
  };
  const Stage = slots?.stage ?? 'div';
  const Center = slots?.center ?? 'div';
  const Filters = slots?.filters ?? 'div';
  const FilterButton = slots?.filterButton ?? 'button';
  const PauseButton = slots?.pauseButton ?? Button;
  const List = slots?.list ?? 'ul';
  const Item = slots?.item ?? 'li';
  const LogoButton = slots?.logoButton ?? 'button';
  const Detail = slots?.detail ?? 'section';
  const ConnectButton = slots?.connectButton ?? 'button';
  const DocsLink = slots?.docsLink ?? 'a';
  const PreviousButton = slots?.previousButton ?? 'button';
  const NextButton = slots?.nextButton ?? 'button';
  const CloseButton = slots?.closeButton ?? 'button';
  const Status = slots?.status ?? 'div';
  const {
    sx: stageCss,
    ref: stageRef,
    ...stageProps
  } = slotProps?.stage ?? {};
  const { sx: centerCss, ...centerProps } = slotProps?.center ?? {};
  const { sx: filtersCss, ...filtersProps } = slotProps?.filters ?? {};
  const { sx: filterCss, ...filterProps } = slotProps?.filterButton ?? {};
  const { sx: pauseCss, ...pauseProps } = slotProps?.pauseButton ?? {};
  const { sx: listCss, ...listProps } = slotProps?.list ?? {};
  const { sx: itemCss, ...itemProps } = slotProps?.item ?? {};
  const { sx: logoCss, ...logoProps } = slotProps?.logoButton ?? {};
  const { sx: detailCss, ...detailProps } = slotProps?.detail ?? {};
  const { sx: connectCss, ...connectProps } = slotProps?.connectButton ?? {};
  const { sx: docsCss, ...docsProps } = slotProps?.docsLink ?? {};
  const { sx: previousCss, ...previousProps } =
    slotProps?.previousButton ?? {};
  const { sx: nextCss, ...nextProps } = slotProps?.nextButton ?? {};
  const { sx: closeCss, ...closeProps } = slotProps?.closeButton ?? {};
  const { sx: statusCss, ...statusProps } = slotProps?.status ?? {};
  const moveSelection = (step: number) => {
    const index = matches.findIndex((item) => item.id === detail?.id);
    const next = matches[(index + step + matches.length) % matches.length];
    if (next) select(next.id);
  };
  return (
    <GeneratedRoot
      {...props}
      component={slots?.root ?? component}
      marker="logo-orbit"
      rootSlot={slotProps?.root}
      className={className}
      css={rootStyle}
      sx={sx}
    >
      <WithSx
        styles={[controlsStyle, filtersCss]}
        className={filtersProps.className}
      >
        {(className) => (
          <Filters
            {...filtersProps}
            className={className}
            data-ui="logo-orbit-filters"
            role="group"
            aria-label={copy.categories}
          >
            {[null, ...categories].map((categoryValue) => (
              <WithSx
                key={categoryValue ?? ''}
                styles={[buttonStyle, filterStyle, filterCss]}
                className={filterProps.className}
              >
                {(className) => (
                  <FilterButton
                    {...filterProps}
                    className={className}
                    type="button"
                    data-ui="logo-orbit-filter-button"
                    aria-pressed={category === categoryValue}
                    onClick={(event) => {
                      filterProps.onClick?.(event);
                      if (!event.defaultPrevented) {
                        returnFocus.current = null;
                        requestFilter(categoryValue);
                      }
                    }}
                  >
                    {categoryValue ?? copy.all}
                  </FilterButton>
                )}
              </WithSx>
            ))}
          </Filters>
        )}
      </WithSx>
      {!staticList && (
        <WithSx
          styles={[buttonStyle, pauseCss]}
          className={pauseProps.className}
        >
          {(className) => (
            <PauseButton
              {...pauseProps}
              className={className}
              type="button"
              data-ui="logo-orbit-pause-button"
              aria-pressed={stopped}
              disabled={!!reduce || rate === 0}
              onClick={(event) => {
                pauseProps.onClick?.(event);
                if (!event.defaultPrevented) requestPause(!stopped);
              }}
            >
              {stopped ? copy.resume : copy.pause}
            </PauseButton>
          )}
        </WithSx>
      )}
      <WithSx styles={[stageStyle, stageCss]} className={stageProps.className}>
        {(className) => (
          <Stage
            {...stageProps}
            className={className}
            data-ui="logo-orbit-stage"
            data-list={staticList}
            ref={(node) => {
              stage.current = node;
              const cleanup =
                typeof stageRef === 'function' ? stageRef(node) : undefined;
              if (stageRef && typeof stageRef !== 'function')
                stageRef.current = node;
              return () => {
                stage.current = null;
                if (typeof cleanup === 'function') cleanup();
                else if (typeof stageRef === 'function') stageRef(null);
                else if (stageRef) stageRef.current = null;
              };
            }}
            onPointerEnter={(event) => {
              stageProps.onPointerEnter?.(event);
              setResting(true);
            }}
            onPointerLeave={(event) => {
              stageProps.onPointerLeave?.(event);
              if (
                !event.currentTarget.contains(
                  event.currentTarget.ownerDocument.activeElement,
                )
              )
                setResting(false);
            }}
            onFocusCapture={(event) => {
              stageProps.onFocusCapture?.(event);
              setResting(true);
            }}
            onBlurCapture={(event) => {
              stageProps.onBlurCapture?.(event);
              if (
                !event.currentTarget.contains(event.relatedTarget) &&
                !event.currentTarget.matches(':hover')
              )
                setResting(false);
            }}
          >
            {!staticList && (
              <WithSx
                styles={[centerStyle, centerCss]}
                className={centerProps.className}
              >
                {(className) => (
                  <Center
                    {...centerProps}
                    className={className}
                    data-ui="logo-orbit-center"
                    aria-hidden="true"
                    inert
                  >
                    {center}
                  </Center>
                )}
              </WithSx>
            )}
            <WithSx
              styles={[listStyle, listCss]}
              className={listProps.className}
            >
              {(className) => (
                <List
                  {...listProps}
                  className={className}
                  data-ui="logo-orbit-list"
                  data-list={staticList}
                  aria-label={listProps['aria-label'] ?? label}
                >
                  {matches.map((item, index) => (
                    <WithSx
                      key={item.id}
                      styles={itemCss}
                      className={itemProps.className}
                    >
                      {(className) => (
                        <Item
                          {...itemProps}
                          className={className}
                          data-ui="logo-orbit-item"
                        >
                          <OrbitPosition
                            angle={angle}
                            index={index}
                            count={matches.length}
                            staticList={staticList}
                            width={stageWidth}
                            height={stageHeight}
                          >
                            <WithSx
                              styles={[buttonStyle, logoStyle, logoCss]}
                              className={logoProps.className}
                            >
                              {(className) => (
                                <LogoButton
                                  {...logoProps}
                                  className={className}
                                  type="button"
                                  data-ui="logo-orbit-logo-button"
                                  ref={(node) => {
                                    if (node)
                                      buttons.current.set(item.id, node);
                                    else buttons.current.delete(item.id);
                                    const cleanup =
                                      typeof logoProps.ref === 'function'
                                        ? logoProps.ref(node)
                                        : undefined;
                                    if (
                                      logoProps.ref &&
                                      typeof logoProps.ref !== 'function'
                                    )
                                      logoProps.ref.current = node;
                                    return () => {
                                      buttons.current.delete(item.id);
                                      if (typeof cleanup === 'function')
                                        cleanup();
                                      else if (
                                        typeof logoProps.ref === 'function'
                                      )
                                        logoProps.ref(null);
                                      else if (logoProps.ref)
                                        logoProps.ref.current = null;
                                    };
                                  }}
                                  aria-label={item.name}
                                  aria-pressed={selected === item.id}
                                  tabIndex={currentFocus === item.id ? 0 : -1}
                                  onFocus={(event) => {
                                    logoProps.onFocus?.(event);
                                    setFocused(item.id);
                                  }}
                                  onClick={(event) => {
                                    logoProps.onClick?.(event);
                                    if (!event.defaultPrevented)
                                      select(
                                        selected === item.id ? null : item.id,
                                      );
                                  }}
                                  onKeyDown={(event) => {
                                    logoProps.onKeyDown?.(event);
                                    if (event.defaultPrevented) return;
                                    if (
                                      event.key === 'Escape' &&
                                      selected != null
                                    ) {
                                      event.preventDefault();
                                      returnFocus.current = item.id;
                                      requestSelection(null);
                                      return;
                                    }
                                    const list =
                                      event.currentTarget.closest<HTMLElement>(
                                        '[data-ui~="logo-orbit-list"]',
                                      );
                                    if (list)
                                      moveRovingFocus(
                                        event,
                                        list,
                                        ['ArrowUp', 'ArrowDown'].includes(
                                          event.key,
                                        )
                                          ? 'vertical'
                                          : 'horizontal',
                                        {
                                          itemSelector:
                                            '[data-ui~="logo-orbit-logo-button"]',
                                          ownerSelector:
                                            '[data-ui~="logo-orbit-list"]',
                                        },
                                      );
                                  }}
                                >
                                  <span aria-hidden="true" inert>
                                    {item.logo}
                                  </span>
                                  {staticList && item.name}
                                </LogoButton>
                              )}
                            </WithSx>
                          </OrbitPosition>
                        </Item>
                      )}
                    </WithSx>
                  ))}
                </List>
              )}
            </WithSx>
            {!matches.length && <p>{copy.empty}</p>}
          </Stage>
        )}
      </WithSx>
      {detail && (
        <WithSx
          styles={[detailStyle, detailCss]}
          className={detailProps.className}
        >
          {(className) => (
            <Detail
              {...detailProps}
              className={className}
              data-ui="logo-orbit-detail"
              aria-labelledby={[titleId, detailProps['aria-labelledby']]
                .filter(Boolean)
                .join(' ')}
              onKeyDown={(event) => {
                detailProps.onKeyDown?.(event);
                if (!event.defaultPrevented && event.key === 'Escape') {
                  event.preventDefault();
                  event.stopPropagation();
                  returnFocus.current = detail.id;
                  requestSelection(null);
                }
              }}
            >
              <motion.div
                initial={false}
                animate={{ opacity: 1 }}
                transition={{
                  duration: reduce ? 0 : motionDurationMs.base / 1000,
                }}
              >
                <div id={titleId}>{detail.name}</div>
              </motion.div>
              {detail.description != null && <div>{detail.description}</div>}
              <p>{detail.connected ? copy.connected : copy.unconnected}</p>
              {onConnect && !detail.connected && (
                <WithSx
                  styles={[buttonStyle, connectCss]}
                  className={connectProps.className}
                >
                  {(className) => (
                    <ConnectButton
                      {...connectProps}
                      className={className}
                      type="button"
                      data-ui="logo-orbit-connect-button"
                      aria-disabled={pending !== null}
                      aria-busy={pending === detail.id}
                      onClick={(event) => {
                        connectProps.onClick?.(event);
                        if (!event.defaultPrevented) void connect(detail);
                      }}
                    >
                      {pending === detail.id
                        ? copy.connecting
                        : error === detail.id
                          ? copy.retry
                          : copy.connect}
                    </ConnectButton>
                  )}
                </WithSx>
              )}
              {safeUrl(detail.href) && (
                <WithSx
                  styles={[linkStyle, docsCss]}
                  className={docsProps.className}
                >
                  {(className) => (
                    <DocsLink
                      {...docsProps}
                      className={className}
                      data-ui="logo-orbit-docs-link"
                      href={safeUrl(detail.href)}
                    >
                      {copy.docs}
                    </DocsLink>
                  )}
                </WithSx>
              )}
              <WithSx
                styles={[buttonStyle, previousCss]}
                className={previousProps.className}
              >
                {(className) => (
                  <PreviousButton
                    {...previousProps}
                    className={className}
                    type="button"
                    data-ui="logo-orbit-previous-button"
                    disabled={!matches.length}
                    onClick={(event) => {
                      previousProps.onClick?.(event);
                      if (!event.defaultPrevented) moveSelection(-1);
                    }}
                  >
                    {copy.previous}
                  </PreviousButton>
                )}
              </WithSx>
              <WithSx
                styles={[buttonStyle, nextCss]}
                className={nextProps.className}
              >
                {(className) => (
                  <NextButton
                    {...nextProps}
                    className={className}
                    type="button"
                    data-ui="logo-orbit-next-button"
                    disabled={!matches.length}
                    onClick={(event) => {
                      nextProps.onClick?.(event);
                      if (!event.defaultPrevented) moveSelection(1);
                    }}
                  >
                    {copy.next}
                  </NextButton>
                )}
              </WithSx>
              <WithSx
                styles={[buttonStyle, closeCss]}
                className={closeProps.className}
              >
                {(className) => (
                  <CloseButton
                    {...closeProps}
                    className={className}
                    type="button"
                    data-ui="logo-orbit-close-button"
                    onClick={(event) => {
                      closeProps.onClick?.(event);
                      if (!event.defaultPrevented) select(null);
                    }}
                  >
                    {copy.close}
                  </CloseButton>
                )}
              </WithSx>
            </Detail>
          )}
        </WithSx>
      )}
      {status && (
        <WithSx
          styles={[statusStyle, statusCss]}
          className={statusProps.className}
        >
          {(className) => (
            <Status
              {...statusProps}
              className={className}
              data-ui="logo-orbit-status"
              role="status"
              aria-atomic="true"
            >
              {status}
            </Status>
          )}
        </WithSx>
      )}
    </GeneratedRoot>
  );
}
LogoOrbit.displayName = 'LogoOrbit';
