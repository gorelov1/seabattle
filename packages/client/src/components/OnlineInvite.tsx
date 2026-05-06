/**
 * OnlineInvite — create a session and share the invite code, or join via code.
 *
 * Requirements: 13.1, 13.2, 13.3, 13.4
 */

import React from 'react';
import { network } from '../network';
import type { AuthToken } from '../types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface OnlineInviteProps {
  token: AuthToken;
  onSessionReady: (sessionId: string, myPlayerId: string) => void;
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// OnlineInvite component
// ---------------------------------------------------------------------------

export function OnlineInvite({ token, onSessionReady, onBack }: OnlineInviteProps): React.ReactElement {
  const [mode, setMode] = React.useState<'choose' | 'host' | 'join'>('choose');
  const [inviteCode, setInviteCode] = React.useState('');
  const [joinCode, setJoinCode] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  // Create a session and get the invite code
  const handleHost = async () => {
    setError(null);
    setLoading(true);
    try {
      const { sessionId, inviteCode: code } = await network.createSession(token.jwt);
      setInviteCode(code);
      setMode('host');
      // Poll until the second player joins (session status changes to Placement)
      pollForOpponent(sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session');
    } finally {
      setLoading(false);
    }
  };

  // Poll the WebSocket — connect and wait for SessionRestored with status=Placement
  const pollForOpponent = (sessionId: string) => {
    network.connect(sessionId, token.jwt);
    const unsub = network.onEvent((event) => {
      if (event.type === 'SessionRestored' && event.status === 'Placement') {
        unsub();
        onSessionReady(sessionId, token.accountId);
      }
    });
  };

  // Join via invite code
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { sessionId } = await network.joinSession(token.jwt, joinCode.trim().toUpperCase());
      onSessionReady(sessionId, token.accountId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid invite code');
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    void navigator.clipboard.writeText(inviteCode);
  };

  // ---- Choose mode ----
  if (mode === 'choose') {
    return (
      <div style={styles.container}>
        <button onClick={onBack} style={styles.backBtn}>← Back</button>
        <div style={styles.card}>
          <h2 style={styles.title}>🔗 Online — Invite</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button onClick={() => { void handleHost(); }} disabled={loading} style={styles.primaryBtn}>
              {loading ? 'Creating…' : '🏠 Create Game & Get Invite Code'}
            </button>
            <button onClick={() => setMode('join')} style={styles.secondaryBtn}>
              🎟️ Join with Invite Code
            </button>
          </div>
          {error && <div style={styles.error}>{error}</div>}
        </div>
      </div>
    );
  }

  // ---- Host: show invite code, wait for opponent ----
  if (mode === 'host') {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h2 style={styles.title}>⏳ Waiting for Opponent</h2>
          <p style={styles.subtitle}>Share this code with your friend:</p>
          <div style={styles.codeBox}>
            <span style={styles.codeText}>{inviteCode}</span>
            <button onClick={copyCode} style={styles.copyBtn} title="Copy">📋</button>
          </div>
          <p style={styles.hint}>The game will start automatically when they join.</p>
          <button onClick={onBack} style={styles.secondaryBtn}>Cancel</button>
        </div>
      </div>
    );
  }

  // ---- Join: enter invite code ----
  return (
    <div style={styles.container}>
      <button onClick={() => setMode('choose')} style={styles.backBtn}>← Back</button>
      <div style={styles.card}>
        <h2 style={styles.title}>🎟️ Enter Invite Code</h2>
        <form onSubmit={(e) => { void handleJoin(e); }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            maxLength={6}
            required
            style={{ ...styles.input, textAlign: 'center', fontSize: 24, letterSpacing: 6, fontWeight: 700 }}
          />
          {error && <div style={styles.error}>{error}</div>}
          <button type="submit" disabled={loading} style={styles.primaryBtn}>
            {loading ? 'Joining…' : 'Join Game'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#0f172a',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  backBtn: {
    alignSelf: 'flex-start',
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: 14,
    padding: '4px 0',
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  title: { margin: 0, color: '#f8fafc', fontSize: 22, fontWeight: 700, textAlign: 'center' },
  subtitle: { margin: 0, color: '#94a3b8', fontSize: 14, textAlign: 'center' },
  hint: { margin: 0, color: '#64748b', fontSize: 13, textAlign: 'center' },
  codeBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: '16px 20px',
    border: '2px solid #334155',
  },
  codeText: { fontSize: 32, fontWeight: 800, letterSpacing: 6, color: '#38bdf8', fontFamily: 'monospace' },
  copyBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 20,
    padding: 4,
  },
  input: {
    padding: '10px 12px',
    borderRadius: 6,
    border: '1px solid #334155',
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    fontSize: 14,
    outline: 'none',
  },
  primaryBtn: {
    padding: '12px 0',
    borderRadius: 8,
    border: 'none',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
  },
  secondaryBtn: {
    padding: '12px 0',
    borderRadius: 8,
    border: '1px solid #334155',
    backgroundColor: 'transparent',
    color: '#94a3b8',
    fontSize: 14,
    cursor: 'pointer',
  },
  error: {
    padding: '8px 12px',
    borderRadius: 6,
    backgroundColor: '#450a0a',
    border: '1px solid #dc2626',
    color: '#fca5a5',
    fontSize: 13,
  },
};

export default OnlineInvite;
