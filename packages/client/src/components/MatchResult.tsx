/**
 * MatchResult — displays the outcome of a finished match with the final board state.
 *
 * Requirements: 9.4, 12.6, 14.5, 14.6
 */

import React from 'react';
import type { Board, Coordinate } from '@sea-battle/domain';
import { BoardGrid } from './BoardGrid';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface MatchResultProps {
  winner: string;
  myPlayerId: string;
  reason?: 'normal' | 'disconnect';
  onPlayAgain: () => void;
  onMainMenu: () => void;
  /** Final state of the player's own board (optional). */
  myBoard?: Board;
  /** Final state of the opponent's board (optional). */
  opponentBoard?: Board;
}

// ---------------------------------------------------------------------------
// MatchResult component
// ---------------------------------------------------------------------------

export function MatchResult({
  winner,
  myPlayerId,
  reason,
  onPlayAgain,
  onMainMenu,
  myBoard,
  opponentBoard,
}: MatchResultProps): React.ReactElement {
  const didWin = winner === myPlayerId;

  const myCells = React.useMemo(
    () => (myBoard ? Array.from(myBoard.cells.values()) : []),
    [myBoard],
  );
  const opponentCells = React.useMemo(
    () => (opponentBoard ? Array.from(opponentBoard.cells.values()) : []),
    [opponentBoard],
  );

  // Dummy no-op for the read-only board click handler
  const noop = React.useCallback((_: Coordinate) => {}, []);

  return (
    <div style={{
      backgroundColor: '#0f172a',
      minHeight: '100vh',
      padding: 32,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 24,
      color: '#f8fafc',
    }}>
      {/* Result headline */}
      <div style={{ fontSize: 52, fontWeight: 800, color: didWin ? '#4ade80' : '#f87171', lineHeight: 1.1, textAlign: 'center' }}>
        {didWin ? '🏆 You Win!' : '💀 You Lose'}
      </div>

      {reason === 'disconnect' && (
        <div style={{ fontSize: 15, color: '#94a3b8', backgroundColor: '#1e293b', padding: '8px 20px', borderRadius: 8 }}>
          Opponent disconnected
        </div>
      )}

      {/* Final boards */}
      {(myBoard || opponentBoard) && (
        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', justifyContent: 'center' }}>
          {opponentBoard && (
            <BoardGrid
              cells={opponentCells}
              ships={opponentBoard.ships}
              label="Opponent's Board (final)"
              disabled
              onCellClick={noop}
            />
          )}
          {myBoard && (
            <BoardGrid
              cells={myCells}
              ships={myBoard.ships}
              label="Your Board (final)"
              disabled
              onCellClick={noop}
            />
          )}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={onPlayAgain} style={{ padding: '12px 28px', borderRadius: 8, border: 'none', backgroundColor: '#3b82f6', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
          Play Again
        </button>
        <button onClick={onMainMenu} style={{ padding: '12px 28px', borderRadius: 8, border: '2px solid #334155', backgroundColor: 'transparent', color: '#94a3b8', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
          Main Menu
        </button>
      </div>
    </div>
  );
}

export default MatchResult;
