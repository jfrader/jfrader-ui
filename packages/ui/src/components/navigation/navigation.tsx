'use client';

// App-shell navigation. A labelled <nav> landmark holds groups; each group is an optional
// label plus a <ul> of items, and the list is labelled by the group label. Items are native
// links when they have an href and plain text otherwise. The current page carries
// aria-current="page"; selection is also shown by weight and background, never color alone.
// No keyboard map beyond native Tab order through the links.
//
// Collapsible groups render a native <details>/<summary>: Enter/Space on the summary toggle it
// natively, and the browser owns the open state. Groups render closed (including under SSR)
// unless `defaultOpen` sets the initial `open` attribute; the attribute is never synced back.
// Collapsible groups require a renderable label; an unnamed disclosure throws at runtime.
// Non-collapsible groups render a <section> whose label is an <h2>; place the navigation where
// a level-two heading fits the page outline.
//
// Disabled items lose their href (a link keeps role="link" with aria-disabled="true"), force
// tabIndex=-1, and prevent clicks without invoking the consumer's handler.
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  type AnchorHTMLAttributes,
  type CSSProperties,
  type ComponentPropsWithRef,
  type ComponentType,
  type KeyboardEvent,
  type MouseEvent,
  type MouseEventHandler,
  type ReactNode,
  type Ref,
  type RefAttributes,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { disclosureCaret } from '../../styling/disclosure-caret';
import { focusRingInset } from '../../styling/focus-ring';
import { iconWrapperStyle } from '../../styling/icon-wrapper';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { translucentControlStyle } from '../../styling/surface';
import { isRenderable } from '../../utils/renderable';

const tokens = (...values: Array<unknown>): string | undefined => {
  const list = [...new Set(values.flatMap((v) => (typeof v === 'string' ? v.split(/\s+/) : [])))].filter(Boolean);
  return list.join(' ') || undefined;
};

export type NavigationItemRecord = Readonly<{
  key?: string;
  href?: string;
  label: ReactNode;
  disabled?: boolean;
  icon?: ReactNode;
  description?: ReactNode;
  active?: boolean;
  target?: string;
  rel?: string;
  onClick?: MouseEventHandler<HTMLElement>;
  id?: string;
  className?: string;
  style?: CSSProperties;
  sx?: SxProps['sx'];
  'aria-current'?: 'page' | 'step' | 'location' | 'date' | 'time' | 'true' | 'false';
  'aria-label'?: string;
}>;

export type NavigationGroupRecord = Readonly<{
  key?: string;
  label?: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  columns?: 1 | 2;
  active?: boolean;
  items: readonly NavigationItemRecord[];
  className?: string;
  style?: CSSProperties;
  sx?: SxProps['sx'];
}>;

export interface NavigationSlots {
  /** Replaces the root landmark container; renders a `nav` by default. */
  root?: ComponentType<ComponentPropsWithRef<'nav'>>;
  /** Replaces the section container grouping navigation items. */
  group?: ComponentType<NavigationGroupProps>;
  /** Replaces an individual navigation link or item. */
  item?: ComponentType<NavigationItemProps>;
}

export interface NavigationSlotProps {
  /** Root landmark `<nav>` container element. */
  root?: Omit<ComponentPropsWithRef<'nav'>, 'children'> &
    SxProps & {

      [attribute: `data-${string}`]: unknown;
    };
  /** Section container element grouping navigation items. */
  group?: Partial<Omit<NavigationGroupProps, 'children' | 'label' | 'collapsible' | 'defaultOpen'>>;
  /** Link or item element inside a navigation group. */
  item?: Partial<Omit<NavigationItemProps, 'children' | 'href' | 'active' | 'disabled' | 'icon'>>;
}

export interface NavigationBaseProps extends Omit<ComponentPropsWithRef<'nav'>, 'children'>, SxProps {
  /** Accessible name of the navigation landmark. Defaults to 'Main'. */
  label?: string;
  /** Use a horizontal floating disclosure bar with `morph`; defaults to `sidebar`. */
  variant?: 'sidebar' | 'morph';
  /** Reduce the bar spacing. The application owns scroll-based changes. */
  compact?: boolean;
}

