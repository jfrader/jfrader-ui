import { useState } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { Button } from '../button';
import { GameHand, type GameHandCard } from '../game-hand';
import { GameTable } from '../game-table';
import { GameCardStack } from '../game-card-stack';
import { ThemeRoot } from '../theme-root';
import { CardFlightsProvider, useCardFlights, useDealFlights, usePlayedCardFlights, type PlayedFlightCard } from './index';

const controlsStyle = css({ display: 'flex', gap: vars.space[2], padding: vars.space[3] });
const boardStyle = css({ blockSize: '600px', maxInlineSize: '850px' });
const hands = {
  own: [
    { id: 'own-ace', label: 'Ace of spades', value: { deck: 'french', suit: 'spades', rank: 'A' } },
    { id: 'own-two', label: 'Two of spades', value: { deck: 'french', suit: 'spades', rank: 2 } },
    { id: 'own-three', label: 'Three of spades', value: { deck: 'french', suit: 'spades', rank: 3 } },
  ],
  rival: [
    { id: 'rival-four', label: 'Four of hearts', value: { deck: 'french', suit: 'hearts', rank: 4 } },
    { id: 'rival-five', label: 'Five of hearts', value: { deck: 'french', suit: 'hearts', rank: 5 } },
    { id: 'rival-six', label: 'Six of hearts', value: { deck: 'french', suit: 'hearts', rank: 6 } },
  ],
} satisfies Record<string, GameHandCard[]>;
const seats = [{ key: 'own', teamIdx: 0, isMe: true }, { key: 'rival', teamIdx: 1 }];

export function CardFlightsFixture({ theme = 'dark' }: { theme?: 'dark' | 'light' }) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  return <div ref={setHost}><ThemeRoot theme={theme} portalContainer={host}>
    <CardFlightsProvider><Match /></CardFlightsProvider>
  </ThemeRoot></div>;
}

function Match() {
  const [handIndex, setHandIndex] = useState(1);
  const [plays, setPlays] = useState<PlayedFlightCard[]>([]);
  const { scopeRef, landingTargets, rememberPlayOrigin } = useCardFlights();
  const remaining = (playerKey: keyof typeof hands) => hands[playerKey].filter((card) =>
    !plays.some((play) => play.cardId === card.id));
  const ownCards = remaining('own');
  const rivalCards = remaining('rival');
  const players = [
    { key: 'own', idx: 0, isOwn: true, cards: ownCards },
    { key: 'rival', idx: 1, isOwn: false, cards: rivalCards },
  ];
  useDealFlights({ handIndex, players, forehandIdx: 0, dealt: plays.length === 0 });
  usePlayedCardFlights({ plays, playerCount: players.length });
  const acceptPlay = (card: GameHandCard) => {
    const source = scopeRef.current?.querySelector<HTMLElement>(`[data-hand-card="${CSS.escape(card.id)}"]`);
    if (source) rememberPlayOrigin(card.id, source);
    const own: PlayedFlightCard = { ...card, cardId: card.id, id: crypto.randomUUID(), playerKey: 'own', isOwn: true };
    const rival = rivalCards[0];
    setPlays((current) => [...current, own, ...(rival ? [{ ...rival, cardId: rival.id, id: crypto.randomUUID(), playerKey: 'rival', isOwn: false }] : [])]);
  };
  return <>
    <div css={controlsStyle}><Button disabled={landingTargets.size > 0} onClick={() => {
      setPlays([]); setHandIndex((index) => index + 1);
    }}>Deal hand</Button></div>
    <div css={boardStyle}><GameTable players={2} seats={seats} viewport={{ width: 1000, height: 800 }}
    >
      <GameTable.Seat slotKey="rival"><GameHand.Hidden playerKey="rival" count={rivalCards.length} label="Rival hand" /></GameTable.Seat>
      <GameTable.Dock><GameHand cards={ownCards} playLabel="Play selected" onPlayIntent={acceptPlay} disabled={landingTargets.size > 0} /></GameTable.Dock>
      {seats.map((player) => <GameTable.Play key={player.key} slotKey={player.key}>
        <GameCardStack.Pile playerKey={player.key} label={player.isMe ? 'Own pile' : 'Rival pile'}
          cards={plays.filter((play) => play.playerKey === player.key)} />
      </GameTable.Play>)}
    </GameTable></div>
  </>;
}
