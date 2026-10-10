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
  forwardRef,
  useId,
  type AnchorHTMLAttributes,
  type HTMLAttributes,
  type MouseEvent,
  type ReactNode,
  type Ref,
} from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { disclosureCaret } from '../../styling/disclosure-caret';
import { focusRingInset } from '../../styling/focus-ring';
import { iconWrapperStyle } from '../../styling/icon-wrapper';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { isRenderable } from '../../utils/renderable';

export interface NavigationProps extends HTMLAttributes<HTMLElement> {
  /** Accessible name of the navigation landmark. */
  label?: string;
}

export interface NavigationGroupProps extends HTMLAttributes<HTMLElement> {
  label?: ReactNode;
  /** Render as a native <details> disclosure; the label becomes its <summary>. */
  collapsible?: boolean;
  /** Initial `open` attribute of a collapsible group. The browser owns the state afterwards. */
  defaultOpen?: boolean;
}

export interface NavigationItemProps extends AnchorHTMLAttributes<HTMLElement> {
  href?: string;
  /** Marks the current page (aria-current="page"). */
  active?: boolean;
  disabled?: boolean;
  /** Decorative leading icon, hidden from assistive tech. */
  icon?: ReactNode;
}

const ITEM_MIN_BLOCK_SIZE = vars.space[8];
const LABEL_TRACKING = '0.06em';

const rootStyle = css({
  display: 'grid',
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

const Root = forwardRef<HTMLElement, NavigationProps>(function Navigation({ label = 'Main', ...rest }, ref) {
  return <nav {...rest} ref={ref} aria-label={label} data-ui="navigation" css={rootStyle} />;
});

const Group = forwardRef<HTMLElement, NavigationGroupProps>(function NavigationGroup(
  { label, collapsible = false, defaultOpen, children, ...rest },
  ref,
) {
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

  if (collapsible) {
    return (
      <details
        {...rest}
        ref={ref as Ref<HTMLDetailsElement>}
        open={defaultOpen}
        data-ui="navigation-group"
        css={groupStyle}
      >
        <summary id={labelId} data-ui="navigation-group-summary" css={[labelStyle, summaryStyle]}>
          {label}
        </summary>
        {list}
      </details>
    );
  }

  return (
    <section {...rest} ref={ref} data-ui="navigation-group" css={groupStyle}>
      {hasLabel && (
        <h2 id={labelId} data-ui="navigation-group-label" css={labelStyle}>
          {label}
        </h2>
      )}
      {list}
    </section>
  );
});

const Item = forwardRef<HTMLElement, NavigationItemProps>(function NavigationItem(
  { href, active = false, disabled = false, icon, children, ...rest },
  ref,
) {
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
    'aria-current': active ? ('page' as const) : undefined,
    'aria-disabled': disabled || undefined,
    tabIndex: disabled ? -1 : rest.tabIndex,
    onClick: disabled
      ? (event: MouseEvent<HTMLElement>) => {
          event.preventDefault();
        }
      : rest.onClick,
  };

  return (
    <li data-ui="navigation-list-item">
      {href !== undefined ? (
        <a
          {...rest}
          {...state}
          ref={ref as Ref<HTMLAnchorElement>}
          href={disabled ? undefined : href}
          role={disabled ? 'link' : undefined}
          data-ui="navigation-item"
          css={itemStyle}
        >
          {content}
        </a>
      ) : (
        <span {...rest} {...state} ref={ref as Ref<HTMLSpanElement>} data-ui="navigation-item" css={itemStyle}>
          {content}
        </span>
      )}
    </li>
  );
});

export const Navigation = Object.assign(Root, { Group, Item });
