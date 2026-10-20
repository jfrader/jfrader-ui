import { useLayoutEffect, useRef, useState } from 'react';
import { fitBoardContent, GAME_TABLE_LIMITS, type BoardContentSize, type BoardMeasurements } from './fit-layout';

const SEAT_SELECTOR = '[data-ui~="game-table-seat"]';
const CENTER_SELECTOR = '[data-ui~="game-table-center"]';
const CHROME_SELECTOR = '[data-ui~="game-table-seat-chrome"]';
const HIDDEN_CARD_SELECTOR = '[data-ui~="game-card"][data-face="back"]';
const CONTROL_SELECTOR = 'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])';
const MIN_CONTROL_SIDE = 24;
const MIN_CONTROL_MAIN_AXIS = 32;
const MAX_OUTBOARD_RESERVE_RATIO = 0.25;

function naturalSize(element: HTMLElement): BoardContentSize {
  const style = element.ownerDocument.defaultView!.getComputedStyle(element);
  const borderBox = style.boxSizing === 'border-box';
  return {
    width: Number.parseFloat(style.width) + (borderBox ? 0 :
      Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight) +
      Number.parseFloat(style.borderLeftWidth) + Number.parseFloat(style.borderRightWidth)),
    height: Number.parseFloat(style.height) + (borderBox ? 0 :
      Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom) +
      Number.parseFloat(style.borderTopWidth) + Number.parseFloat(style.borderBottomWidth)),
  };
}

function regionSize(region: HTMLElement): BoardContentSize {
  let minimumScale = 0;
  for (const control of region.querySelectorAll<HTMLElement>(CONTROL_SELECTOR)) {
    if (control.closest('[data-ui~="game-table-seat-chrome"]')) continue;
    const { width, height } = naturalSize(control);
    if (width > 0 && height > 0) minimumScale = Math.max(minimumScale, Math.min(1,
      Math.max(MIN_CONTROL_SIDE / Math.min(width, height), MIN_CONTROL_MAIN_AXIS / Math.max(width, height))));
  }
  return { ...naturalSize(region), minimumScale };
}

// Chrome can change sides without feeding its dimensions back into card fitting.
function placeChrome(surface: HTMLElement, seats: HTMLElement[]) {
  const view = surface.ownerDocument.defaultView!;
  const root = surface.closest<HTMLElement>('[data-ui~="game-table"]')!;
  const bounds = root.getBoundingClientRect();
  for (const seat of seats) for (const chrome of seat.querySelectorAll<HTMLElement>(CHROME_SELECTOR)) {
    const style = view.getComputedStyle(seat);
    const scale = Math.hypot(new view.DOMMatrixReadOnly(style.transform).a, new view.DOMMatrixReadOnly(style.transform).b);
    const box = seat.getBoundingClientRect();
    const endSide = seat.style.getPropertyValue('--game-table-chrome-x') === '0%';
    const physicalRight = style.direction === 'rtl' ? !endSide : endSide;
    const available = physicalRight ? bounds.right - box.right : box.left - bounds.left;
    const gap = Number.parseFloat(view.getComputedStyle(chrome).columnGap);
    const fallback = seat.style.getPropertyValue('--game-table-chrome-y') === '-50%' &&
      available < (naturalSize(chrome).width + gap) * scale;
    const overrides = {
      '--game-table-chrome-inline': '50%',
      '--game-table-chrome-x': '-50%',
      '--game-table-chrome-block': 'var(--game-table-chrome-fallback-block)',
      '--game-table-chrome-y': 'var(--game-table-chrome-fallback-y)',
    };
    for (const [key, value] of Object.entries(overrides)) {
      if (fallback && chrome.style.getPropertyValue(key) !== value) chrome.style.setProperty(key, value);
      else if (!fallback && chrome.style.getPropertyValue(key)) chrome.style.removeProperty(key);
    }
  }
}

