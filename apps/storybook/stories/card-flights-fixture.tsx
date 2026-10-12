import { useRef, useState, type RefObject } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../../packages/ui/src/styling/css';
import { motionDurationMs } from '../../../packages/ui/src/styling/motion-timings';
import { Button, CardFlightsProvider, GameCard, GameTable, ThemeRoot, flightTarget, measureCardBox,
  useCardFlights, useDealFlights, usePlayedCardFlights, type DealFlightPlayer, type FlightCard, type PlayedFlightCard,
} from '@jfrader/ui';
import { CardFlight } from '../../../packages/ui/src/components/card-flights/card-flight';
import type { CardFlightSpec } from '../../../packages/ui/src/components/card-flights/card-flights';

const controlsStyle = css({ display: 'flex', flexWrap: 'wrap', gap: vars.space[2], padding: vars.space[3] });
const boardStyle = css({ blockSize: '600px', maxInlineSize: '850px' });
const handStyle = css({ display: 'flex', gap: vars.space[2], justifyContent: 'center' });
const centerStyle = css({ display: 'flex', gap: vars.space[2], justifyContent: 'center', alignItems: 'center' });
const cards: FlightCard[] = (['A', 2, 3] as const).map((rank, index) => ({
  key: `own:${index}`,
  front: <GameCard label={`${rank} of spades`} value={{ deck: 'french', rank, suit: 'spades' }} />,
  back: <GameCard label="Card back" />,
}));
const opponentCards: FlightCard[] = ([4, 5, 6] as const).map((rank, index) => ({
  key: `rival:${index}`, front: <GameCard label={`${rank} of hearts`} value={{ deck: 'french', rank, suit: 'hearts' }} />,
  back: <GameCard label="Card back" />,
}));
const OWN_PLAY: PlayedFlightCard = { ...cards[0]!, playerKey: 'own', isOwn: true, playedKey: '0-own-own:0' };
const RIVAL_PLAY: PlayedFlightCard = { ...opponentCards[0]!, playerKey: 'rival', isOwn: false, playedKey: '0-rival-rival:0' };

export interface CardFlightsFixtureProps {
  theme?: 'dark' | 'light';
  initialDealt?: boolean;
  initialPlayed?: boolean;
  portalReady?: boolean;
}

export function FlightIdentityProbe() {
  const destinationRef = useRef<HTMLDivElement>(null);
  const [spec, setSpec] = useState<CardFlightSpec | null>(null);
  return <div data-identity-probe>
    <div ref={destinationRef}><GameCard label="Probe card" /></div>
    <div css={controlsStyle}>
      <Button onClick={() => {
        const destination = destinationRef.current;
        if (!destination) return;
        const to = measureCardBox(destination);
        setSpec({ target: 'identity-probe', destination, to, from: { ...to, cx: to.cx - to.width },
          face: 'reveal', front: <GameCard label="Probe front" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />,
          back: <GameCard label="Probe back" />, durationMs: motionDurationMs.cardPlay });
      }}>Start identity probe</Button>
      <Button onClick={() => setSpec((current) => current && ({ ...current, from: { ...current.from }, to: { ...current.to } }))}>Rerender identity probe</Button>
      <Button onClick={() => setSpec(null)}>Stop identity probe</Button>
    </div>
    {spec && <CardFlight flightId={1} spec={spec} onFinish={() => undefined} />}
  </div>;
}

export function CardFlightsFixture({ theme = 'dark', initialDealt = false, initialPlayed = false, portalReady = true }: CardFlightsFixtureProps) {
  const scopeRef = useRef<HTMLDivElement>(null);
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(true);
  return <div ref={setHost}>
    <ThemeRoot theme={theme} portalContainer={portalReady ? host : null}>
      <Button onClick={() => setMounted(!mounted)}>{mounted ? 'Unmount board' : 'Mount board'}</Button>
      {mounted && <CardFlightsProvider scopeRef={scopeRef}>
        <FakeMatch scopeRef={scopeRef} initialDealt={initialDealt} initialPlayed={initialPlayed} />
      </CardFlightsProvider>}
    </ThemeRoot>
  </div>;
}

