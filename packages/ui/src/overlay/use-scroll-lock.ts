import { useEffect } from 'react';

// Per-document lock accounting: concurrent documents (iframes in stories/tests) never
// corrupt each other's snapshots. Nested locks restore only when the last one releases.
interface LockEntry {
  count: number;
  rootOverflow: string;
  bodyOverflow: string;
}

const locks = new Map<Document, LockEntry>();

/**
 * Blocks page scrolling while `active` is true.
 * Pass `getDocument` for overlays mounted in another document (iframes).
 */
export function useScrollLock(active: boolean, getDocument?: () => Document | undefined): void {
  useEffect(() => {
    if (!active) return;
    const doc = getDocument?.() ?? (typeof document === 'undefined' ? undefined : document);
    if (!doc) return;

    const existing = locks.get(doc);
    if (existing) {
      existing.count += 1;
    } else {
      locks.set(doc, {
        count: 1,
        rootOverflow: doc.documentElement.style.overflow,
        bodyOverflow: doc.body.style.overflow,
      });
      doc.documentElement.style.overflow = 'hidden';
      doc.body.style.overflow = 'hidden';
    }

    return () => {
      const entry = locks.get(doc);
      if (!entry) return;
      entry.count -= 1;
      if (entry.count > 0) return;
      doc.documentElement.style.overflow = entry.rootOverflow;
      doc.body.style.overflow = entry.bodyOverflow;
      locks.delete(doc);
    };
  }, [active, getDocument]);
}
