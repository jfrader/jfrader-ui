'use client';

// LocaleSwitcher: links to the current page in other languages. Locale-agnostic: the consumer
// passes the options (native-name labels, `lang`, `href`) and the current `value`.
// Every option renders through one path: an <a href> carrying `lang`, `hreflang` and dir="auto",
// with aria-current="true" on the current option. Never a button or a native <select>.
// Variants:
// - menu: APG menu button whose items are the links (navigation menu button), on the shared menu
//   controller. The trigger shows the current label and is named by `triggerLabel` followed by
//   that label; the menu is named by `triggerLabel`. Keyboard map (Menu contract): on the trigger,
//   Enter/Space/ArrowDown open on the first item and ArrowUp on the last; in the menu, arrows move
//   and wrap, Home/End jump, typing jumps by native name, Enter follows the link and Space clicks
//   it, Escape closes and returns focus to the trigger, Tab closes and lets focus move on.
// - swap: a single link to the other option (two-language sites). With any other option count it
//   warns in development and links to the first option that is not current.
// - inline: a labelled <nav> listing every option; the current one is plain text
//   (<span aria-current="true">), the others are links in native Tab order.
// - pills: the inline structure drawn as a bordered pill group; the current option is filled
//   with the accent.
import {
  useEffect,
  useId,
  type ComponentPropsWithoutRef,
  type ComponentPropsWithRef,
  type ComponentType,
  type HTMLAttributes,
  type ReactNode,
  type RefCallback,
} from 'react';
import { useMergeRefs, type Placement } from '@floating-ui/react';
import { Check, ChevronDown, Globe } from '@jfrader/icons';
import { vars } from '@jfrader/tokens/vars';
import { controlBlockSize, controlSizeStyles, controlTextSize, controlTouchTargetStyles } from '../../styling/control-size';
import { css, type Interpolation, type SerializedStyles, type Theme } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { iconWrapperStyle } from '../../styling/icon-wrapper';
import { listboxOptionCheckStyle, listboxScrollStyle, listboxSurfaceStyle } from '../../styling/listbox-style';
import { COARSE_POINTER, FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { triggerStyle } from '../../styling/trigger-style';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { isRenderable } from '../../utils/renderable';
import { MenuContentPart, MenuController, MenuItemPart, MenuTriggerPart, joinIds, menuItemStyles, type MenuSlots } from '../menu/menu';

// Bundlers replace `process.env.NODE_ENV` in consumer builds; library mode leaves it in place.
declare const process: { env: { NODE_ENV?: string } };

const FAMILY = 'LocaleSwitcher';
const SELECTED_GLYPH = <Check size="inherit" decorative />;

export type LocaleSwitcherVariant = 'menu' | 'swap' | 'inline' | 'pills';
export type LocaleSwitcherSize = 'sm' | 'md' | 'lg';

/** Spread these props onto the link returned by an option's `render` callback. */
export interface LocaleSwitcherLinkProps extends Omit<ComponentPropsWithRef<'a'>, 'href' | 'children'> {
  href: string;
  children: ReactNode;
  'data-ui': string;
}

export interface LocaleSwitcherOption {
  value: string;
  /** Labels the language with its native name, such as "Español" or "English". */
  label: ReactNode;
  /** Names the option for assistive technology when `label` is a short code, such as "ES". */
  ariaLabel?: string;
  /** Sets the label and linked page's BCP 47 language tag through `lang` and `hreflang`. */
  lang?: string;
  href: string;
  /** Replaces the native `<a>` with a router link. Spread every supplied prop onto it. */
  render?: (props: LocaleSwitcherLinkProps) => ReactNode;
}

type SlotStyle = { className?: string; sx?: Interpolation<Theme> };

export interface LocaleSwitcherSlotProps {
  /** Menu variant's trigger button. */
  trigger?: Omit<ComponentPropsWithoutRef<'button'>, 'children' | 'className' | 'aria-labelledby'> & SlotStyle;
  /** Menu variant's popup. */
  content?: Omit<ComponentPropsWithoutRef<'div'>, 'children' | 'className'> & SlotStyle;
  /** Styles every option: menu items, the swap link, inline links, and the current label. Renders an `a` for links or a `span` for the current label by default. */
  option?: SlotStyle;
}

export interface LocaleSwitcherSlots extends Pick<MenuSlots, 'trigger' | 'content'> {
  /** Renders an `a` for links or a `span` for the current label by default. */
  option?: ComponentType<HTMLAttributes<HTMLElement> & {
    ref?: RefCallback<HTMLElement> | null;
    href?: string;
    hrefLang?: string;
  }>;
}

export interface LocaleSwitcherProps extends Omit<ComponentPropsWithRef<'nav'>, 'children'>, SxProps {
  /** Defines language labels and destination links in display order. Use two options for `'swap'`. */
  options: readonly LocaleSwitcherOption[];
  /** Identifies the current language option. */
  value: string;
  /** Sets the link layout. Defaults to `'menu'`. */
  variant?: LocaleSwitcherVariant;
  /** Sets the text and menu trigger size. Defaults to `'md'`. */
  size?: LocaleSwitcherSize;
  /** Names the menu trigger's action, such as "Change language". Read before the current label. */
  triggerLabel?: string;
  /** Names the navigation landmark in the inline and pills variants. */
  label?: string;
  /** Shows a decorative icon before the menu's current label. Defaults to a globe. `null` removes it. */
  icon?: ReactNode;
  /** Controls whether the menu is open. */
  open?: boolean;
  /** Sets the menu's initial uncontrolled open state. */
  defaultOpen?: boolean;
  /** Requests a menu open-state change. */
  onOpenChange?: (open: boolean) => void;
  /** Positions the menu relative to its trigger. Defaults to `'bottom-start'`. Applies only to `'menu'`. */
  placement?: Placement;
  /** Passes props and styles to the menu trigger, popup and language options. */
  slotProps?: LocaleSwitcherSlotProps;
  /** Replaces the menu trigger, popup and language option elements. */
  slots?: LocaleSwitcherSlots;
}

const rootStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  minInlineSize: 0,
  maxInlineSize: '100%',
  fontFamily: vars.font.sans,
  lineHeight: vars.lineHeight.tight,
  color: vars.color.text,
  overflowWrap: 'anywhere',
});

