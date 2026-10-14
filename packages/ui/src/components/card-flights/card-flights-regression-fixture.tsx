import { useRef, useState, type RefObject } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { motionDurationMs } from '../../styling/motion-timings';
import { Button } from '../button';
import { GameCard } from '../game-card';
import { GameHand } from '../game-hand';
import { GameTable } from '../game-table';
import { ThemeRoot } from '../theme-root';
import { GameCardStack } from '../game-card-stack';
import { CardFlight } from './card-flight';
import { CardFlightsProvider, flightTarget, measureCardBox, useCardFlights, useDealFlights, usePlayedCardFlights,
  type CardFlightSpec, type DealFlightPlayer, type PlayedFlightCard,
} from './index';

const controlsStyle = css({ display: 'flex', flexWrap: 'wrap', gap: vars.space[2], padding: vars.space[3] });
const boardStyle = css({ blockSize: '600px', maxInlineSize: '850px' });
const ownHand = (['A', 2, 3] as const).map((rank, index) => ({
  id: `own:${index}`, label: `${rank} of spades`, value: { deck: 'french' as const, rank, suit: 'spades' as const },
}));
const rivalHand = ([4, 5, 6] as const).map((rank, index) => ({
  id: `rival:${index}`, label: `${rank} of hearts`, value: { deck: 'french' as const, rank, suit: 'hearts' as const },
}));
const OWN_PLAY: PlayedFlightCard = { ...ownHand[0]!, cardId: ownHand[0]!.id, id: '0-own-own:0', playerKey: 'own', isOwn: true };
const RIVAL_PLAY: PlayedFlightCard = { ...rivalHand[0]!, cardId: rivalHand[0]!.id, id: '0-rival-rival:0', playerKey: 'rival', isOwn: false };

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

export function CardFlightsRegressionFixture({ theme = 'dark', initialDealt = false, initialPlayed = false, portalReady = true }: CardFlightsFixtureProps) {
  const scopeRef = useRef<HTMLDivElement>(null);
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(true);
  return <div ref={setHost}>
    <ThemeRoot theme={theme} portalContainer={portalReady ? host : null}>
      <Button onClick={() => setMounted(!mounted)}>{mounted ? 'Unmount board' : 'Mount board'}</Button>
      {mounted && <CardFlightsProvider scopeRef={scopeRef}>
        <FlightRegressionBoard scopeRef={scopeRef} initialDealt={initialDealt} initialPlayed={initialPlayed} />
      </CardFlightsProvider>}
    </ThemeRoot>
  </div>;
}

function FlightRegressionBoard({ scopeRef, initialDealt, initialPlayed }: {
  scopeRef: RefObject<HTMLDivElement | null>; initialDealt: boolean; initialPlayed: boolean;
}) {
  const [handIndex, setHandIndex] = useState(initialDealt || initialPlayed ? 1 : 0);
  const [plays, setPlays] = useState<PlayedFlightCard[]>(initialPlayed ? [OWN_PLAY, RIVAL_PLAY] : []);
  const [resyncKey, setResyncKey] = useState(0);
  const { landingTargets, rememberPlayOrigin, launch, reset } = useCardFlights();
  const ownPlayed = plays.some((play) => play.isOwn);
  const rivalPlayed = plays.some((play) => !play.isOwn);
  const players: DealFlightPlayer[] = [
    { key: 'own', idx: 0, isOwn: true, cards: handIndex ? ownHand.filter((card) => !plays.some((entry) => entry.cardId === card.id)) : [] },
    { key: 'rival', idx: 1, isOwn: false, cards: handIndex ? rivalHand.filter((card) => !plays.some((entry) => entry.cardId === card.id)) : [] },
  ];
  useDealFlights({ handIndex, players, forehandIdx: 1, dealt: handIndex > 0 && !plays.length, resyncKey });
  usePlayedCardFlights({ plays, playerCount: 2, resyncKey });
  const deal = () => { setPlays([]); setHandIndex((index) => index + 1); };
  const play = (entry: PlayedFlightCard, capture = true) => {
    if (entry.isOwn && capture) {
      const element = scopeRef.current?.querySelector<HTMLElement>(`[data-hand-card="${CSS.escape(entry.cardId ?? entry.id)}"]`);
      if (element) rememberPlayOrigin(entry.cardId ?? entry.id, element);
    }
    setPlays((current) => [...current, entry]);
  };
  const replace = () => {
    const destination = scopeRef.current?.querySelector<HTMLElement>(`[data-played-key="${OWN_PLAY.id}"]`);
    const surface = scopeRef.current?.querySelector<HTMLElement>('[data-game-surface="true"]');
    if (!destination || !surface) return;
    launch([{ card: OWN_PLAY, target: flightTarget.played(OWN_PLAY.id), destination,
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
          return player?.isOwn ? null
            : <GameHand.Hidden playerKey={player?.key} count={player?.cards.length ?? 0} label="Rival hand" />;
        }}
        dock={<GameHand playLabel="Play selected" disabled={landingTargets.size > 0}
          onPlayIntent={(card) => play({ ...card, cardId: card.id, id: crypto.randomUUID(), playerKey: 'own', isOwn: true })}
          cards={ownHand.filter((card) => players[0]!.cards.some((entry) => entry.id === card.id))} />}
        renderPlay={(slot) => {
          const player = players.find((candidate) => candidate.key === slot.player?.key);
          if (!player) return null;
          return <GameCardStack.Pile playerKey={player.key} label={player.isOwn ? 'Own pile' : 'Rival pile'}
            cards={plays.filter((entry) => entry.playerKey === player.key)} />;
        }}
      />
    </div>
  </div>;
}
