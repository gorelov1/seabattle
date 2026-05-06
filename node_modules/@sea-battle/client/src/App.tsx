/**
 * App — root component that manages screen navigation and game state.
 *
 * Screens:
 *   - mainMenu
 *   - localGame / aiGame  (offline)
 *   - onlineAuth          (login/register before online play)
 *   - onlineInvite        (create/join via invite code)
 *   - onlineMatchmaking   (random opponent queue)
 *   - onlineGame          (active online match)
 *   - accountSettings
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
  serialize as serializeCoord,
} from '@sea-battle/domain';
import type { Board, Coordinate, ShipPlacement } from '@sea-battle/domain';

import { MainMenu } from './components/MainMenu';
import { PlacementPhase } from './components/PlacementPhase';
import { ShootingPhase } from './components/ShootingPhase';
import { MatchResult } from './components/MatchResult';
import { OnlineAuth } from './components/OnlineAuth';
import { OnlineInvite } from './components/OnlineInvite';
import { OnlineMatchmaking } from './components/OnlineMatchmaking';
import { OnlineGame } from './components/OnlineGame';
import type { AuthToken, UserAccount } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Screen =
  | 'mainMenu'
  | 'localGame'
  | 'aiGame'
  | 'onlineAuth'        // login/register
  | 'onlineInvite'      // invite-code flow
  | 'onlineMatchmaking' // random queue
  | 'onlineGame'        // active online match
  | 'accountSettings';

/** Which online flow the user chose before hitting the auth screen. */
type OnlineIntent = 'invite' | 'matchmaking' | null;

type GamePhase = 'placement' | 'shooting' | 'finished';

interface LocalGameState {
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
  /** Serialized coord of the last shot I fired at the opponent board */
  lastOpponentShotCoord?: string;
  /** Serialized coord of the last shot the opponent fired at my board */
  lastIncomingShotCoord?: string;
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
  const [localGameState, setLocalGameState] = React.useState<LocalGameState | null>(null);

  // Online play state
  const [authToken, setAuthToken] = React.useState<AuthToken | null>(null);
  const [currentUser, setCurrentUser] = React.useState<UserAccount | null>(null);
  const [onlineIntent, setOnlineIntent] = React.useState<OnlineIntent>(null);
  const [onlineSessionId, setOnlineSessionId] = React.useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  const goToMainMenu = React.useCallback(() => {
    setLocalGameState(null);
    setOnlineSessionId(null);
    setScreen('mainMenu');
  }, []);

