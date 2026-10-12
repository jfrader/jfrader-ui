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
  type ComponentPropsWithRef,
  type MouseEvent,
  type ReactNode,
  type Ref,
  type RefAttributes,
} from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { disclosureCaret } from '../../styling/disclosure-caret';
import { focusRingInset } from '../../styling/focus-ring';
import { iconWrapperStyle } from '../../styling/icon-wrapper';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { isRenderable } from '../../utils/renderable';

export interface NavigationProps extends ComponentPropsWithRef<'nav'>, SxProps {
  /** Accessible name of the navigation landmark. */
  label?: string;
}

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
  /** Decorative leading icon, hidden from assistive tech. */
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

function NavigationRoot({ ref, label = 'Main', className, sx, ...rest }: NavigationProps) {
  return (
    <WithSx className={className} styles={rootStyle} sx={sx}>
      {(className) => (
        <nav {...rest} ref={ref} aria-label={rest['aria-label'] ?? label} data-ui="navigation" className={className} />
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
