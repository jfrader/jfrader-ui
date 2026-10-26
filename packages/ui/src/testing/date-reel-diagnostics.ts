import type { InsideMeasurement } from './geometry-assertions';

const MAX_RECORDS = 512;
const POINTER_EVENTS = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'click'] as const;

type DiagnosticTrace = {
  environment: Record<string, unknown>;
  durationMs: number;
  maxRecords: number;
  droppedRecords: number;
  records: Record<string, unknown>[];
};

type Session = {
  controller: AbortController;
  nodes: WeakMap<Node, number>;
  nextNodeId: number;
  click: number;
  startedAt: number;
  records: Record<string, unknown>[];
  droppedRecords: number;
  environment: Record<string, unknown>;
  attach: (trace: DiagnosticTrace) => Promise<unknown>;
};

const sessions = new WeakMap<Document, Session>();

function nodeId(session: Session, node: Node) {
  let id = session.nodes.get(node);
  if (id === undefined) {
    id = session.nextNodeId++;
    session.nodes.set(node, id);
  }
  return id;
}

function font(style: CSSStyleDeclaration) {
  return {
    family: style.fontFamily,
    size: style.fontSize,
    weight: style.fontWeight,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
  };
}

function append(session: Session, record: Record<string, unknown>) {
  if (session.records.length >= MAX_RECORDS) {
    session.droppedRecords += 1;
    return;
  }
  session.records.push({ timestamp: performance.now() - session.startedAt, click: session.click, ...record });
}

export function startDateReelDiagnostics(document: Document, attach: Session['attach']) {
  sessions.get(document)?.controller.abort();
  const view = document.defaultView!;
  const session: Session = {
    controller: new AbortController(),
    nodes: new WeakMap(),
    nextNodeId: 1,
    click: 0,
    startedAt: performance.now(),
    records: [],
    droppedRecords: 0,
    attach,
    environment: {
      userAgent: view.navigator.userAgent,
      language: view.navigator.language,
      viewport: { width: view.innerWidth, height: view.innerHeight },
      devicePixelRatio: view.devicePixelRatio,
      visibilityState: document.visibilityState,
      fontsStatus: document.fonts.status,
      reducedMotion: view.matchMedia('(prefers-reduced-motion: reduce)').matches,
      timeOrigin: performance.timeOrigin,
    },
  };
  sessions.set(document, session);
  for (const type of POINTER_EVENTS) {
    document.addEventListener(type, (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const reel = target.closest<HTMLElement>('[role="spinbutton"][data-part="hour"][aria-label="Hour"]');
      if (!reel) return;
      append(session, {
        phase: 'pointer-event',
        type: event.type,
        eventTimestamp: event.timeStamp,
        targetNodeId: nodeId(session, target),
        targetLabel: target.textContent,
        ariaValue: reel.getAttribute('aria-valuenow'),
        clientX: event.clientX,
        clientY: event.clientY,
        pointerType: 'pointerType' in event ? event.pointerType : null,
        pointerId: 'pointerId' in event ? event.pointerId : null,
        buttons: event.buttons,
        isTrusted: event.isTrusted,
      });
    }, { capture: true, signal: session.controller.signal });
  }
}

export function beginDateReelDiagnosticClick(reel: HTMLElement, click: number) {
  const session = sessions.get(reel.ownerDocument);
  if (!session) return;
  session.click = click;
  recordDateReelPhase(reel, 'before-click');
}

export function recordDateReelPhase(
  reel: HTMLElement,
  phase: 'before-click' | 'predicate-attempt' | 'after-wait' | 'containment-measurement',
  options: { element?: Element; measurement?: InsideMeasurement } = {},
) {
  const session = sessions.get(reel.ownerDocument);
  if (!session) return;
  if (session.records.length >= MAX_RECORDS) {
    session.droppedRecords += 1;
    return;
  }
  const selected = options.element ?? reel.querySelector('[data-selected="true"]');
  const view = reel.ownerDocument.defaultView!;
  const style = selected ? view.getComputedStyle(selected) : null;
  const measurement = options.measurement;
  append(session, {
    phase,
    selectedNodeId: selected ? nodeId(session, selected) : null,
    selectedLabel: selected?.textContent ?? null,
    selectedAttribute: selected?.getAttribute('data-selected') ?? null,
    ariaValue: reel.getAttribute('aria-valuenow'),
    transform: style?.transform ?? null,
    row: selected ? (measurement?.box ?? selected.getBoundingClientRect()).toJSON() : null,
    reel: (measurement?.frame ?? reel.getBoundingClientRect()).toJSON(),
    font: style ? font(style) : null,
    reelFont: font(view.getComputedStyle(reel)),
    fontsStatus: reel.ownerDocument.fonts.status,
    ...(measurement ? {
      distances: { ...measurement.distances },
      insetPercent: measurement.insetPercent,
      tolerancePx: measurement.tolerancePx,
    } : {}),
  });
}

export function finishDateReelDiagnostics(document: Document): DiagnosticTrace | undefined {
  const session = sessions.get(document);
  if (!session) return;
  session.controller.abort();
  sessions.delete(document);
  return {
    environment: session.environment,
    durationMs: performance.now() - session.startedAt,
    maxRecords: MAX_RECORDS,
    droppedRecords: session.droppedRecords,
    records: session.records,
  };
}

export async function withDateReelDiagnostics(document: Document, play: () => Promise<void>) {
  const session = sessions.get(document);
  if (!session) return play();
  let playFailure: { error: unknown } | undefined;
  try {
    await play();
  } catch (error) {
    playFailure = { error };
    throw error;
  } finally {
    const trace = finishDateReelDiagnostics(document);
    if (trace) {
      try {
        await session.attach(trace);
      } catch (error) {
        if (playFailure) throw new AggregateError([playFailure.error, error], 'DateReel assertion and diagnostic attachment failed');
        throw error;
      }
    }
  }
}