export interface NavigationComposedProps extends NavigationBaseProps {
  /** Compose groups and items directly instead of supplying `groups`. */
  children?: ReactNode;
  groups?: never;
  activeHref?: never;
  component?: never;
  slots?: never;
  slotProps?: never;
}

export interface NavigationShorthandProps extends NavigationBaseProps {
  /** Accessible name of the navigation landmark. Defaults to 'Main'. */
  label?: string;
  /** Navigation groups rendered in order. */
  groups: readonly NavigationGroupRecord[];
  /** Mark the item matching this href as active (aria-current="page"). */
  activeHref?: string;
  children?: never;
  /** Replace the root `nav`; takes precedence over `slots.root`. */
  component?: NavigationSlots['root'];
  /** Replace the generated root, groups, or items. */
  slots?: NavigationSlots;
  /** Pass props and `sx` to the generated root, groups, and items. */
  slotProps?: NavigationSlotProps;
}

export type NavigationProps = NavigationComposedProps | NavigationShorthandProps;

export interface NavigationGroupProps extends ComponentPropsWithRef<'section'>, SxProps {
  /** Name the group heading or disclosure trigger; required when `collapsible` is true. */
  label?: ReactNode;
  /** Render as a native <details> disclosure; the label becomes its <summary>. */
  collapsible?: boolean;
  /** Initial `open` attribute of a collapsible group. The browser owns the state afterwards. */
  defaultOpen?: boolean;
  /** Number of link columns in a morph disclosure; narrow screens use one. */
  columns?: 1 | 2;
  /** Mark this disclosure as the current site section, not the current page. */
  active?: boolean;
}

// Renders an <a> or a <span>, so the ref is typed as the common HTMLElement.
export interface NavigationItemProps extends AnchorHTMLAttributes<HTMLElement>, RefAttributes<HTMLElement>, SxProps {
  /** Set the link destination; without it, render a non-link item. */
  href?: string;
  /** Marks the current page (aria-current="page"). */
  active?: boolean;
  /** Remove the link destination and block activation. Defaults to false. */
  disabled?: boolean;
  /** Leading icon, hidden from assistive technology. */
  icon?: ReactNode;
  /** Supporting text below the destination label. */
  description?: ReactNode;
}

const NavigationContext = createContext<'sidebar' | 'morph'>('sidebar');
const disclosureGroups = (nav: HTMLElement) => Array.from(nav.querySelectorAll<HTMLDetailsElement>('details[data-ui="navigation-group"]'))
  .filter((group) => group.closest('nav') === nav);

const ITEM_MIN_BLOCK_SIZE = vars.space[8];
const LABEL_TRACKING = '0.06em';

const rootStyle = css({
  display: 'grid',
  minInlineSize: 0,
  overflowWrap: 'anywhere',
  gap: vars.space[4],
  fontFamily: vars.font.sans,
});

