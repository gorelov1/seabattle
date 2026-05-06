/**
 * App — root component that manages screen navigation and game state.
 *
 * Screens:
 *   - mainMenu: the main menu
 *   - localGame: local two-player game (placement → shooting → result)
 *   - aiGame: single-player vs AI (placement → shooting → result)
 *   - accountSettings: placeholder for account management
 *
 * Requirements: 5.1, 5.3, 9.4, 12.1, 12.2, 12.6, 13.1, 14.1, 14.3, 14.4
 */

import React from 'react';
import {
  LocalGame,
  placeFleet,
  FLEET_SPEC,
  PlacementError,
  Orientation,
} from '@sea-battle/domain';
import type { Board, Coordinate, ShipPlacement } from '@sea-battle/domain';

import { MainMenu } from './components/MainMenu';
import { PlacementPhase } from './components/PlacementPhase';
import { ShootingPhase } from './components/ShootingPhase';
import { MatchResult } from './components/MatchResult';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Screen =
  | 'mainMenu'
  | 'localGame'
  | 'aiGame'
  | 'onlineInvite'
  | 'onlineMatchmaking'
  | 'accountSettings';

type GamePhase = 'placement' | 'shooting' | 'finished';

interface GameState {
  game: LocalGame;
  phase: GamePhase;
  myPlayerId: string;
  opponentPlayerId: string;
  myBoard: Board;
  opponentBoard: Board;
  activePlayer: string;
  winner?: string;
  lastShotResult?: string;
  placementError?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PLAYER_A = 'player1';
const PLAYER_B = 'player2';
const AI_ID = 'ai';

function placementErrorMessage(err: PlacementError | string): string {
  switch (err) {
    case PlacementError.OutOfBounds:
      return 'Ship goes out of bounds. Try a different position.';
    case PlacementError.AdjacencyViolation:
      return 'Ships must not touch each other (including diagonals).';
    case PlacementError.QuotaExceeded:
      return 'You have already placed all ships of this type.';
    case PlacementError.Overlap:
      return 'That cell is already occupied by another ship.';
    case PlacementError.InvalidOrientation:
      return 'Invalid orientation selected.';
    default:
      return typeof err === 'string' ? err : 'Placement failed. Try again.';
  }
}

// ---------------------------------------------------------------------------
// App component
// ---------------------------------------------------------------------------

export default function App(): React.ReactElement {
  const [screen, setScreen] = React.useState<Screen>('mainMenu');
  const [gameState, setGameState] = React.useState<GameState | null>(null);

  // ---------------------------------------------------------------------------
  // Navigation handlers
  // ---------------------------------------------------------------------------

  const startLocalGame = React.useCallback(() => {
    const game = new LocalGame('local', PLAYER_A, PLAYER_B);
    const state = game.getState();
    setGameState({
      game,
      phase: 'placement',
      myPlayerId: PLAYER_A,
      opponentPlayerId: PLAYER_B,
      myBoard: state.boardA,
      opponentBoard: state.boardB,
      activePlayer: state.activePlayer,
    });
    setScreen('localGame');
  }, []);

  const startAiGame = React.useCallback(() => {
    const game = new LocalGame('ai', PLAYER_A, AI_ID);
    const state = game.getState();
    setGameState({
      game,
      phase: 'placement',
      myPlayerId: PLAYER_A,
      opponentPlayerId: AI_ID,
      myBoard: state.boardA,
      opponentBoard: state.boardB,
      activePlayer: state.activePlayer,
    });
    setScreen('aiGame');
  }, []);

  const goToMainMenu = React.useCallback(() => {
    setGameState(null);
    setScreen('mainMenu');
  }, []);

  // ---------------------------------------------------------------------------
  // Placement handlers
  // ---------------------------------------------------------------------------

  const handlePlaceShip = React.useCallback(
    (placement: ShipPlacement) => {
      if (!gameState) return;
      const { game, myPlayerId } = gameState;

      const result = game.placeShip(myPlayerId, placement);
      const state = game.getState();

      if (!result.ok) {
        setGameState((prev) =>
          prev
            ? {
                ...prev,
                myBoard: state.boardA,
                placementError: placementErrorMessage(
                  result.error as PlacementError | string,
                ),
              }
            : prev,
        );
        return;
      }

      setGameState((prev) =>
        prev
          ? {
              ...prev,
              myBoard: state.boardA,
              placementError: undefined,
            }
          : prev,
      );
    },
    [gameState],
  );

  const handleAutoPlace = React.useCallback(() => {
    if (!gameState) return;
    const { myPlayerId } = gameState;

    // Generate a random valid fleet placement
    const autoBoard = placeFleet(FLEET_SPEC);

    // Re-create the game and replay the auto-placed ships
    const newGame = new LocalGame(
      screen === 'aiGame' ? 'ai' : 'local',
      myPlayerId,
      gameState.opponentPlayerId,
    );

    for (const ship of autoBoard.ships) {
      const origin = ship.cells[0];
      const isHorizontal =
        ship.cells.length === 1 ||
        ship.cells[0].row === ship.cells[1].row;
      newGame.placeShip(myPlayerId, {
        type: ship.type,
        origin,
        orientation: isHorizontal ? Orientation.Horizontal : Orientation.Vertical,
      });
    }

    const state = newGame.getState();
    setGameState((prev) =>
      prev
        ? {
            ...prev,
            game: newGame,
            myBoard: state.boardA,
            opponentBoard: state.boardB,
            placementError: undefined,
          }
        : prev,
    );
  }, [gameState, screen]);

  const handleReady = React.useCallback(() => {
    if (!gameState) return;
    const { game } = gameState;

    const result = game.startMatch();
    if (!result.ok) return;

    const state = game.getState();
    setGameState((prev) =>
      prev
        ? {
            ...prev,
            phase: 'shooting',
            myBoard: state.boardA,
            opponentBoard: state.boardB,
            activePlayer: state.activePlayer,
          }
        : prev,
    );
  }, [gameState]);

  // ---------------------------------------------------------------------------
  // Shooting handler
  // ---------------------------------------------------------------------------

  const handleFireShot = React.useCallback(
    (coord: Coordinate) => {
      if (!gameState) return;
      const { game, myPlayerId } = gameState;

      const result = game.fireShot(myPlayerId, coord);
      if (!result.ok) return;

      const { outcome, winner } = result.value;
      const state = game.getState();

      setGameState((prev) =>
        prev
          ? {
              ...prev,
              myBoard: state.boardA,
              opponentBoard: state.boardB,
              activePlayer: state.activePlayer,
              lastShotResult: outcome,
              phase: winner ? 'finished' : 'shooting',
              winner: winner?.playerId,
            }
          : prev,
      );
    },
    [gameState],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (screen === 'mainMenu' || !gameState) {
    return (
      <MainMenu
        onLocalGame={startLocalGame}
        onAiGame={startAiGame}
        onInviteGame={() => setScreen('onlineInvite')}
        onMatchmaking={() => setScreen('onlineMatchmaking')}
        onAccountSettings={() => setScreen('accountSettings')}
        currentUser={null}
      />
    );
  }

  if (screen === 'accountSettings') {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <h2>Account Settings</h2>
        <p>Account management coming soon.</p>
        <button onClick={goToMainMenu}>Back to Main Menu</button>
      </div>
    );
  }

  if (screen === 'onlineInvite' || screen === 'onlineMatchmaking') {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <h2>Online Play</h2>
        <p>Online multiplayer coming soon.</p>
        <button onClick={goToMainMenu}>Back to Main Menu</button>
      </div>
    );
  }

  const { phase, myBoard, opponentBoard, activePlayer, myPlayerId, winner, lastShotResult } =
    gameState;

  if (phase === 'finished' && winner !== undefined) {
    return (
      <MatchResult
        winner={winner}
        myPlayerId={myPlayerId}
        reason="normal"
        onPlayAgain={screen === 'aiGame' ? startAiGame : startLocalGame}
        onMainMenu={goToMainMenu}
      />
    );
  }

  if (phase === 'placement') {
    return (
      <PlacementPhase
        board={myBoard}
        onPlaceShip={handlePlaceShip}
        onReady={handleReady}
        onAutoPlace={screen === 'aiGame' ? handleAutoPlace : undefined}
        error={gameState.placementError}
        isReady={myBoard.ready}
      />
    );
  }

  // Shooting phase
  return (
    <ShootingPhase
      myBoard={myBoard}
      opponentBoard={opponentBoard}
      activePlayer={activePlayer}
      myPlayerId={myPlayerId}
      onFireShot={handleFireShot}
      lastShotResult={lastShotResult}
    />
  );
}