  const startLocalGame = React.useCallback(() => {
    const game = new LocalGame('local', PLAYER_A, PLAYER_B);
    const state = game.getState();
    setLocalGameState({
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
    setLocalGameState({
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

  // Online: go to auth first, then to the intended flow
  const startOnlineInvite = React.useCallback(() => {
    setOnlineIntent('invite');
    if (authToken) {
      setScreen('onlineInvite');
    } else {
      setScreen('onlineAuth');
    }
  }, [authToken]);

  const startOnlineMatchmaking = React.useCallback(() => {
    setOnlineIntent('matchmaking');
    if (authToken) {
      setScreen('onlineMatchmaking');
    } else {
      setScreen('onlineAuth');
    }
  }, [authToken]);

  const handleAuth = React.useCallback((token: AuthToken, account: UserAccount) => {
    setAuthToken(token);
    setCurrentUser(account);
    // Proceed to the intended online flow
    if (onlineIntent === 'invite') setScreen('onlineInvite');
    else if (onlineIntent === 'matchmaking') setScreen('onlineMatchmaking');
    else setScreen('mainMenu');
  }, [onlineIntent]);

  const handleSessionReady = React.useCallback((sessionId: string) => {
    setOnlineSessionId(sessionId);
    setScreen('onlineGame');
  }, []);

  // ---------------------------------------------------------------------------
  // Local game — placement handlers
  // ---------------------------------------------------------------------------

  const handlePlaceShip = React.useCallback((placement: ShipPlacement) => {
    if (!localGameState) return;
    const { game, myPlayerId } = localGameState;
    const result = game.placeShip(myPlayerId, placement);
    const state = game.getState();
    if (!result.ok) {
      setLocalGameState((prev) => prev ? {
        ...prev,
        myBoard: state.boardA,
        placementError: placementErrorMessage(result.error as PlacementError | string),
      } : prev);
      return;
    }
    setLocalGameState((prev) => prev ? { ...prev, myBoard: state.boardA, placementError: undefined } : prev);
  }, [localGameState]);

  const handleRemoveShip = React.useCallback((coord: Coordinate) => {
    if (!localGameState) return;
    const { game, myPlayerId, opponentPlayerId } = localGameState;

    // Remove the ship from the game's internal board
    game.removeShip(myPlayerId, coord);
    const state = game.getState();

    // Rebuild a fresh LocalGame from the remaining ships to avoid any stale state
    const newGame = new LocalGame(
      screen === 'aiGame' ? 'ai' : 'local',
      myPlayerId,
      opponentPlayerId,
    );
    for (const ship of state.boardA.ships) {
      const origin = ship.cells[0];
      const isHorizontal = ship.cells.length === 1 || ship.cells[0].row === ship.cells[1].row;
      newGame.placeShip(myPlayerId, {
        type: ship.type,
        origin,
        orientation: isHorizontal ? Orientation.Horizontal : Orientation.Vertical,
      });
    }
    const newState = newGame.getState();

    setLocalGameState((prev) => prev ? {
      ...prev,
      game: newGame,
      myBoard: newState.boardA,
      opponentBoard: newState.boardB,
      placementError: undefined,
    } : prev);
  }, [localGameState, screen]);

  const handleAutoPlace = React.useCallback(() => {
    if (!localGameState) return;
    const { myPlayerId } = localGameState;
    const autoBoard = placeFleet(FLEET_SPEC);
    const newGame = new LocalGame(
      screen === 'aiGame' ? 'ai' : 'local',
      myPlayerId,
      localGameState.opponentPlayerId,
    );
    for (const ship of autoBoard.ships) {
      const origin = ship.cells[0];
      const isHorizontal = ship.cells.length === 1 || ship.cells[0].row === ship.cells[1].row;
      newGame.placeShip(myPlayerId, {
        type: ship.type,
        origin,
        orientation: isHorizontal ? Orientation.Horizontal : Orientation.Vertical,
      });
    }
    const state = newGame.getState();
    setLocalGameState((prev) => prev ? {
      ...prev,
      game: newGame,
      myBoard: state.boardA,
      opponentBoard: state.boardB,
      placementError: undefined,
    } : prev);
  }, [localGameState, screen]);

  const handleReady = React.useCallback(() => {
    if (!localGameState) return;
    const result = localGameState.game.startMatch();
    if (!result.ok) return;
    const state = localGameState.game.getState();
    setLocalGameState((prev) => prev ? {
      ...prev,
      phase: 'shooting',
      myBoard: state.boardA,
      opponentBoard: state.boardB,
      activePlayer: state.activePlayer,
    } : prev);
  }, [localGameState]);

  const [aiThinking, setAiThinking] = React.useState(false);

  // ---------------------------------------------------------------------------
  // AI turn loop — fires one shot, waits, then fires again if AI keeps turn
  // ---------------------------------------------------------------------------

  const runAiTurnStep = React.useCallback((game: LocalGame) => {
    if (!game.isAiTurn()) return;

    setAiThinking(true);
    setTimeout(() => {
      const aiResult = game.fireAiShot();
      if (!aiResult.ok) {
        setAiThinking(false);
        return;
      }

      const state = game.getState();
      const aiWinner = aiResult.value.winner;

      // Find the coord the AI just shot (last changed cell on boardA)
      let lastIncoming: string | undefined;
      for (const [key, cell] of state.boardA.cells) {
        if (cell.status !== 'Unshot') {
          // We'll pick the most recently changed one — compare with current state
          // Since we don't have the old board here, we track it via the result
          lastIncoming = key; // will be overwritten to the last one
        }
      }
      // Better: use autoMarked or find the sunk coord from the result
      // The shot coord is the cell that changed from Unshot to Hit/Sunk/Miss
      // We can find it by checking which cell in boardA is the one just shot
      // Since we don't have the pre-shot board, use a ref approach below

      setLocalGameState((prev) => {
        if (!prev) return prev;
        // Find the cell that changed (was Unshot before, now isn't)
        let shotKey: string | undefined;
        for (const [key, newCell] of state.boardA.cells) {
          const oldCell = prev.myBoard.cells.get(key);
          if (oldCell && oldCell.status === 'Unshot' && newCell.status !== 'Unshot') {
            shotKey = key;
          }
        }
        return {
          ...prev,
          myBoard: state.boardA,
          opponentBoard: state.boardB,
          activePlayer: state.activePlayer,
          lastShotResult: aiResult.value.outcome,
          phase: aiWinner ? 'finished' : 'shooting',
          winner: aiWinner?.playerId,
          lastIncomingShotCoord: shotKey ?? prev.lastIncomingShotCoord,
        };
      });

      if (aiWinner) {
        setAiThinking(false);
        return;
      }

      // If AI keeps its turn (Hit or Sunk), schedule another shot
      if (game.isAiTurn()) {
        runAiTurnStep(game);
      } else {
        // AI missed — turn back to human
        setAiThinking(false);
      }
    }, 800);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Local game — shooting handler
  // ---------------------------------------------------------------------------

  const handleFireShot = React.useCallback((coord: Coordinate) => {
    if (!localGameState || aiThinking) return;
    const { game, myPlayerId } = localGameState;
    const result = game.fireShot(myPlayerId, coord);
    if (!result.ok) return;

    const outcome = result.value.outcome;
    const winner = result.value.winner;
    const state = game.getState();
    const shotCoord = serializeCoord(coord);

    // Update state with the human's shot immediately
    setLocalGameState((prev) => prev ? {
      ...prev,
      myBoard: state.boardA,
      opponentBoard: state.boardB,
      activePlayer: state.activePlayer,
      lastShotResult: outcome,
      phase: winner ? 'finished' : 'shooting',
      winner: winner?.playerId,
      lastOpponentShotCoord: shotCoord,
    } : prev);

    // If the human missed and it's now the AI's turn, start the AI turn loop
    if (!winner && game.isAiTurn()) {
      runAiTurnStep(game);
    }
  }, [localGameState, aiThinking, runAiTurnStep]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // Main menu
  if (screen === 'mainMenu') {
    return (
      <MainMenu
        onLocalGame={startLocalGame}
        onAiGame={startAiGame}
        onInviteGame={startOnlineInvite}
        onMatchmaking={startOnlineMatchmaking}
        onAccountSettings={() => setScreen('accountSettings')}
        currentUser={currentUser}
      />
    );
  }

  // Account settings (placeholder)
  if (screen === 'accountSettings') {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#f8fafc', backgroundColor: '#0f172a', minHeight: '100vh' }}>
        <h2>Account Settings</h2>
        {currentUser ? (
          <p>Logged in as <strong>{currentUser.displayName}</strong> ({currentUser.email})</p>
        ) : (
          <p>Not logged in.</p>
        )}
        <button onClick={goToMainMenu} style={{ marginTop: 16, padding: '10px 24px', borderRadius: 8, border: '1px solid #334155', backgroundColor: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>
          ← Back to Main Menu
        </button>
      </div>
    );
  }

  // Online auth
  if (screen === 'onlineAuth') {
    return (
      <OnlineAuth
        onAuth={handleAuth}
        onBack={goToMainMenu}
      />
    );
  }

  // Online invite
  if (screen === 'onlineInvite' && authToken) {
    return (
      <OnlineInvite
        token={authToken}
        onSessionReady={(sessionId) => handleSessionReady(sessionId)}
        onBack={goToMainMenu}
      />
    );
  }

  // Online matchmaking
  if (screen === 'onlineMatchmaking' && authToken) {
    return (
      <OnlineMatchmaking
        token={authToken}
        onSessionReady={(sessionId) => handleSessionReady(sessionId)}
        onBack={goToMainMenu}
      />
    );
  }

  // Active online game
  if (screen === 'onlineGame' && authToken && onlineSessionId) {
    return (
      <OnlineGame
        sessionId={onlineSessionId}
        token={authToken}
        onMainMenu={goToMainMenu}
      />
    );
  }

  // ---- Local / AI game screens ----

  if (!localGameState) {
    return (
      <MainMenu
        onLocalGame={startLocalGame}
        onAiGame={startAiGame}
        onInviteGame={startOnlineInvite}
        onMatchmaking={startOnlineMatchmaking}
        onAccountSettings={() => setScreen('accountSettings')}
        currentUser={currentUser}
      />
    );
  }

  const { phase, myBoard, opponentBoard, activePlayer, myPlayerId, winner, lastShotResult } = localGameState;

  if (phase === 'finished' && winner !== undefined) {
    return (
      <MatchResult
        winner={winner}
        myPlayerId={myPlayerId}
        reason="normal"
        onPlayAgain={screen === 'aiGame' ? startAiGame : startLocalGame}
        onMainMenu={goToMainMenu}
        myBoard={myBoard}
        opponentBoard={opponentBoard}
      />
    );
  }

  if (phase === 'placement') {
    return (
      <PlacementPhase
        board={myBoard}
        onPlaceShip={handlePlaceShip}
        onRemoveShip={handleRemoveShip}
        onReady={handleReady}
        onAutoPlace={screen === 'aiGame' ? handleAutoPlace : undefined}
        error={localGameState.placementError}
        isReady={myBoard.ready}
      />
    );
  }

  return (
    <ShootingPhase
      myBoard={myBoard}
      opponentBoard={opponentBoard}
      activePlayer={activePlayer}
      myPlayerId={myPlayerId}
      onFireShot={handleFireShot}
      lastShotResult={lastShotResult}
      lastOpponentShotCoord={localGameState.lastOpponentShotCoord}
      lastIncomingShotCoord={localGameState.lastIncomingShotCoord}
      disabled={aiThinking}
    />
  );
}