const morphStyle = css({
  position: 'relative',
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[2],
  padding: vars.space[2],
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.xl,
  boxShadow: vars.shadow.overlay,
  transitionProperty: 'padding, gap',
  transitionDuration: vars.motion.duration.base,
  '&[data-compact="true"]': { padding: vars.space[1], gap: vars.space[1] },
  [REDUCED_MOTION]: { transitionDuration: '0s' },
  [FORCED_COLORS]: { borderColor: 'CanvasText' },
});
const morphGroupStyle = css({
  position: 'static',
  minInlineSize: 0,
  '& > [data-ui="navigation-group-label"]': { display: 'none' },
  '& > [data-ui="navigation-list"]': { display: 'flex', flexWrap: 'wrap' },
  '& > summary': { minBlockSize: vars.space[12], textTransform: 'none', letterSpacing: 'normal', fontSize: vars.textSize.sm },
  '& > summary[aria-current="location"]': { textDecoration: 'underline', textUnderlineOffset: vars.space[1] },
  '&[open] > [data-ui="navigation-list"]': {
    position: 'absolute',
    insetBlockStart: `calc(100% + ${vars.space[2]})`,
    insetInlineStart: 0,
    zIndex: 1,
    display: 'grid',
    gridTemplateColumns: 'repeat(var(--navigation-columns, 1), minmax(0, 1fr))',
    boxSizing: 'border-box',
    inlineSize: 'min(28rem, 100%)',
    maxBlockSize: '60dvh',
    overflowY: 'auto',
    padding: vars.space[2],
    backgroundColor: vars.color.surfaceRaised,
    border: `1px solid ${vars.color.borderControl}`,
    borderRadius: vars.radius.lg,
    boxShadow: vars.shadow.overlay,
  },
  '@media (max-width: 420px)': { '&[open] > [data-ui="navigation-list"]': { gridTemplateColumns: 'minmax(0, 1fr)' } },
  [FORCED_COLORS]: { '&[open] > [data-ui="navigation-list"]': { backgroundColor: 'Canvas', borderColor: 'CanvasText', boxShadow: 'none' } },
});
const morphItemStyle = css({
  minBlockSize: vars.space[12],
  '&[aria-current="page"]': { textDecoration: 'underline', textUnderlineOffset: vars.space[1] },
});
const itemTextStyle = css({ display: 'grid', gap: vars.space[1], minInlineSize: 0 });
const descriptionStyle = css({
  fontSize: vars.textSize.xs,
  color: vars.color.textMuted,
  fontWeight: vars.fontWeight.regular,
  [FORCED_COLORS]: { color: 'inherit' },
});

const groupStyle = css({
  display: 'grid',
  gap: vars.space[1],
  '&[open] > summary::after': {
    transform: 'rotate(90deg)',
  },
  // The triangle points toward inline-end, so under RTL it turns the other way to point down.
  '&[open]:dir(rtl) > summary::after': {
    transform: 'rotate(-90deg)',
  },
});

const labelStyle = css({
  margin: 0,
  paddingBlock: vars.space[1],
  paddingInline: vars.space[3],
  fontSize: vars.textSize.xs,
  fontWeight: vars.fontWeight.medium,
  lineHeight: vars.lineHeight.tight,
  letterSpacing: LABEL_TRACKING,
  textTransform: 'uppercase',
  color: vars.color.textMuted,
});

const summaryStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: vars.space[2],
  inlineSize: '100%',
  boxSizing: 'border-box',
  minBlockSize: ITEM_MIN_BLOCK_SIZE,
  borderRadius: vars.radius.sm,
  cursor: 'pointer',
  listStyle: 'none',
  transitionProperty: 'background-color, color',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '&::-webkit-details-marker': {
    display: 'none',
  },
  '&::after': {
    ...disclosureCaret,
  },
  '&:hover': {
    backgroundColor: vars.color.surfaceHover,
    color: vars.color.text,
  },
  '&:focus-visible': {
    ...focusRingInset,
  },
  [REDUCED_MOTION]: {
    transitionDuration: '0s',
    '&::after': {
      transitionDuration: '0s',
    },
  },
  [FORCED_COLORS]: {
    '&::after': {
      forcedColorAdjust: 'none',
      color: 'ButtonText',
    },
  },
});

const listStyle = css({
  display: 'grid',
  gap: vars.space[1],
  margin: 0,
  padding: 0,
  listStyle: 'none',
});

const itemStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: vars.space[2],
  minBlockSize: ITEM_MIN_BLOCK_SIZE,
  paddingInline: vars.space[3],
  borderRadius: vars.radius.sm,
  fontSize: vars.textSize.sm,
  lineHeight: vars.lineHeight.tight,
  color: vars.color.textMuted,
  textDecoration: 'none',
  transitionProperty: 'background-color, color',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '&:hover:not([aria-current="page"])': {
    backgroundColor: vars.color.surfaceHover,
    color: vars.color.text,
  },
  '&[aria-current="page"]': {
    backgroundColor: vars.color.accentSoft,
    color: vars.color.accentText,
    fontWeight: vars.fontWeight.medium,
  },
  '&[aria-disabled="true"]': {
    opacity: 0.55,
    pointerEvents: 'none',
  },
  '&:focus-visible': {
    ...focusRingInset,
  },
  [REDUCED_MOTION]: {
    transitionDuration: '0s',
  },
  [FORCED_COLORS]: {
    '&[aria-current="page"]': {
      forcedColorAdjust: 'none',
      backgroundColor: 'SelectedItem',
      color: 'SelectedItemText',
    },
  },
});

