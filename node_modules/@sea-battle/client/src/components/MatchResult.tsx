/**
 * MatchResult — displays the outcome of a finished match.
 *
 * Requirements: 9.4, 12.6, 14.5, 14.6
 */

import React from 'react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface MatchResultProps {
  /** PlayerId of the winner. */
  winner: string;
  /** This client's player ID. */
  myPlayerId: string;
  /** How the match ended. */
  reason?: 'normal' | 'disconnect';
  onPlayAgain: () => void;
  onMainMenu: () => void;
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
}: MatchResultProps): React.ReactElement {
  const didWin = winner === myPlayerId;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 320,
        padding: 32,
        gap: 20,
        textAlign: 'center',
      }}
    >
      {/* Result headline */}
      <div
        style={{
          fontSize: 48,
          fontWeight: 800,
          color: didWin ? '#16a34a' : '#dc2626',
          lineHeight: 1.1,
        }}
      >
        {didWin ? '🏆 You Win!' : '💀 You Lose'}
      </div>

      {/* Disconnect notice */}
      {reason === 'disconnect' && (
        <div
          style={{
            fontSize: 16,
            color: '#64748b',
            backgroundColor: '#f1f5f9',
            padding: '8px 20px',
            borderRadius: 8,
          }}
        >
          Opponent disconnected
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <button
          onClick={onPlayAgain}
          style={{
            padding: '12px 28px',
            borderRadius: 8,
            border: 'none',
            backgroundColor: '#3b82f6',
            color: '#ffffff',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Play Again
        </button>

        <button
          onClick={onMainMenu}
          style={{
            padding: '12px 28px',
            borderRadius: 8,
            border: '2px solid #e2e8f0',
            backgroundColor: '#ffffff',
            color: '#475569',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Main Menu
        </button>
      </div>
    </div>
  );
}

export default MatchResult;
