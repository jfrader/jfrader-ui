import { expect } from 'storybook/test';

const ALLOWED_BREAK = /[\s\u00ad-]/;

/**
 * Story-only: lists rendered text that wraps inside a word, as `before|after`. Each visible
 * character's line box comes from a DOM range, so a break counts when two consecutive glyphs sit on
 * different lines with no space, soft hyphen or hyphen between them. Hidden text is skipped.
 */
export function findWordBreaks(root: Element) {
  const doc = root.ownerDocument;
  const view = doc.defaultView!;
  const range = doc.createRange();
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const breaks: string[] = [];
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const parent = node.parentElement;
    if (!parent || parent.getClientRects().length === 0 || view.getComputedStyle(parent).visibility !== 'visible') continue;
    const text = node.data;
    let previous: { index: number; top: number; height: number } | undefined;
    for (let index = 0; index < text.length; index += 1) {
      if (/\s/.test(text[index]!)) continue;
      range.setStart(node, index);
      range.setEnd(node, index + 1);
      const rect = range.getClientRects()[0];
      if (!rect || rect.width === 0) continue;
      if (previous && rect.top >= previous.top + previous.height / 2 && !ALLOWED_BREAK.test(text.slice(previous.index, index))) {
        breaks.push(`${text.slice(0, index)}|${text.slice(index)}`);
      }
      previous = { index, top: rect.top, height: rect.height };
    }
  }
  return breaks;
}

/** Story-only: fails with every `before|after` pair when any text under `root` wraps inside a word. */
export async function expectNoWordBreaks(root: Element, context = 'Word breaks') {
  await expect(findWordBreaks(root), context).toEqual([]);
}