const rootSizeStyles: Record<LocaleSwitcherSize, SerializedStyles> = {
  sm: css({ fontSize: controlTextSize.sm }),
  md: css({ fontSize: controlTextSize.md }),
  lg: css({ fontSize: controlTextSize.lg }),
};

const triggerLayoutStyle = css({
  paddingBlock: 0,
  lineHeight: vars.lineHeight.tight,
  gap: vars.space[2],
  minInlineSize: 0,
  maxInlineSize: '100%',
  fontSize: 'inherit',
  whiteSpace: 'normal',
  '& > span[lang]': { minInlineSize: 0 },
});

const triggerSizeStyles: Record<LocaleSwitcherSize, SerializedStyles> = {
  sm: css(controlSizeStyles.sm, controlTouchTargetStyles.sm, { paddingInline: vars.space[3] }),
  md: css(controlSizeStyles.md, controlTouchTargetStyles.md, { paddingInline: vars.space[4] }),
  lg: css(controlSizeStyles.lg, controlTouchTargetStyles.lg, { paddingInline: vars.space[5] }),
};

const chevronStyle = css({
  display: 'inline-flex',
  flexShrink: 0,
  transitionProperty: 'transform',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '& svg': { inlineSize: '1em', blockSize: '1em' },
  '[aria-expanded="true"] > &': {
    transform: 'rotate(180deg)',
  },
  [REDUCED_MOTION]: {
    transitionDuration: '0s',
  },
});

const menuOptionStyle = css({
  gap: vars.space[2],
  textDecoration: 'none',
  '&[aria-current="true"]': {
    fontWeight: vars.fontWeight.medium,
  },
});

const checkStyle = css({
  marginInlineStart: 'auto',
});

const listStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[3],
  margin: 0,
  padding: 0,
  listStyle: 'none',
  minInlineSize: 0,
  maxInlineSize: '100%',
  '& > li': { minInlineSize: 0, maxInlineSize: '100%' },
});

const optionStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  minBlockSize: vars.space[8],
  maxInlineSize: '100%',
  borderRadius: vars.radius.sm,
});

const linkStyle = css({
  color: vars.color.accentText,
  textDecoration: 'underline',
  textUnderlineOffset: '0.2em',
  transitionProperty: 'color',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '&:hover': {
    color: vars.color.text,
  },
  '&:focus-visible': {
    ...focusRingOutset,
  },
  [REDUCED_MOTION]: {
    transitionDuration: '0s',
  },
});

const currentStyle = css({
  color: vars.color.text,
  fontWeight: vars.fontWeight.medium,
});

const pillsListStyle = css({
  display: 'inline-flex',
  flexWrap: 'wrap',
  boxSizing: 'border-box',
  minInlineSize: 0,
  maxInlineSize: '100%',
  alignItems: 'center',
  gap: `calc(${vars.space[1]} / 2)`,
  margin: 0,
  padding: `calc(${vars.space[1]} * 0.75)`,
  listStyle: 'none',
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.lg,
  backgroundColor: vars.color.surfaceRaised,
  '& > li': { display: 'flex', minInlineSize: 0, maxInlineSize: '100%' },
  [FORCED_COLORS]: { borderColor: 'CanvasText' },
});

const pillStyle = css({
  justifyContent: 'center',
  boxSizing: 'border-box',
  borderRadius: vars.radius.full,
  paddingBlock: `calc(${vars.space[1]} / 2)`,
  whiteSpace: 'normal',
});

// Outer pill heights match the menu trigger: pill + padding + border = 32 / 40 / 48px.
function pillBlockSize(size: LocaleSwitcherSize) {
  return css({
    minBlockSize: `calc(${controlBlockSize[size]} - ${vars.space[2]})`,
    [COARSE_POINTER]: { minBlockSize: `calc(max(${controlBlockSize[size]}, ${vars.size.touch}) - ${vars.space[2]})` },
  });
}
const pillSizeStyles: Record<LocaleSwitcherSize, SerializedStyles> = {
  sm: css(pillBlockSize('sm'), { minInlineSize: vars.space[10], paddingInline: vars.space[2] }),
  md: css(pillBlockSize('md'), { minInlineSize: vars.space[12], paddingInline: vars.space[3] }),
  lg: css(pillBlockSize('lg'), {
    minInlineSize: `calc(${vars.space[12]} + ${vars.space[2]})`,
    paddingInline: vars.space[3],
  }),
};

const pillLinkStyle = css({
  color: vars.color.textMuted,
  textDecoration: 'none',
  transitionProperty: 'color',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '&:hover': {
    color: vars.color.text,
  },
  '&:focus-visible': {
    ...focusRingOutset,
  },
  [REDUCED_MOTION]: {
    transitionDuration: '0s',
  },
});

const pillCurrentStyle = css({
  backgroundColor: vars.color.accent,
  color: vars.color.accentContrast,
  fontWeight: vars.fontWeight.medium,
  [FORCED_COLORS]: {
    forcedColorAdjust: 'none',
    backgroundColor: 'SelectedItem',
    color: 'SelectedItemText',
  },
});

const globe = <Globe size="inherit" decorative />;
const chevron = <ChevronDown size="inherit" decorative />;

interface OptionElementProps extends HTMLAttributes<HTMLElement> {
  slots?: Pick<LocaleSwitcherSlots, 'option'>;
  ref?: RefCallback<HTMLElement> | null;
  'data-ui': string;
  option: LocaleSwitcherOption;
  current: boolean;
  /** A link to the option's page; otherwise plain text (the current option in a list). */
  link: boolean;
  /** Decoration after the label. */
  adornment?: ReactNode;
}

