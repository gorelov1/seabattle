/**
 * OnlineGame — placement and shooting phases for an online match.
 *
 * Connects to the WebSocket, handles all GameEvents from the server,
 * and renders PlacementPhase / ShootingPhase / MatchResult accordingly.
 *
 * Requirements: 5.1, 5.3, 6.1–6.5, 7.1–7.4, 8.1–8.4, 9.1–9.4,
 *               13.5, 13.6, 13.7, 14.5, 14.6, 14.7
 */

import React from 'react';
import {
  CellStatus,
  serialize as serializeCoord,
} from '@sea-battle/domain';
import type { Board, Cell, Coordinate, ShipPlacement } from '@sea-battle/domain';
import { network } from '../network';
import type { AuthToken } from '../types';
import { PlacementPhase } from './PlacementPhase';
import { ShootingPhase } from './ShootingPhase';
import { MatchResult } from './MatchResult';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface OnlineGameProps {
  sessionId: string;
  token: AuthToken;
  onMainMenu: () => void;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

type Phase = 'connecting' | 'placement' | 'waitingForOpponent' | 'shooting' | 'finished';

interface OnlineGameState {
  phase: Phase;
  myBoard: Board | null;
  opponentBoard: Board | null;
  activePlayer: string;
  winner: string | null;
  disconnectReason: 'normal' | 'disconnect';
  opponentDisconnected: boolean;
  lastShotResult: string | undefined;
  placementError: string | undefined;
  statusMessage: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Deserialize a board JSON string (server format: cells as plain object). */
function parseBoard(json: string): Board {
  const raw = JSON.parse(json) as {
    ownerId: string;
    cells: Record<string, Cell>;
    ships: Board['ships'];
    ready: boolean;
  };
  return {
    ownerId: raw.ownerId,
    cells: new Map(Object.entries(raw.cells)),
    ships: raw.ships,
    ready: raw.ready,
  };
}

/** Apply autoMarked coordinates to a board (mark them as Miss). */
function applyAutoMarked(board: Board, autoMarked: string[]): Board {
  if (autoMarked.length === 0) return board;
  const newCells = new Map(board.cells);
  for (const coordStr of autoMarked) {
    const cell = newCells.get(coordStr);
    if (cell && cell.status === CellStatus.Unshot) {
      newCells.set(coordStr, { ...cell, status: CellStatus.Miss });
    }
  }
  return { ...board, cells: newCells };
}

// ---------------------------------------------------------------------------
// OnlineGame component
// ---------------------------------------------------------------------------

export function OnlineGame({ sessionId, token, onMainMenu }: OnlineGameProps): React.ReactElement {
  const myPlayerId = token.accountId;

  const [state, setState] = React.useState<OnlineGameState>({
    phase: 'connecting',
    myBoard: null,
    opponentBoard: null,
    activePlayer: '',
    winner: null,
    disconnectReason: 'normal',
    opponentDisconnected: false,
    lastShotResult: undefined,
    placementError: undefined,
    statusMessage: 'Connecting…',
  });

  // Keep a ref to the ping interval so we can clear it on unmount
  const pingRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // ---------------------------------------------------------------------------
  // Connect on mount, disconnect on unmount
  // ---------------------------------------------------------------------------

  React.useEffect(() => {
    network.connect(sessionId, token.jwt);

    // Keep-alive ping every 30 seconds
    pingRef.current = setInterval(() => network.ping(), 30_000);

    const unsub = network.onEvent((event) => {
      switch (event.type) {
        case 'SessionRestored': {
          const turnState = JSON.parse(event.turnState) as { activePlayer: string };
          const isPlacement = event.status === 'Placement';
          const isShooting = event.status === 'Shooting';
          const isFinished = event.status === 'Finished';

          setState((prev) => {
            const boardA = parseBoard(event.boardA);
            const boardB = parseBoard(event.boardB);
            // Identify which board belongs to this player by ownerId
            const myBoard = boardA.ownerId === myPlayerId ? boardA : boardB;
            const opponentBoard = boardA.ownerId === myPlayerId ? boardB : boardA;
            return {
              ...prev,
              myBoard,
              opponentBoard,
              activePlayer: turnState.activePlayer,
              phase: isFinished ? 'finished' : isShooting ? 'shooting' : isPlacement ? 'placement' : 'connecting',
              statusMessage: isPlacement ? 'Place your ships' : isShooting ? 'Game in progress' : 'Connecting…',
            };
          });
          break;
        }

        case 'PlacementAck': {
          // Server confirmed our placement — refresh our board from the ack
          setState((prev) => ({
            ...prev,
            placementError: undefined,
            statusMessage: event.boardReady ? 'Fleet ready! Waiting for opponent…' : 'Place your ships',
            phase: event.boardReady && event.playerId === myPlayerId ? 'waitingForOpponent' : prev.phase,
          }));
          break;
        }

        case 'MatchStarted': {
          setState((prev) => ({
            ...prev,
            phase: 'shooting',
            activePlayer: event.firstPlayer,
            statusMessage: '',
          }));
          break;
        }

        case 'ShotResult': {
          setState((prev) => {
            if (!prev.myBoard || !prev.opponentBoard) return prev;

            // shooter !== myPlayerId means opponent shot at MY board
            const shotMyBoard = event.shooter !== myPlayerId;
            const coordStr = event.coord; // already serialized, e.g. "G7"

            const updateBoard = (board: Board): Board => {
              const newCells = new Map(board.cells);
              const cell = newCells.get(coordStr);
              if (cell) {
                const newStatus =
                  event.outcome === 'Sunk' ? CellStatus.Sunk
                  : event.outcome === 'Hit' ? CellStatus.Hit
                  : CellStatus.Miss;
                newCells.set(coordStr, { ...cell, status: newStatus });
              }
              return applyAutoMarked({ ...board, cells: newCells }, event.autoMarked);
            };

            return {
              ...prev,
              myBoard: shotMyBoard ? updateBoard(prev.myBoard) : prev.myBoard,
              opponentBoard: !shotMyBoard ? updateBoard(prev.opponentBoard) : prev.opponentBoard,
              lastShotResult: event.shooter === myPlayerId ? event.outcome : prev.lastShotResult,
            };
          });
          break;
        }

        case 'TurnChanged': {
          setState((prev) => ({ ...prev, activePlayer: event.activePlayer }));
          break;
        }

        case 'MatchEnded': {
          setState((prev) => ({
            ...prev,
            phase: 'finished',
            winner: event.winner,
            disconnectReason: prev.opponentDisconnected ? 'disconnect' : 'normal',
          }));
          break;
        }

        case 'OpponentDisconnected': {
          setState((prev) => ({
            ...prev,
            opponentDisconnected: true,
            statusMessage: `Opponent disconnected. Waiting ${event.timeout}s for reconnect…`,
          }));
          break;
        }

        case 'OpponentReconnected': {
          setState((prev) => ({
            ...prev,
            opponentDisconnected: false,
            statusMessage: '',
          }));
          break;
        }
      }
    });

    return () => {
      unsub();
      if (pingRef.current !== null) clearInterval(pingRef.current);
      network.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, token.jwt]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handlePlaceShip = React.useCallback((placement: ShipPlacement) => {
    network.sendPlacement(placement);
    // Optimistically update local board
    setState((prev) => {
      if (!prev.myBoard) return prev;
      // We'll get the authoritative board back via PlacementAck / SessionRestored
      return { ...prev, placementError: undefined };
    });
  }, []);

  const handleReady = React.useCallback(() => {
    // In online mode "Ready" is implicit — the server transitions when both fleets are placed.
    // Nothing to send; the PlacementAck with boardReady=true already signals readiness.
  }, []);

  const handleFireShot = React.useCallback((coord: Coordinate) => {
    network.sendShot(serializeCoord(coord));
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const { phase, myBoard, opponentBoard, activePlayer, winner, disconnectReason, statusMessage, lastShotResult, placementError } = state;

  if (phase === 'connecting') {
    return <StatusScreen message={statusMessage || 'Connecting…'} onBack={onMainMenu} />;
  }

  if (phase === 'finished' && winner !== null) {
    return (
      <MatchResult
        winner={winner}
        myPlayerId={myPlayerId}
        reason={disconnectReason}
        onPlayAgain={onMainMenu}
        onMainMenu={onMainMenu}
      />
    );
  }

  if (!myBoard || !opponentBoard) {
    return <StatusScreen message="Loading game state…" onBack={onMainMenu} />;
  }

  if (phase === 'placement' || phase === 'waitingForOpponent') {
    return (
      <div>
        {statusMessage && (
          <div style={bannerStyle}>{statusMessage}</div>
        )}
        {state.opponentDisconnected && (
          <div style={{ ...bannerStyle, backgroundColor: '#7c2d12', borderColor: '#f97316' }}>
            ⚠️ {statusMessage}
          </div>
        )}
        <PlacementPhase
          board={myBoard}
          onPlaceShip={handlePlaceShip}
          onReady={handleReady}
          error={placementError}
          isReady={myBoard.ready}
        />
      </div>
    );
  }

  // Shooting phase
  return (
    <div>
      {state.opponentDisconnected && (
        <div style={{ ...bannerStyle, backgroundColor: '#7c2d12', borderColor: '#f97316' }}>
          ⚠️ {statusMessage}
        </div>
      )}
      <ShootingPhase
        myBoard={myBoard}
        opponentBoard={opponentBoard}
        activePlayer={activePlayer}
        myPlayerId={myPlayerId}
        onFireShot={handleFireShot}
        lastShotResult={lastShotResult}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatusScreen helper
// ---------------------------------------------------------------------------

function StatusScreen({ message, onBack }: { message: string; onBack: () => void }): React.ReactElement {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0f172a',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 24,
      color: '#f8fafc',
    }}>
      <div style={{ fontSize: 18, color: '#94a3b8' }}>{message}</div>
      <button
        onClick={onBack}
        style={{
          padding: '10px 24px',
          borderRadius: 8,
          border: '1px solid #334155',
          backgroundColor: 'transparent',
          color: '#94a3b8',
          cursor: 'pointer',
          fontSize: 14,
        }}
      >
        ← Main Menu
      </button>
    </div>
  );
}

const bannerStyle: React.CSSProperties = {
  padding: '10px 16px',
  backgroundColor: '#1e3a5f',
  borderBottom: '1px solid #3b82f6',
  color: '#93c5fd',
  fontSize: 14,
  textAlign: 'center',
};

export default OnlineGame;
