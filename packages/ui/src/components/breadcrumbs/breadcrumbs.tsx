// APG pattern: breadcrumb. A labelled <nav> landmark wraps an ordered list of links to the
// current page's ancestors. The current item carries aria-current="page": it stays a link when
// it has an href (APG), otherwise it renders as plain text. No keyboard map beyond native link
// Tab order.
// Without an explicit `current` on any item, the last item in DOM order becomes current. Items
// register their <li> nodes with the root in a layout effect; the root sorts them by document
// position, so wrapper components and conditional items resolve correctly. Under SSR the
// automatic aria-current appears after hydration; pass `current` explicitly to render it on the
// server.
// Separators sit inside each item before its content, aria-hidden, and the first item's
// separator is hidden with CSS so they only ever render between items.
import {
  createContext,
  useCallback,
  useContext,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ComponentType,
  type ReactNode,
} from 'react';
import { vars } from '@jfrader/tokens/vars';
import { useMergeRefs } from '@floating-ui/react';
import { css } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';

export interface BreadcrumbsBaseProps extends Omit<ComponentPropsWithRef<'nav'>, 'children'>, SxProps {
  /** Accessible name of the navigation landmark. */
  label?: string;
  /** Rendered (aria-hidden) between items. */
  separator?: ReactNode;
}

export interface BreadcrumbsEntry {
  readonly key?: string;
  readonly label: ReactNode;
  readonly href?: string;
  readonly current?: boolean;
}
export interface BreadcrumbsSlots {
  /** Nav landmark wrapping the breadcrumbs trail. */
  root?: ComponentType<ComponentPropsWithRef<'nav'>>;
  /** List item representing a single trail entry. Default: `Breadcrumbs.Item`. */
  item?: ComponentType<ComponentPropsWithRef<'li'>>;
  /** Decorative separator element rendered between trail entries. */
  separator?: ComponentType<ComponentPropsWithRef<'span'>>;
}
export interface BreadcrumbsSlotProps {
  /** Nav landmark wrapping the breadcrumbs trail. */
  root?: Omit<ComponentPropsWithRef<'nav'>, 'children'> & SxProps & {

    [attribute: `data-${string}`]: unknown;
  };
  /** List item representing a single trail entry. Default: `Breadcrumbs.Item`. */
  item?: Omit<BreadcrumbsItemProps, 'children' | 'href' | 'current'>;
  /** Decorative separator element rendered between trail entries. */
  separator?: Omit<ComponentPropsWithRef<'span'>, 'children' | 'aria-hidden'> & SxProps;
}
export interface BreadcrumbsCompoundProps extends BreadcrumbsBaseProps {
  children?: ReactNode;
  items?: never;
  component?: never;
  slots?: never;
  slotProps?: never;
}
export interface BreadcrumbsEasyProps extends BreadcrumbsBaseProps {
  items: readonly BreadcrumbsEntry[];
  children?: never;
  component?: BreadcrumbsSlots['root'];
  slots?: BreadcrumbsSlots;
  slotProps?: BreadcrumbsSlotProps;
}
export type BreadcrumbsProps = BreadcrumbsCompoundProps | BreadcrumbsEasyProps;

export interface BreadcrumbsItemProps extends ComponentPropsWithRef<'li'>, SxProps {
  href?: string;
  /** Marks the current page. Defaults to the last item when no item sets it. */
  current?: boolean;
}

interface ItemRecord {
  node: HTMLLIElement;
  current: boolean | undefined;
}

interface BreadcrumbsContextValue {
  separator: ReactNode;
  separatorProps?: BreadcrumbsSlotProps['separator'];
  separatorComponent?: BreadcrumbsSlots['separator'];
  itemComponent?: BreadcrumbsSlots['item'];
  autoCurrentId: string | null;
  register: (id: string, record: ItemRecord) => void;
  unregister: (id: string) => void;
}

const BreadcrumbsContext = createContext<BreadcrumbsContextValue | null>(null);

function useBreadcrumbsContext(part: string): BreadcrumbsContextValue {
  const context = useContext(BreadcrumbsContext);
  if (!context) throw new Error(`Breadcrumbs.${part} must be rendered inside <Breadcrumbs>.`);
  return context;
}

const byDocumentOrder = ([, a]: [string, ItemRecord], [, b]: [string, ItemRecord]) =>
  a.node.compareDocumentPosition(b.node) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;

const listStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[2],
  margin: 0,
  padding: 0,
  listStyle: 'none',
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  lineHeight: vars.lineHeight.tight,
});

const itemStyle = css({
  display: 'inline-flex',
  minInlineSize: 0,
  maxInlineSize: '100%',
  alignItems: 'center',
  gap: vars.space[2],
  color: vars.color.textMuted,
  '&:first-of-type > [data-ui~="breadcrumbs-separator"]': {
    display: 'none',
  },
});

const separatorStyle = css({
  display: 'inline-flex',
  flexShrink: 0,
});

const contentStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: vars.space[1],
  minBlockSize: vars.space[8],
  minInlineSize: 0,
  overflowWrap: 'anywhere',
  borderRadius: vars.radius.sm,
  color: 'inherit',
  '& svg': { inlineSize: '1em', blockSize: '1em', flexShrink: 0 },
  '&[aria-current="page"]': {
    color: vars.color.text,
    fontWeight: vars.fontWeight.medium,
  },
});