export function useBoardMeasurements(rootIdentity?: unknown) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<(() => void) | null>(null);
  const [measurement, setMeasurement] = useState<BoardMeasurements>();
  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const view = surface.ownerDocument.defaultView!;
    const observed = new Set<HTMLElement>();
    const markers = new Map<HTMLElement, [string | null, string | null]>();
    const restoreMarker = (card: HTMLElement, previous: [string | null, string | null]) => {
      for (const [index, attribute] of ['data-seat-hidden-card', 'data-seat-hidden-card-index'].entries()) {
        const value = previous[index];
        if (value == null) card.removeAttribute(attribute);
        else card.setAttribute(attribute, value);
      }
    };
    const measure = () => {
      const seats = Array.from(surface.querySelectorAll<HTMLElement>(SEAT_SELECTOR));
      const center = surface.querySelector<HTMLElement>(CENTER_SELECTOR);
      if (!center) return;
      const shell = surface.parentElement!;
      const root = shell.parentElement!;
      const plays = Array.from(surface.querySelectorAll<HTMLElement>('[data-ui~="game-table-play"]'));
      const seatPlacement = root.dataset.seatPlacement as NonNullable<BoardMeasurements['seatPlacement']>;
      const reserve = { inside: 0, edge: 0.5, outside: 1 }[seatPlacement];
      const seatSizes = seats.map(regionSize);
      shell.style.setProperty('--game-table-reserve-inline', `${Math.min(shell.clientWidth * MAX_OUTBOARD_RESERVE_RATIO, Math.max(0, ...seatSizes.map((seat) => seat.width)) * reserve)}px`);
      shell.style.setProperty('--game-table-reserve-block', `${Math.min(shell.clientHeight * MAX_OUTBOARD_RESERVE_RATIO, Math.max(0, ...seatSizes.map((seat) => seat.height)) * reserve)}px`);
      const elements = new Set([root, shell, surface, center, ...seats, ...plays, ...surface.querySelectorAll<HTMLElement>(CHROME_SELECTOR)]);
      for (const element of observed) if (!elements.has(element)) {
        resize.unobserve(element);
        observed.delete(element);
      }
      for (const element of elements) if (!observed.has(element)) {
        resize.observe(element, { box: 'border-box' });
        observed.add(element);
      }

      // GameTable owns the rival-card markers on actual rendered GameCard backs.
      // Index = current DOM order within that occupied seat, not the seat index.
      // Publish in the layout phase: parent flight effects must see them on the same
      // commit as newly dealt cards, not a later MutationObserver microtask.
      const activeMarkers = new Set<HTMLElement>();
      for (const seat of seats) {
        const playerKey = seat.dataset.slotPlayer;
        if (!playerKey || seat.dataset.slotOwn === 'true') continue;
        for (const [index, card] of Array.from(seat.querySelectorAll<HTMLElement>(HIDDEN_CARD_SELECTOR)).entries()) {
          if (!markers.has(card)) markers.set(card, [card.getAttribute('data-seat-hidden-card'), card.getAttribute('data-seat-hidden-card-index')]);
          card.setAttribute('data-seat-hidden-card', playerKey);
          card.setAttribute('data-seat-hidden-card-index', String(index));
          activeMarkers.add(card);
        }
      }
      for (const [card, previous] of markers) if (!activeMarkers.has(card)) {
        restoreMarker(card, previous);
        markers.delete(card);
      }

      const read = (): BoardMeasurements => {
        const style = view.getComputedStyle(surface);
        const box = naturalSize(surface);
        const left = Number.parseFloat(style.borderLeftWidth);
        const top = Number.parseFloat(style.borderTopWidth);
        const surfaceBox = surface.getBoundingClientRect();
        const shellBox = shell.getBoundingClientRect();
        const localScaleX = surfaceBox.width / box.width;
        const localScaleY = surfaceBox.height / box.height;
        const middleX = surfaceBox.left + surfaceBox.width / 2;
        const middleY = surfaceBox.top + surfaceBox.height / 2;
        return {
          width: box.width - left - Number.parseFloat(style.borderRightWidth),
          height: box.height - top - Number.parseFloat(style.borderBottomWidth),
          centerX: box.width / 2 - (style.direction === 'rtl' ? Number.parseFloat(style.borderRightWidth) : left),
          centerY: box.height / 2 - top,
          seats: seats.map(regionSize), plays: plays.map(regionSize), center: regionSize(center), seatPlacement,
          surfaceBorderBox: box,
          direction: style.direction === 'rtl' ? 'rtl' : 'ltr',
          available: { left: (middleX - shellBox.left) / localScaleX, right: (shellBox.right - middleX) / localScaleX,
            top: (middleY - shellBox.top) / localScaleY, bottom: (shellBox.bottom - middleY) / localScaleY },
          gap: Number.parseFloat(style.columnGap), minimumScale: 0,
        };
      };
      // Try the requested CSS padding in the browser, not a profile-based estimate.
      // If floors do not fit, surrender optional clearance to its documented minimum.
      shell.style.removeProperty('padding-block');
      const requested = view.getComputedStyle(shell);
      const reservedBlock = Number.parseFloat(shell.style.getPropertyValue('--game-table-reserve-block'));
      const requestedStart = Number.parseFloat(requested.paddingBlockStart) - reservedBlock;
      const requestedEnd = Number.parseFloat(requested.paddingBlockEnd) - reservedBlock;
      let next = read();
      let start = requestedStart;
      let end = requestedEnd;
      if (!fitBoardContent(next).fits) {
        start = end = GAME_TABLE_LIMITS.minimumClearancePx;
        shell.style.paddingBlock = `${start + reservedBlock}px`;
        next = read();
      }
      next.clearance = { requestedStart, requestedEnd, start, end };
      if (![next.width, next.height, ...next.seats.flatMap((seat) => [seat.width, seat.height]), next.center.width, next.center.height].every(Number.isFinite)) return;
      setMeasurement((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next);
      placeChrome(surface, seats);
    };
    const resize = new view.ResizeObserver(measure);
    const mutation = new view.MutationObserver(measure);
    mutation.observe(surface, { childList: true, subtree: true, characterData: true, attributes: true,
      attributeFilter: ['data-face', 'data-slot-player', 'data-slot-own', 'style', 'class', 'tabindex', 'href'] });
    measureRef.current = measure;
    measure();
    return () => {
      measureRef.current = null;
      resize.disconnect();
      mutation.disconnect();
      for (const [card, previous] of markers) restoreMarker(card, previous);
    };
  }, [rootIdentity]);
  useLayoutEffect(() => { measureRef.current?.(); });
  return { surfaceRef, measurement };
}
