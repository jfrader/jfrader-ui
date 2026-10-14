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
  useId,
  type AnchorHTMLAttributes,
  type CSSProperties,
  type ComponentPropsWithRef,
  type ComponentType,
  type MouseEvent,
  type MouseEventHandler,
  type ReactNode,
  type Ref,
  type RefAttributes,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { disclosureCaret } from '../../styling/disclosure-caret';
import { focusRingInset } from '../../styling/focus-ring';
import { iconWrapperStyle } from '../../styling/icon-wrapper';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
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
  active?: boolean;
  target?: string;
  rel?: string;
  onClick?: MouseEventHandler<HTMLElement>;
  id?: string;
  className?: string;
  style?: CSSProperties;
  css?: Interpolation<Theme>;
  sx?: SxProps['sx'];
  'aria-current'?: 'page' | 'step' | 'location' | 'date' | 'time' | 'true' | 'false';
  'aria-label'?: string;
}>;

export type NavigationGroupRecord = Readonly<{
  key?: string;
  label?: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  items: readonly NavigationItemRecord[];
  className?: string;
  style?: CSSProperties;
  css?: Interpolation<Theme>;
  sx?: SxProps['sx'];
}>;

export interface NavigationSlots {
  root?: ComponentType<ComponentPropsWithRef<'nav'>>;
  group?: ComponentType<NavigationGroupProps>;
  item?: ComponentType<NavigationItemProps>;
}

export interface NavigationSlotProps {
  root?: Omit<ComponentPropsWithRef<'nav'>, 'children'> &
    SxProps & {
      css?: Interpolation<Theme>;
      [attribute: `data-${string}`]: unknown;
    };
  group?: Partial<Omit<NavigationGroupProps, 'children' | 'label' | 'collapsible' | 'defaultOpen'>> & { css?: Interpolation<Theme> };
  item?: Partial<Omit<NavigationItemProps, 'children' | 'href' | 'active' | 'disabled' | 'icon'>> & { css?: Interpolation<Theme> };
}

export interface NavigationBaseProps extends Omit<ComponentPropsWithRef<'nav'>, 'children'>, SxProps {
  /** Accessible name of the navigation landmark. Defaults to 'Main'. */
  label?: string;
}

export interface NavigationCompoundProps extends NavigationBaseProps {
  children?: ReactNode;
  groups?: never;
  activeHref?: never;
  component?: never;
  slots?: never;
  slotProps?: never;
}

export interface NavigationEasyProps extends NavigationBaseProps {
  /** Accessible name of the navigation landmark. Defaults to 'Main'. */
  label?: string;
  /** Navigation groups rendered in order. */
  groups: readonly NavigationGroupRecord[];
  /** Mark the item matching this href as active (aria-current="page"). */
  activeHref?: string;
  children?: never;
  component?: NavigationSlots['root'];
  slots?: NavigationSlots;
  slotProps?: NavigationSlotProps;
}

export type NavigationProps = NavigationCompoundProps | NavigationEasyProps;

export interface NavigationGroupProps extends ComponentPropsWithRef<'section'>, SxProps {
  label?: ReactNode;
  /** Render as a native <details> disclosure; the label becomes its <summary>. */
  collapsible?: boolean;
  /** Initial `open` attribute of a collapsible group. The browser owns the state afterwards. */
  defaultOpen?: boolean;
}

// Renders an <a> or a <span>, so the ref is typed as the common HTMLElement.
export interface NavigationItemProps extends AnchorHTMLAttributes<HTMLElement>, RefAttributes<HTMLElement>, SxProps {
  href?: string;
  /** Marks the current page (aria-current="page"). */
  active?: boolean;
  disabled?: boolean;
  /** Leading icon, hidden from assistive technology. */
  icon?: ReactNode;
}

const ITEM_MIN_BLOCK_SIZE = vars.space[8];
const LABEL_TRACKING = '0.06em';

