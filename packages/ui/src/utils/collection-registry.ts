import { useCallback, useLayoutEffect, useMemo, useState, type MutableRefObject, type RefObject } from 'react';
import { useListItem } from '@floating-ui/react';
import { partId } from './part-id';

// Shared list-item plumbing for Menu and value-keyed collections (Select, Combobox,
// CommandPalette). Value-keyed items register a record; FloatingList recomputes each
// item's index as items mount and unmount. Each widget keeps its own selection, filtering,
// typeahead and announcement policies; only registration lives here.

export interface CollectionRecord {
  /** The item's FloatingList index; -1 until the list has indexed it. */
  index: number;
  /** The item's rendered text. */
  label: string;
}

export interface CollectionRegistration<R extends CollectionRecord> {
  register: (value: string, record: R) => void;
  unregister: (value: string) => void;
}

/** Index → label lookup for typeahead; a `null` entry is never matched. */
export interface LabelLookup {
  labelsRef: MutableRefObject<Array<string | null>>;
  /** False keeps the item out of the lookup (e.g. disabled options). */
  include: boolean;
}

// Records are built with a fixed shape, so comparing the incoming record's keys is exhaustive.
const isSameRecord = <R extends CollectionRecord>(a: R | undefined, b: R) =>
  a !== undefined && (Object.keys(b) as Array<keyof R>).every((key) => a[key] === b[key]);

/** The DOM id of a registered item. */
export const collectionItemId = (baseId: string, value: string) => `${partId(baseId, 'opt', value)}-item`;

/**
 * Root side: the registered records keyed by value, and a stable registration so items'
 * effects do not re-run when the registry changes. Unchanged records keep the same map.
 */
export function useCollectionRegistry<R extends CollectionRecord>() {
  const [items, setItems] = useState<ReadonlyMap<string, R>>(() => new Map());

  const register = useCallback(
    (value: string, record: R) =>
      setItems((prev) => (isSameRecord(prev.get(value), record) ? prev : new Map(prev).set(value, record))),
    [],
  );
  const unregister = useCallback(
    (value: string) =>
      setItems((prev) => {
        if (!prev.has(value)) return prev;
        const next = new Map(prev);
        next.delete(value);
        return next;
      }),
    [],
  );
  const registration = useMemo<CollectionRegistration<R>>(() => ({ register, unregister }), [register, unregister]);

  return [items, registration] as const;
}

export function useCollectionListItem(options?: Parameters<typeof useListItem>[0]) {
  return useListItem(options);
}

export function useCollectionIndexRegistration(index: number, include: boolean, indices: Set<number>) {
  useLayoutEffect(() => {
    if (!include || index === -1) return;
    indices.add(index);
    return () => {
      indices.delete(index);
    };
  }, [include, index, indices]);
}

/**
 * Item side: joins the enclosing FloatingList and, on every commit, registers the record built
 * from the current index and the label read from `labelRef`'s text. Layout effects so the root
 * sees the record before paint; registering an unchanged record is a no-op. The item is
 * unregistered when its value changes or it unmounts. With `labelLookup`, the label is also
 * mirrored into an index-addressed lookup and cleared from its slot on cleanup.
 */
export function useCollectionItem<R extends CollectionRecord>(
  value: string,
  registration: CollectionRegistration<R>,
  labelRef: RefObject<HTMLElement | null>,
  toRecord: (index: number, label: string) => R,
  labelLookup?: LabelLookup,
) {
  const listItem = useCollectionListItem();
  const { index } = listItem;

  useLayoutEffect(() => {
    const label = labelRef.current?.textContent ?? '';
    registration.register(value, toRecord(index, label));
    if (labelLookup === undefined || index === -1) return;
    const { labelsRef, include } = labelLookup;
    labelsRef.current[index] = include ? label : null;
    return () => {
      labelsRef.current[index] = null;
    };
  });

  useLayoutEffect(() => () => registration.unregister(value), [value, registration]);

  return listItem;
}
