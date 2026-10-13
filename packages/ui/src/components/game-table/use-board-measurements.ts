import { useEffect, useRef, useState } from 'react';
import type { BoardContentSize, BoardMeasurements } from './fit-layout';

const SEAT_SELECTOR = '[data-ui="game-table-seat"]';
const CENTER_SELECTOR = '[data-ui="game-table-center"]';
const HIDDEN_CARD_SELECTOR = '[data-ui~="game-card"][data-face="back"]';
const CONTROL_SELECTOR = 'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])';
const MIN_CONTROL_SIDE = 24;
const MIN_CONTROL_MAIN_AXIS = 32;

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

export function useBoardMeasurements() {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [measurement, setMeasurement] = useState<BoardMeasurements>();
  useEffect(() => {
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
      const elements = new Set([surface, center, ...seats]);
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
      // Flights consume these after commit; no card identity or hidden value is inferred.
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

      let minimumScale = 0;
      for (const region of [...seats, center]) for (const control of region.querySelectorAll<HTMLElement>(CONTROL_SELECTOR)) {
        const { width, height } = naturalSize(control);
        if (width > 0 && height > 0) minimumScale = Math.max(minimumScale, Math.min(1,
          Math.max(MIN_CONTROL_SIDE / Math.min(width, height), MIN_CONTROL_MAIN_AXIS / Math.max(width, height))));
      }
      const style = view.getComputedStyle(surface);
      const box = naturalSize(surface);
      const left = Number.parseFloat(style.borderLeftWidth);
      const top = Number.parseFloat(style.borderTopWidth);
      const next: BoardMeasurements = {
        width: box.width - left - Number.parseFloat(style.borderRightWidth),
        height: box.height - top - Number.parseFloat(style.borderBottomWidth),
        centerX: box.width / 2 - left, centerY: box.height / 2 - top,
        seats: seats.map(naturalSize), center: naturalSize(center),
        gap: Number.parseFloat(style.columnGap), minimumScale,
      };
      if (![next.width, next.height, ...next.seats.flatMap((seat) => [seat.width, seat.height]), next.center.width, next.center.height].every(Number.isFinite)) return;
      setMeasurement((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next);
    };
    const resize = new view.ResizeObserver(measure);
    const mutation = new view.MutationObserver(measure);
    mutation.observe(surface, { childList: true, subtree: true, characterData: true, attributes: true,
      attributeFilter: ['data-face', 'data-slot-player', 'data-slot-own', 'style', 'class', 'tabindex', 'href'] });
    measure();
    return () => {
      resize.disconnect();
      mutation.disconnect();
      for (const [card, previous] of markers) restoreMarker(card, previous);
    };
  }, []);
  return { surfaceRef, measurement };
}
