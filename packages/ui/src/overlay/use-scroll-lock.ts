import { useLayoutEffect, useRef } from 'react';

// Per-document lock accounting: concurrent documents (iframes in stories/tests) never
// corrupt each other's snapshots. Nested locks restore only when the last one releases.
interface LockEntry {
  count: number;
  rootOverflow: string;
  bodyOverflow: string;
  rootPaddingInlineEnd: string;
}

const locks = new Map<Document, LockEntry>();

/** Reserved scrollbar space, so removing the scrollbar never reflows the page. */
function scrollbarWidth(doc: Document): number {
  const view = doc.defaultView;
  if (!view) return 0;
  return Math.max(0, view.innerWidth - doc.documentElement.clientWidth);
}

/**
 * Blocks page scrolling while `active` is true.
 * Pass `getDocument` for overlays mounted in another document (iframes).
 *
 * The lock is applied in a layout effect (before paint) and reserves the scrollbar's width
 * with `padding-inline-end`, so opening an overlay never shows a scrollbar disappearing or
 * a layout shift. Logical padding keeps the reserved space on the scrollbar side in RTL.
 */
export function useScrollLock(active: boolean, getDocument?: () => Document | undefined): void {
  const getDocumentRef = useRef(getDocument);
  getDocumentRef.current = getDocument;

  useLayoutEffect(() => {
    if (!active) return;
    const doc = getDocumentRef.current?.() ?? (typeof document === 'undefined' ? undefined : document);
    if (!doc) return;

    const existing = locks.get(doc);
    if (existing) {
      existing.count += 1;
    } else {
      locks.set(doc, {
        count: 1,
        rootOverflow: doc.documentElement.style.overflow,
        bodyOverflow: doc.body.style.overflow,
        rootPaddingInlineEnd: doc.documentElement.style.paddingInlineEnd,
      });
      // Measured before hiding overflow: once hidden, the scrollbar is gone and reads as 0.
      const width = scrollbarWidth(doc);
      doc.documentElement.style.overflow = 'hidden';
      doc.body.style.overflow = 'hidden';
      if (width > 0) doc.documentElement.style.paddingInlineEnd = `${width}px`;
    }

    return () => {
      const entry = locks.get(doc);
      if (!entry) return;
      entry.count -= 1;
      if (entry.count > 0) return;
      doc.documentElement.style.overflow = entry.rootOverflow;
      doc.body.style.overflow = entry.bodyOverflow;
      doc.documentElement.style.paddingInlineEnd = entry.rootPaddingInlineEnd;
      locks.delete(doc);
    };
  }, [active]);
}