function NavigationRoot({
  ref,
  label = 'Main',
  className,
  sx,
  style,
  groups,
  activeHref,
  children,
  component,
  slots,
  slotProps,
  variant = 'sidebar',
  compact = false,
  ...rest
}: NavigationProps) {
  const isShorthandMode = groups !== undefined;
  const Root = slots?.root ?? component ?? 'nav';
  const Group = slots?.group ?? NavigationGroup;
  const Item = slots?.item ?? NavigationItem;

  const {
    className: rootSlotClassName,
    style: rootSlotStyle,
    sx: rootSlotSx,
    ref: rootSlotRef,
    'data-ui': rootSlotDataUi,
    ...rootSlotRest
  } = slotProps?.root ?? {};

  const navRef = useRef<HTMLElement>(null);
  const mergedRef = useMergeRefs([ref, rootSlotRef, navRef]);
  const mergedClassName = [rootSlotClassName, className].filter(Boolean).join(' ') || undefined;
  const mergedStyle = { ...style, ...rootSlotStyle };

  useEffect(() => {
    const nav = navRef.current;
    if (!nav || variant !== 'morph') return;
    const closeOutside = (event: Event) => {
      if (!nav.contains(event.target as Node)) disclosureGroups(nav).forEach((group) => { group.open = false; });
    };
    nav.ownerDocument.addEventListener('pointerdown', closeOutside);
    nav.ownerDocument.addEventListener('focusin', closeOutside);
    return () => {
      nav.ownerDocument.removeEventListener('pointerdown', closeOutside);
      nav.ownerDocument.removeEventListener('focusin', closeOutside);
    };
  }, [variant]);

  const keyboard = (event: KeyboardEvent<HTMLElement>) => {
    (rootSlotRest.onKeyDown ?? rest.onKeyDown)?.(event);
    const nav = navRef.current;
    if (event.defaultPrevented || !nav || variant !== 'morph') return;
    const target = event.target as HTMLElement;
    if (target.closest('nav') !== nav) return;
    const group = target.closest<HTMLDetailsElement>('details[data-ui="navigation-group"]');
    if (event.key === 'Escape' && group?.open) {
      event.preventDefault();
      group.open = false;
      group.querySelector('summary')?.focus();
      return;
    }
    if (target.matches('summary[data-ui="navigation-group-summary"]') && event.key === 'ArrowDown' && group) {
      event.preventDefault();
      disclosureGroups(nav).forEach((item) => { item.open = item === group; });
      group.querySelector<HTMLElement>('a[href]')?.focus();
      return;
    }
    if (group?.open && target.matches('a[data-ui="navigation-item"][href]') && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      const links = Array.from(group.querySelectorAll<HTMLElement>('a[data-ui="navigation-item"][href]'));
      const index = links.indexOf(target);
      event.preventDefault();
      if (event.key === 'ArrowUp' && index === 0) group.querySelector('summary')?.focus();
      else links[index + (event.key === 'ArrowDown' ? 1 : -1)]?.focus();
      return;
    }
    const topItems = Array.from(nav.querySelectorAll<HTMLElement>('summary[data-ui="navigation-group-summary"], a[data-ui="navigation-item"][href]'))
      .filter((item) => item.closest('nav') === nav && (!item.closest('details') || item.tagName === 'SUMMARY'));
    const index = topItems.indexOf(target);
    if (index < 0) return;
    const rtl = getComputedStyle(nav).direction === 'rtl';
    const steps: Record<string, number> = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 };
    const step = steps[event.key];
    const destination = event.key === 'Home' ? topItems[0] : event.key === 'End' ? topItems.at(-1)
      : step !== undefined ? topItems[(index + step + topItems.length) % topItems.length] : undefined;
    if (destination) {
      event.preventDefault();
      const disclosures = disclosureGroups(nav);
      if (disclosures.some((item) => item.open)) {
        const destinationGroup = destination.closest('details');
        disclosures.forEach((item) => { item.open = item === destinationGroup; });
      }
      destination.focus();
    }
  };
  const click = (event: MouseEvent<HTMLElement>) => {
    (rootSlotRest.onClick ?? rest.onClick)?.(event);
    const nav = navRef.current;
    if (event.defaultPrevented || !nav || variant !== 'morph') return;
    const target = event.target as HTMLElement;
    if (target.closest('nav') !== nav) return;
    const summary = target.closest('summary[data-ui="navigation-group-summary"]');
    const link = target.closest('a[href]');
    if (summary || link) disclosureGroups(nav).forEach((group) => {
      if (!summary || !group.contains(summary)) group.open = false;
    });
  };

  return (
    <NavigationContext.Provider value={variant}>
    <WithSx className={mergedClassName} styles={[rootStyle, variant === 'morph' && morphStyle, variant === 'morph' && translucentControlStyle, rootSlotSx]} sx={sx}>
      {(resolvedClassName) => (
        <Root
          {...rest}
          {...rootSlotRest}
          ref={mergedRef}
          aria-label={rootSlotRest['aria-label'] ?? rest['aria-label'] ?? label}
          data-ui={tokens('navigation', rootSlotDataUi) ?? 'navigation'}
          data-variant={variant}
          data-compact={compact}
          style={mergedStyle}
          className={resolvedClassName}
          onKeyDown={keyboard}
          onClick={click}
        >
          {isShorthandMode ? (
            groups.map((group, groupIndex) => {
              const groupKey = group.key ?? (typeof group.label === 'string' ? group.label : groupIndex);
              const {
                className: groupSlotClassName,
                sx: groupSlotSx,
                style: groupSlotStyle,
                ...groupSlotRest
              } = slotProps?.group ?? {};
              const mergedGroupClassName = [groupSlotClassName, group.className].filter(Boolean).join(' ') || undefined;
              const mergedGroupStyle = { ...groupSlotStyle, ...group.style };
              return (
                <Group
                  key={groupKey}
                  {...groupSlotRest}
                  label={group.label}
                  collapsible={group.collapsible}
                  defaultOpen={group.defaultOpen}
                  columns={group.columns}
                  active={group.active ?? group.items.some((item) => item.active ?? (activeHref !== undefined && item.href === activeHref))}
                  className={mergedGroupClassName}
                  style={mergedGroupStyle}
                  css={groupSlotSx}
                  sx={group.sx}
                >
                  {group.items.map((item, itemIndex) => {
                    const itemKey = item.key ?? (item.href ?? (typeof item.label === 'string' ? item.label : itemIndex));
                    const isActive = item.active ?? (activeHref !== undefined && item.href !== undefined && item.href === activeHref);
                    const {
                      className: itemSlotClassName,
                      sx: itemSlotSx,
                      style: itemSlotStyle,
                      ...itemSlotRest
                    } = slotProps?.item ?? {};
                    const {
                      label: itemLabel,
                      href,
                      disabled,
                      icon,
                      description,
                      active: _a,
                      key: _k,
                      className: itemClassName,
                      style: itemStyleProp,
                      sx: itemCssProp,

                      ...itemRest
                    } = item;
                    const mergedItemClassName = [itemSlotClassName, itemClassName].filter(Boolean).join(' ') || undefined;
                    const mergedItemStyle = { ...itemSlotStyle, ...itemStyleProp };
                    return (
                      <Item
                        key={itemKey}
                        {...itemSlotRest}
                        {...itemRest}
                        href={href}
                        active={isActive}
                        disabled={disabled}
                        icon={icon}
                        description={description}
                        className={mergedItemClassName}
                        style={mergedItemStyle}
                        css={itemSlotSx}
                        sx={itemCssProp}
                      >
                        {itemLabel}
                      </Item>
                    );
                  })}
                </Group>
              );
            })
          ) : (
            children
          )}
        </Root>
      )}
    </WithSx>
    </NavigationContext.Provider>
  );
}