/** The single rendering path of an option: lang, hreflang, dir and aria-current live here. */
function OptionElement({ option, current, link, adornment, slots, ...props }: OptionElementProps) {
  const Option = slots?.option ?? (link ? 'a' : 'span');
  // A short visible label (`ES`) keeps the full native name in the accessible name: the name is
  // appended after the code ("ES Español"), because a name that omits the visible text fails
  // label-in-name and `aria-label` is ignored on a plain span.
  const label = (
    <>
      {option.label}
      {adornment}
    </>
  );
  const children = option.ariaLabel ? (
    <>
      {label}{' '}
      <span css={visuallyHiddenStyle}>{option.ariaLabel}</span>
    </>
  ) : (
    label
  );
  const shared = {
    ...props,
    lang: option.lang,
    dir: 'auto',
    'aria-current': current ? ('true' as const) : undefined,
    children,
  };
  if (!link) return <Option {...shared} />;
  const linkProps = { ...shared, href: option.href, hrefLang: option.lang };
  return option.render ? option.render(linkProps) : <Option {...linkProps} />;
}

interface StyledOptionProps extends Omit<OptionElementProps, 'data-ui' | 'className' | 'slot'> {
  styles: Interpolation<Theme>;
  slot: SlotStyle | undefined;
}

function StyledOption({ styles, slot, ...props }: StyledOptionProps) {
  return (
    <WithSx className={slot?.className} styles={[optionStyle, styles, slot?.sx]}>
      {(className) => <OptionElement {...props} data-ui="locale-switcher-option" className={className} />}
    </WithSx>
  );
}

interface VariantProps
  extends Pick<
    LocaleSwitcherProps,
    'options' | 'value' | 'triggerLabel' | 'icon' | 'open' | 'defaultOpen' | 'onOpenChange' | 'placement' | 'slotProps' | 'slots'
  > {
  size: LocaleSwitcherSize;
  current: LocaleSwitcherOption | undefined;
}

function MenuVariant({
  options,
  value,
  current,
  size,
  triggerLabel,
  icon,
  open,
  defaultOpen,
  onOpenChange,
  placement,
  slotProps,
  slots,
}: VariantProps) {
  const id = useId();
  const actionId = `${id}-action`;
  const currentId = `${id}-current`;
  const { className: triggerClassName, sx: triggerCss, ...triggerAttributes } = slotProps?.trigger ?? {};
  const { className: contentClassName, sx: contentCss, ...contentAttributes } = slotProps?.content ?? {};
  const optionSlot = slotProps?.option;

  return (
    <MenuController open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange} placement={placement}>
      <MenuTriggerPart
        slots={slots}
        {...triggerAttributes}
        aria-labelledby={joinIds(triggerLabel ? actionId : undefined, current ? currentId : undefined)}
        family={FAMILY}
        marker="locale-switcher-trigger"
        styles={[triggerStyle, triggerLayoutStyle, triggerSizeStyles[size], triggerCss]}
        className={triggerClassName}
      >
        {triggerLabel && (
          <span id={actionId} css={visuallyHiddenStyle}>
            {triggerLabel}
          </span>
        )}
        {isRenderable(icon) && (
          <span aria-hidden="true" css={iconWrapperStyle}>
            {icon}
          </span>
        )}
        {current && (
          <span id={currentId} lang={current.lang} dir="auto">
            {current.label}
            {current.ariaLabel && (
              <>
                {' '}
                <span css={visuallyHiddenStyle}>{current.ariaLabel}</span>
              </>
            )}
          </span>
        )}
        <span aria-hidden="true" css={chevronStyle}>
          {chevron}
        </span>
      </MenuTriggerPart>
      <MenuContentPart
        slots={slots}
        {...contentAttributes}
        family={FAMILY}
        marker="locale-switcher-menu"
        styles={[listboxSurfaceStyle, listboxScrollStyle, contentCss]}
        className={contentClassName}
        defaultLabelledBy={triggerLabel ? actionId : undefined}
      >
        {options.map((option) => {
          const isCurrent = option.value === value;
          return (
            <MenuItemPart
              key={option.value}
              family={FAMILY}
              marker="locale-switcher-option"
              styles={[menuItemStyles, menuOptionStyle, optionSlot?.sx]}
              className={optionSlot?.className}
              render={(itemProps) => (
                <OptionElement
                  {...itemProps}
                  slots={slots}
                  option={option}
                  current={isCurrent}
                  link
                  adornment={
                    isCurrent && (
                      <span aria-hidden="true" css={[listboxOptionCheckStyle, checkStyle]}>
                        {SELECTED_GLYPH}
                      </span>
                    )
                  }
                />
              )}
            />
          );
        })}
      </MenuContentPart>
    </MenuController>
  );
}

