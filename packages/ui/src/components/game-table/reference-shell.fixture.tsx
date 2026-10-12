// DOM sizing/layout copied from trucoshi-client-private/src/components/game/TrucoBoardLayout.tsx
// (Root, TopStrip, BoardShell, BoardSurface, SeatPosition, BottomStrip), 2026-10-12.
// Reference checkout HEAD: 0e7991ce09be3ea26a6db16b59030ffb84fd4709.
// Skin and game chrome omitted; framing is deliberately independent of GameTable styles/model.
import { vars } from '@jfrader/tokens/vars';
import type { ReactNode } from 'react';
import { Button } from '../button';
import { REFERENCE_FRAMES, REFERENCE_GEOMETRY } from './reference-fixtures';
import type { BoardPlayerCount, BoardSurface, BoardViewportProfile } from './types';

export function ReferenceShell({ profile, surface, players, renderSeat }: {
  profile: BoardViewportProfile; surface: BoardSurface; players: BoardPlayerCount;
  renderSeat?: (index: number) => ReactNode;
}) {
  const [padding, shellWidth, gap, topMargin, bottomMargin, translate, width, maxWidth, height, maxHeight, ratio, border, seatWidth, seatMaxWidth] = REFERENCE_FRAMES[profile];
  const fixture = REFERENCE_GEOMETRY.find((entry) => entry[0] === surface && entry[1] === profile && entry[2] === players);
  if (!fixture) throw new Error('Missing reference geometry');
  const [, , , ...positions] = fixture;
  const lobbyWide = surface === 'lobby' && profile === 'phoneWide';
  return (
    <div data-reference-root="" style={{ position: 'relative', height: '100%', maxHeight: '100%', minHeight: 0, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', flexWrap: 'wrap', position: 'relative', width: '100%', gap, marginBottom: topMargin, transform: surface === 'lobby' ? `translateY(-${padding.split(' ')[0]})` : undefined }}>Poker</div>
      <div data-reference-shell="" style={{ position: 'relative', width: '100%', margin: '0 auto', maxWidth: shellWidth, flexGrow: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `translateY(${surface === 'match' ? translate : '0rem'})` }}>
        <div data-reference-surface="" style={{ boxSizing: 'border-box', position: 'relative', overflow: 'visible', width, maxWidth, height: lobbyWide ? 'auto' : height, maxHeight, aspectRatio: lobbyWide ? '1 / 1' : ratio, border: `${border} solid ${vars.color.border}` }}>
          {positions.map(([left, top, x, y, group], index) => (
            <div key={index} data-reference-seat="" data-slot-key={`seat-${index}`} style={{ position: 'absolute', left: `${left}%`, top: `${top}%`, width: lobbyWide ? '35%' : seatWidth, maxWidth: lobbyWide ? '11.7rem' : seatMaxWidth, transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px + ${group}px))` }}>
              {renderSeat ? renderSeat(index) : <>Seat {index}</>}
            </div>
          ))}
        </div>
      </div>
      <div style={{ position: 'relative', width: '100%', maxWidth: '58rem', marginLeft: 'auto', marginRight: 'auto', marginTop: bottomMargin }}><Button>Check</Button></div>
    </div>
  );
}