NavigationRoot.displayName = 'Navigation';

function NavigationGroup({
  ref,
  label,
  collapsible = false,
  defaultOpen,
  columns = 1,
  active = false,
  children,
  className,
  sx,
  ...rest
}: NavigationGroupProps) {
  const labelId = useId();
  const variant = useContext(NavigationContext);
  const hasLabel = isRenderable(label);
  if (collapsible && !hasLabel) {
    throw new Error('Navigation.Group requires a renderable label when collapsible is true.');
  }
  const list = (
    <ul data-ui="navigation-list" aria-labelledby={hasLabel ? labelId : undefined} css={listStyle}>
      {children}
    </ul>
  );

  return (
    <WithSx className={className} styles={[groupStyle, variant === 'morph' && morphGroupStyle]} sx={sx}>
      {(className) =>
        collapsible ? (
          <details
            {...rest}
            ref={ref as Ref<HTMLDetailsElement>}
            open={defaultOpen}
            style={{ ...rest.style, '--navigation-columns': columns } as CSSProperties}
            data-ui="navigation-group"
            className={className}
          >
            <summary id={labelId} aria-current={variant === 'morph' && active ? 'location' : undefined} data-ui="navigation-group-summary" css={[labelStyle, summaryStyle]}>
              {label}
            </summary>
            {list}
          </details>
        ) : (
          <section {...rest} ref={ref} data-ui="navigation-group" className={className}>
            {hasLabel && (
              <h2 id={labelId} data-ui="navigation-group-label" css={labelStyle}>
                {label}
              </h2>
            )}
            {list}
          </section>
        )
      }
    </WithSx>
  );
}