const rootStyle = css({
  display: 'grid',
  minInlineSize: 0,
  overflowWrap: 'anywhere',
  gap: vars.space[4],
  fontFamily: vars.font.sans,
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
  ...rest
}: NavigationProps) {
  const isEasyMode = groups !== undefined;
  const Root = component ?? slots?.root ?? 'nav';
  const Group = slots?.group ?? NavigationGroup;
  const Item = slots?.item ?? NavigationItem;

  const {
    className: rootSlotClassName,
    style: rootSlotStyle,
    css: rootSlotCss,
    sx: rootSlotSx,
    ref: rootSlotRef,
    'data-ui': rootSlotDataUi,
    ...rootSlotRest
  } = slotProps?.root ?? {};

  const mergedRef = useMergeRefs([ref, rootSlotRef]);
  const mergedClassName = [rootSlotClassName, className].filter(Boolean).join(' ') || undefined;
  const mergedStyle = { ...style, ...rootSlotStyle };

  return (
    <WithSx className={mergedClassName} styles={[rootStyle, rootSlotCss, rootSlotSx]} sx={sx}>
      {(resolvedClassName) => (
        <Root
          {...rest}
          {...rootSlotRest}
          ref={mergedRef}
          aria-label={rootSlotRest['aria-label'] ?? rest['aria-label'] ?? label}
          data-ui={tokens('navigation', rootSlotDataUi) ?? 'navigation'}
          style={mergedStyle}
          className={resolvedClassName}
        >
          {isEasyMode ? (
            groups.map((group, groupIndex) => {
              const groupKey = group.key ?? (typeof group.label === 'string' ? group.label : groupIndex);
              const {
                className: groupSlotClassName,
                css: groupSlotCss,
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
                  className={mergedGroupClassName}
                  style={mergedGroupStyle}
                  css={[groupSlotCss, groupSlotSx, group.css]}
                  sx={group.sx}
                >
                  {group.items.map((item, itemIndex) => {
                    const itemKey = item.key ?? (item.href ?? (typeof item.label === 'string' ? item.label : itemIndex));
                    const isActive = item.active ?? (activeHref !== undefined && item.href !== undefined && item.href === activeHref);
                    const {
                      className: itemSlotClassName,
                      css: itemSlotCss,
                      sx: itemSlotSx,
                      style: itemSlotStyle,
                      ...itemSlotRest
                    } = slotProps?.item ?? {};
                    const {
                      label: itemLabel,
                      href,
                      disabled,
                      icon,
                      active: _a,
                      key: _k,
                      className: itemClassName,
                      style: itemStyleProp,
                      css: itemCssProp,
                      sx: itemSxProp,
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
                        className={mergedItemClassName}
                        style={mergedItemStyle}
                        css={[itemSlotCss, itemSlotSx, itemCssProp]}
                        sx={itemSxProp}
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
  );
}

NavigationRoot.displayName = 'Navigation';

function NavigationGroup({
  ref,
  label,
  collapsible = false,
  defaultOpen,
  children,
  className,
  sx,
  ...rest
}: NavigationGroupProps) {
  const labelId = useId();
  const hasLabel = isRenderable(label);
  if (collapsible && !hasLabel) {
    throw new Error('Navigation.Group requires a renderable label when collapsible is true.');
  }
  const list = (
    <ul aria-labelledby={hasLabel ? labelId : undefined} css={listStyle}>
      {children}
    </ul>
  );

  return (
    <WithSx className={className} styles={groupStyle} sx={sx}>
      {(className) =>
        collapsible ? (
          <details
            {...rest}
            ref={ref as Ref<HTMLDetailsElement>}
            open={defaultOpen}
            data-ui="navigation-group"
            className={className}
          >
            <summary id={labelId} data-ui="navigation-group-summary" css={[labelStyle, summaryStyle]}>
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
  children,
  className,
  sx,
  ...rest
}: NavigationItemProps) {
  const isDisabled = disabled || rest['aria-disabled'] === true || rest['aria-disabled'] === 'true';
  const content = (
    <>
      {isRenderable(icon) && (
        <span aria-hidden="true" data-ui="navigation-item-icon" css={iconWrapperStyle}>
          {icon}
        </span>
      )}
      {children}
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
      <WithSx className={className} styles={itemStyle} sx={sx}>
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