function FakeMatch({ scopeRef, initialDealt, initialPlayed }: {
  scopeRef: RefObject<HTMLDivElement | null>; initialDealt: boolean; initialPlayed: boolean;
}) {
  const [handIndex, setHandIndex] = useState(initialDealt || initialPlayed ? 1 : 0);
  const [plays, setPlays] = useState<PlayedFlightCard[]>(initialPlayed ? [OWN_PLAY, RIVAL_PLAY] : []);
  const [resyncKey, setResyncKey] = useState(0);
  const { landingTargets, rememberPlayOrigin, launch, reset } = useCardFlights();
  const ownPlayed = plays.some((play) => play.isOwn);
  const rivalPlayed = plays.some((play) => !play.isOwn);
  const players: DealFlightPlayer[] = [
    { key: 'own', idx: 0, isOwn: true, cards: handIndex ? cards.slice(ownPlayed ? 1 : 0) : [] },
    { key: 'rival', idx: 1, isOwn: false, cards: handIndex ? opponentCards.slice(rivalPlayed ? 1 : 0) : [] },
  ];
  useDealFlights({ handIndex, players, forehandIdx: 1, dealt: handIndex > 0 && !plays.length, resyncKey });
  usePlayedCardFlights({ plays, playerCount: 2, resyncKey });
  const deal = () => { setPlays([]); setHandIndex((index) => index + 1); };
  const play = (entry: PlayedFlightCard, capture = true) => {
    if (entry.isOwn && capture) {
      const element = scopeRef.current?.querySelector<HTMLElement>('[data-hand-card="own:0"]');
      if (element) rememberPlayOrigin(entry.key, element);
    }
    setPlays((current) => [...current, entry]);
  };
  const replace = () => {
    const destination = scopeRef.current?.querySelector<HTMLElement>(`[data-trick-key="${OWN_PLAY.playedKey}"]`);
    const surface = scopeRef.current?.querySelector<HTMLElement>('[data-game-surface="true"]');
    if (!destination || !surface) return;
    launch([{ ...OWN_PLAY, target: flightTarget.trick(OWN_PLAY.playedKey), destination,
      from: measureCardBox(surface), to: measureCardBox(destination), face: 'reveal', durationMs: motionDurationMs.cardPlay }]);
  };
  return <div ref={scopeRef}>
    <div css={controlsStyle}>
      <Button onClick={deal}>Deal hand</Button>
      <Button disabled={!handIndex || ownPlayed || landingTargets.size > 0} onClick={() => play(OWN_PLAY)}>Play own</Button>
      <Button disabled={!handIndex || rivalPlayed || landingTargets.size > 0} onClick={() => play(RIVAL_PLAY)}>Play rival</Button>
      <Button onClick={replace} disabled={!ownPlayed}>Replace flight</Button>
      <Button onClick={reset}>Reset flights</Button>
      <Button onClick={() => { setResyncKey((key) => key + 1); deal(); }}>Resync hand</Button>
      <Button disabled={!handIndex || ownPlayed} onClick={() => {
        const node = scopeRef.current?.querySelector<HTMLElement>('[data-hand-card="own:0"]');
        if (node) { const box = measureCardBox(node); rememberPlayOrigin('own:0', { ...box, cx: box.cx - 200, cy: box.cy - 100 }); }
      }}>Capture moved origin</Button>
      <Button disabled={!handIndex || ownPlayed || landingTargets.size > 0} onClick={() => play(OWN_PLAY, false)}>Play without capture</Button>
      <output aria-label="Flights in air">{landingTargets.size}</output>
    </div>
    <div css={boardStyle}>
      <GameTable players={2} viewport={{ width: 1000, height: 800 }}
        seats={[{ key: 'own', teamIdx: 0, isMe: true }, { key: 'rival', teamIdx: 1 }]}
        renderSeat={(slot) => {
          const player = players.find((candidate) => candidate.key === slot.player?.key);
          return <div css={handStyle}>{player?.cards.map((card, index) => player.isOwn
            ? <div key={card.key} data-hand-card={card.key}>{card.front}</div>
            : <div key={card.key} data-seat-hidden-card={player.key} data-seat-hidden-card-index={index}>{card.back}</div>)}</div>;
        }}
        center={<div css={centerStyle}>{plays.map((entry) => <div key={entry.playedKey} data-trick-key={entry.playedKey}>{entry.front}</div>)}</div>}
      />
    </div>
  </div>;
}