const linkStyle = css({
  textDecoration: 'underline',
  textDecorationColor: 'transparent',
  textUnderlineOffset: '0.2em',
  transitionProperty: 'color, text-decoration-color',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '&:hover': {
    color: vars.color.text,
    textDecorationColor: 'currentColor',
  },
  '&:focus-visible': {
    ...focusRingOutset,
  },
  [REDUCED_MOTION]: {
    transitionDuration: '0s',
  },
});

function BreadcrumbsRoot({
  ref,
  label = 'Breadcrumb',
  separator = '/',
  children,
  className,
  sx,
  items,
  component,
  slots,
  slotProps,
  ...rest
}: BreadcrumbsProps) {
  const Root = component ?? slots?.root ?? 'nav';
  const { className: slotClassName, style: slotStyle, sx: slotSx, ...rootProps } = slotProps?.root ?? {};
  const marker = typeof rootProps['data-ui'] === 'string' ? rootProps['data-ui'] : '';
  const rootDataUi = [...new Set(['breadcrumbs', ...marker.split(/\s+/)])].filter(Boolean).join(' ');
  const mergedRef = useMergeRefs([ref, rootProps.ref]);
  const records = useRef(new Map<string, ItemRecord>());
  const [autoCurrentId, setAutoCurrentId] = useState<string | null>(null);
  const resolvedId = useRef<string | null>(null);

  const resolve = useCallback(() => {
    const entries = Array.from(records.current).sort(byDocumentOrder);
    const hasExplicit = entries.some(([, record]) => record.current === true);
    const nextId = hasExplicit ? null : (entries.at(-1)?.[0] ?? null);
    if (resolvedId.current === nextId) return;
    resolvedId.current = nextId;
    setAutoCurrentId(nextId);
  }, []);

  const register = useCallback(
    (id: string, record: ItemRecord) => {
      records.current.set(id, record);
      resolve();
    },
    [resolve],
  );

  const unregister = useCallback(
    (id: string) => {
      records.current.delete(id);
      resolve();
    },
    [resolve],
  );

  const context = useMemo(
    () => ({
      separator,
      separatorProps: slotProps?.separator,
      separatorComponent: slots?.separator,
      itemComponent: slots?.item,
      autoCurrentId,
      register,
      unregister,
    }),
    [separator, slotProps?.separator, slots?.separator, slots?.item, autoCurrentId, register, unregister],
  );

  return (
    <BreadcrumbsContext.Provider value={context}>
      <WithSx className={[slotClassName, className].filter(Boolean).join(' ')} styles={[slotSx]} sx={sx}>
        {(className) => (
          <Root
            {...rest}
            {...rootProps}
            ref={mergedRef}
            style={{ ...rest.style, ...slotStyle }}
            aria-label={rootProps['aria-label'] ?? rest['aria-label'] ?? label}
            data-ui={rootDataUi}
            className={className}
          >
            <ol css={listStyle}>
              {items !== undefined
                ? items.map((item, index) => (
                    <BreadcrumbsItem {...slotProps?.item} key={item.key ?? item.href ?? index} href={item.href} current={item.current}>
                      {item.label}
                    </BreadcrumbsItem>
                  ))
                : children}
            </ol>
          </Root>
        )}
      </WithSx>
    </BreadcrumbsContext.Provider>
  );
}

BreadcrumbsRoot.displayName = 'Breadcrumbs';

function BreadcrumbsItem({ ref, href, current, children, className, sx, ...rest }: BreadcrumbsItemProps) {
  const { separator, separatorProps, separatorComponent, itemComponent, autoCurrentId, register, unregister } = useBreadcrumbsContext('Item');
  const Root = itemComponent ?? 'li';
  const Separator = separatorComponent ?? 'span';
  const {  sx: separatorSx, ...separatorRest } = separatorProps ?? {};
  const id = useId();
  const itemRef = useRef<HTMLLIElement>(null);
  useImperativeHandle(ref, () => itemRef.current as HTMLLIElement, []);

  useLayoutEffect(() => {
    const node = itemRef.current;
    if (!node) return;
    register(id, { node, current });
  });

  useLayoutEffect(() => () => unregister(id), [id, unregister]);

  const isCurrent = current ?? autoCurrentId === id;
  const ariaCurrent = isCurrent ? 'page' : undefined;

  return (
    <WithSx className={className} styles={itemStyle} sx={sx}>
      {(className) => (
        <Root {...rest} ref={itemRef} data-ui="breadcrumbs-item" className={className}>
          <WithSx className={separatorRest.className} styles={[separatorStyle, separatorSx]} sx={separatorSx}>
            {(className) => (
              <Separator {...separatorRest} aria-hidden="true" data-ui="breadcrumbs-separator" className={className}>
                {separator}
              </Separator>
            )}
          </WithSx>
          {href !== undefined ? (
            <a href={href} aria-current={ariaCurrent} css={[contentStyle, linkStyle]}>
              {children}
            </a>
          ) : (
            <span aria-current={ariaCurrent} css={contentStyle}>
              {children}
            </span>
          )}
        </Root>
      )}
    </WithSx>
  );
}

BreadcrumbsItem.displayName = 'Breadcrumbs.Item';

export const Breadcrumbs = Object.assign(BreadcrumbsRoot, { Item: BreadcrumbsItem });
