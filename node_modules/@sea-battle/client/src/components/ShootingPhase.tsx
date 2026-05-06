/**
 * ShootingPhase — displays both boards side-by-side during the shooting phase.
 *
 * Requirements: 6.1–6.5, 7.1–7.4, 8.1–8.4, 13.6, 13.7
 */

import React from 'react';
import type { Board, Coordinate } from '@sea-battle/domain';
import { BoardGrid } from './BoardGrid';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ShootingPhaseProps {
  /** Own board — ships visible, incoming shots shown. */
  myBoard: Board;
  /** Opponent board — only shot results visible (no ships unless sunk). */
  opponentBoard: Board;
  /** PlayerId of whoever's turn it currently is. */
  activePlayer: string;
  /** This client's player ID. */
  myPlayerId: string;
  /** Called when this player fires a shot at the opponent's board. */
  onFireShot: (coord: Coordinate) => void;
  /** Optional feedback string after the last shot: "Miss" | "Hit" | "Sunk". */
  lastShotResult?: string;
}

// ---------------------------------------------------------------------------
// ShootingPhase component
// ---------------------------------------------------------------------------

export function ShootingPhase({
  myBoard,
  opponentBoard,
  activePlayer,
  myPlayerId,
  onFireShot,
  lastShotResult,
}: ShootingPhaseProps): React.ReactElement {
  const isMyTurn = activePlayer === myPlayerId;

  const myCells = React.useMemo(
    () => Array.from(myBoard.cells.values()),
    [myBoard],
  );

  const opponentCells = React.useMemo(
    () => Array.from(opponentBoard.cells.values()),
    [opponentBoard],
  );

  // Shot result badge styling
  const resultStyle = React.useMemo((): React.CSSProperties => {
    if (!lastShotResult) return {};
    switch (lastShotResult) {
      case 'Sunk':
        return { backgroundColor: '#991b1b', color: '#fff' };
      case 'Hit':
        return { backgroundColor: '#f97316', color: '#fff' };
      case 'Miss':
        return { backgroundColor: '#93c5fd', color: '#1e3a5f' };
      default:
        return { backgroundColor: '#e2e8f0', color: '#1e293b' };
    }
  }, [lastShotResult]);

  return (
    <div style={{ padding: 16 }}>
      {/* Turn indicator */}
      <div
        style={{
          marginBottom: 16,
          padding: '10px 16px',
          borderRadius: 8,
          backgroundColor: isMyTurn ? '#eff6ff' : '#f8fafc',
          border: `2px solid ${isMyTurn ? '#3b82f6' : '#e2e8f0'}`,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: isMyTurn ? '#1d4ed8' : '#64748b',
          }}
        >
          {isMyTurn ? '🎯 Your turn — click a cell to fire!' : '⏳ Waiting for opponent…'}
        </span>

        {/* Shot result feedback */}
        {lastShotResult && (
          <span
            aria-live="polite"
            style={{
              padding: '4px 10px',
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 600,
              ...resultStyle,
            }}
          >
            Last shot: {lastShotResult}
          </span>
        )}
      </div>

      {/* Boards */}
      <div
        style={{
          display: 'flex',
          gap: 32,
          flexWrap: 'wrap',
          alignItems: 'flex-start',
        }}
      >
        {/* Opponent board — fire shots here */}
        <div>
          <BoardGrid
            cells={opponentCells}
            // Do NOT pass ships for opponent board — only shot results visible
            onCellClick={isMyTurn ? onFireShot : undefined}
            disabled={!isMyTurn}
            label="Opponent's Board"
          />
        </div>

        {/* Own board — ships visible, incoming shots shown */}
        <div>
          <BoardGrid
            cells={myCells}
            ships={myBoard.ships}
            // Own board is never clickable
            label="Your Board"
          />
        </div>
      </div>
    </div>
  );
}

export default ShootingPhase;
