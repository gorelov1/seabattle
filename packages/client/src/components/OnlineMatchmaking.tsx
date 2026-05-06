/**
 * OnlineMatchmaking — enter the queue and wait to be paired with a random opponent.
 *
 * Requirements: 14.1, 14.2, 14.3, 14.4
 */

import React from 'react';
import { network } from '../network';
import type { AuthToken } from '../types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface OnlineMatchmakingProps {
  token: AuthToken;
  onSessionReady: (sessionId: string, myPlayerId: string) => void;
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// OnlineMatchmaking component
// ---------------------------------------------------------------------------

export function OnlineMatchmaking({ token, onSessionReady, onBack }: OnlineMatchmakingProps): React.ReactElement {
  const [status, setStatus] = React.useState<'idle' | 'queued' | 'error'>('idle');
  const [error, setError] = React.useState<string | null>(null);
  const [dots, setDots] = React.useState('');

  // Animate the waiting dots
  React.useEffect(() => {
    if (status !== 'queued') return;
    const id = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '' : d + '.'));
    }, 500);
    return () => clearInterval(id);
  }, [status]);

  const handleEnqueue = async () => {
    setError(null);
    setStatus('queued');
    try {
      await network.enqueueMatchmaking(token.jwt);
      // Connect WebSocket — server will push SessionRestored once paired
      // We use a temporary connection to the matchmaking endpoint.
      // The server pairs players and creates a session; we poll via a
      // short-lived WebSocket on a dummy session until we get a real one.
      // Simpler approach: poll the enqueue endpoint and watch for a session.
      pollForSession();
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to join queue');
    }
  };

  const pollForSession = () => {
    // The server pairs players and the client needs to know the sessionId.
    // We poll the REST API every 2 seconds to check if we've been paired.
    // When paired, the server returns a sessionId in the queue ticket.
    const intervalId = setInterval(async () => {
      try {
        const result = await network.enqueueMatchmaking(token.jwt);
        if ('sessionId' in result && typeof result.sessionId === 'string') {
          clearInterval(intervalId);
          onSessionReady(result.sessionId as string, token.accountId);
        }
      } catch {
        // Still waiting — ignore errors during polling
      }
    }, 2000);

    // Store interval id so cancel can clear it
    cancelRef.current = intervalId;
  };

  const cancelRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const handleCancel = async () => {
    if (cancelRef.current !== null) {
      clearInterval(cancelRef.current);
      cancelRef.current = null;
    }
    try {
      await network.dequeueMatchmaking(token.jwt);
    } catch {
      // Best-effort cancel
    }
    onBack();
  };

  return (
    <div style={styles.container}>
      {status !== 'queued' && (
        <button onClick={onBack} style={styles.backBtn}>← Back</button>
      )}

      <div style={styles.card}>
        <h2 style={styles.title}>🌐 Matchmaking</h2>

        {status === 'idle' && (
          <>
            <p style={styles.subtitle}>Find a random opponent online.</p>
            <button onClick={() => { void handleEnqueue(); }} style={styles.primaryBtn}>
              🔍 Find Match
            </button>
          </>
        )}

        {status === 'queued' && (
          <>
            <div style={styles.spinner}>🌊</div>
            <p style={styles.waitText}>Searching for opponent{dots}</p>
            <p style={styles.hint}>This may take a moment.</p>
            <button onClick={() => { void handleCancel(); }} style={styles.cancelBtn}>
              Cancel
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            {error && <div style={styles.error}>{error}</div>}
            <button onClick={() => { void handleEnqueue(); }} style={styles.primaryBtn}>
              Try Again
            </button>
          </>
        )}
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
    maxWidth: 360,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 20,
    textAlign: 'center',
  },
  title: { margin: 0, color: '#f8fafc', fontSize: 22, fontWeight: 700 },
  subtitle: { margin: 0, color: '#94a3b8', fontSize: 14 },
  hint: { margin: 0, color: '#64748b', fontSize: 13 },
  spinner: { fontSize: 48, animation: 'spin 2s linear infinite' },
  waitText: { margin: 0, color: '#38bdf8', fontSize: 18, fontWeight: 600, minWidth: 220 },
  primaryBtn: {
    width: '100%',
    padding: '12px 0',
    borderRadius: 8,
    border: 'none',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
  },
  cancelBtn: {
    width: '100%',
    padding: '10px 0',
    borderRadius: 8,
    border: '1px solid #334155',
    backgroundColor: 'transparent',
    color: '#94a3b8',
    fontSize: 14,
    cursor: 'pointer',
  },
  error: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 6,
    backgroundColor: '#450a0a',
    border: '1px solid #dc2626',
    color: '#fca5a5',
    fontSize: 13,
  },
};

export default OnlineMatchmaking;