NavigationGroup.displayName = 'Navigation.Group';

function NavigationItem({
  ref,
  href,
  active = false,
  disabled = false,
  icon,
  description,
  children,
  className,
  sx,
  ...rest
}: NavigationItemProps) {
  const variant = useContext(NavigationContext);
  const isDisabled = disabled || rest['aria-disabled'] === true || rest['aria-disabled'] === 'true';
  const content = (
    <>
      {isRenderable(icon) && (
        <span aria-hidden="true" data-ui="navigation-item-icon" css={iconWrapperStyle}>
          {icon}
        </span>
      )}
      {isRenderable(description) ? <span css={itemTextStyle}>{children}<span css={descriptionStyle}>{description}</span></span> : children}
    </>
  );
  const state = {
    'aria-current': active ? ('page' as const) : rest['aria-current'],
    'aria-disabled': isDisabled || rest['aria-disabled'],
    tabIndex: isDisabled ? -1 : rest.tabIndex,
    onClick: isDisabled
      ? (event: MouseEvent<HTMLElement>) => {
          event.preventDefault();
        }
      : rest.onClick,
  };

  return (
    <li data-ui="navigation-list-item">
      <WithSx className={className} styles={[itemStyle, variant === 'morph' && morphItemStyle]} sx={sx}>
        {(className) =>
          href !== undefined ? (
            <a
              {...rest}
              {...state}
              ref={ref as Ref<HTMLAnchorElement>}
              href={isDisabled ? undefined : href}
              role={isDisabled ? 'link' : undefined}
              data-ui="navigation-item"
              className={className}
            >
              {content}
            </a>
          ) : (
            <span
              {...rest}
              {...state}
              ref={ref as Ref<HTMLSpanElement>}
              data-ui="navigation-item"
              className={className}
            >
              {content}
            </span>
          )
        }
      </WithSx>
    </li>
  );
}

NavigationItem.displayName = 'Navigation.Item';

export const Navigation = Object.assign(NavigationRoot, { Group: NavigationGroup, Item: NavigationItem });