function SwapVariant({ options, value, slotProps, slots }: VariantProps) {
  const target = options.find((option) => option.value !== value);
  if (!target) return null;
  return <StyledOption option={target} current={false} link styles={linkStyle} slot={slotProps?.option} slots={slots} />;
}

interface OptionListProps extends Pick<VariantProps, 'options' | 'value' | 'slotProps' | 'slots'> {
  listStyles: Interpolation<Theme>;
  linkStyles: Interpolation<Theme>;
  currentStyles: Interpolation<Theme>;
}

/** Every option in a list; the current one is plain text, the others are links. */
function OptionList({ options, value, slotProps, slots, listStyles, linkStyles, currentStyles }: OptionListProps) {
  return (
    <ul css={listStyles}>
      {options.map((option) => {
        const isCurrent = option.value === value;
        return (
          <li key={option.value}>
            <StyledOption
              slots={slots}
              option={option}
              current={isCurrent}
              link={!isCurrent}
              styles={isCurrent ? currentStyles : linkStyles}
              slot={slotProps?.option}
            />
          </li>
        );
      })}
    </ul>
  );
}

function InlineVariant(props: VariantProps) {
  return <OptionList {...props} listStyles={listStyle} linkStyles={linkStyle} currentStyles={currentStyle} />;
}

function PillsVariant(props: VariantProps) {
  const pill = [pillStyle, pillSizeStyles[props.size]];
  return (
    <OptionList
      {...props}
      listStyles={pillsListStyle}
      linkStyles={[pill, pillLinkStyle]}
      currentStyles={[pill, pillCurrentStyle]}
    />
  );
}

const VARIANTS: Record<LocaleSwitcherVariant, (props: VariantProps) => ReactNode> = {
  menu: MenuVariant,
  swap: SwapVariant,
  inline: InlineVariant,
  pills: PillsVariant,
};

const ROOT_ELEMENT = { menu: 'div', swap: 'div', inline: 'nav', pills: 'nav' } as const satisfies Record<
  LocaleSwitcherVariant,
  'div' | 'nav'
>;

export function LocaleSwitcher({
  ref,
  options,
  value,
  variant = 'menu',
  size = 'md',
  triggerLabel,
  label,
  icon = globe,
  open,
  defaultOpen,
  onOpenChange,
  placement,
  slotProps,
  slots,
  className,
  sx,
  ...rest
}: LocaleSwitcherProps) {
  const rootRef = useMergeRefs<HTMLElement>([ref]);
  const current = options.find((option) => option.value === value);
  const optionCount = options.length;
  const hasCurrent = current !== undefined;
  const hasTriggerLabel = Boolean(triggerLabel);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    if (!hasCurrent) console.warn(`LocaleSwitcher: value "${value}" matches no option.`);
    if (variant === 'swap' && optionCount !== 2) {
      console.warn(
        `LocaleSwitcher: the swap variant expects exactly two options and got ${optionCount}; it links to the first option that is not current.`,
      );
    }
    if (variant === 'menu' && !hasTriggerLabel) {
      console.warn('LocaleSwitcher: the menu variant needs a triggerLabel that names its action.');
    }
  }, [variant, value, hasCurrent, optionCount, hasTriggerLabel]);

  const Root = ROOT_ELEMENT[variant];
  const Variant = VARIANTS[variant];

  return (
    <WithSx className={className} styles={[rootStyle, rootSizeStyles[size]]} sx={sx}>
      {(className) => (
        <Root
          {...rest}
          ref={rootRef}
          aria-label={rest['aria-label'] ?? (Root === 'nav' ? label : undefined)}
          data-ui="locale-switcher"
          data-variant={variant}
          className={className}
        >
          <Variant
            options={options}
            value={value}
            current={current}
            size={size}
            triggerLabel={triggerLabel}
            icon={icon}
            open={open}
            defaultOpen={defaultOpen}
            onOpenChange={onOpenChange}
            placement={placement}
            slotProps={slotProps}
            slots={slots}
          />
        </Root>
      )}
    </WithSx>
  );
}

LocaleSwitcher.displayName = 'LocaleSwitcher';
