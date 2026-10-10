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
  forwardRef,
  useCallback,
  useContext,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type LiHTMLAttributes,
  type ReactNode,
} from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';

export interface BreadcrumbsProps extends HTMLAttributes<HTMLElement> {
  /** Accessible name of the navigation landmark. */
  label?: string;
  /** Rendered (aria-hidden) between items. */
  separator?: ReactNode;
}

export interface BreadcrumbsItemProps extends LiHTMLAttributes<HTMLLIElement> {
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
  alignItems: 'center',
  gap: vars.space[2],
  color: vars.color.textMuted,
  '&:first-of-type > [data-ui="breadcrumbs-separator"]': {
    display: 'none',
  },
});

const separatorStyle = css({
  display: 'inline-flex',
});

const REDUCED_MOTION = '@media (prefers-reduced-motion: reduce)';

const contentStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: vars.space[1],
  minBlockSize: '24px',
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

const Root = forwardRef<HTMLElement, BreadcrumbsProps>(function Breadcrumbs(
  { label = 'Breadcrumb', separator = '/', children, ...rest },
  ref,
) {
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
    () => ({ separator, autoCurrentId, register, unregister }),
    [separator, autoCurrentId, register, unregister],
  );

  return (
    <BreadcrumbsContext.Provider value={context}>
      <nav {...rest} ref={ref} aria-label={label} data-ui="breadcrumbs">
        <ol css={listStyle}>{children}</ol>
      </nav>
    </BreadcrumbsContext.Provider>
  );
});

const Item = forwardRef<HTMLLIElement, BreadcrumbsItemProps>(function BreadcrumbsItem(
  { href, current, children, ...rest },
  ref,
) {
  const { separator, autoCurrentId, register, unregister } = useBreadcrumbsContext('Item');
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
    <li {...rest} ref={itemRef} data-ui="breadcrumbs-item" css={itemStyle}>
      <span aria-hidden="true" data-ui="breadcrumbs-separator" css={separatorStyle}>
        {separator}
      </span>
      {href !== undefined ? (
        <a href={href} aria-current={ariaCurrent} css={[contentStyle, linkStyle]}>
          {children}
        </a>
      ) : (
        <span aria-current={ariaCurrent} css={contentStyle}>
          {children}
        </span>
      )}
    </li>
  );
});

export const Breadcrumbs = Object.assign(Root, { Item });
