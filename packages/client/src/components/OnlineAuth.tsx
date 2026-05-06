/**
 * OnlineAuth — login / register screen for online play.
 *
 * Requirements: 15.1, 15.2, 15.10, 15.11
 */

import React from 'react';
import { network } from '../network';
import type { AuthToken, UserAccount } from '../types';
import { ICON_LIBRARY } from '../iconLibrary';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface OnlineAuthProps {
  onAuth: (token: AuthToken, account: UserAccount) => void;
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// OnlineAuth component
// ---------------------------------------------------------------------------

export function OnlineAuth({ onAuth, onBack }: OnlineAuthProps): React.ReactElement {
  const [mode, setMode] = React.useState<'login' | 'register'>('login');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [displayName, setDisplayName] = React.useState('');
  const [profileIcon, setProfileIcon] = React.useState(ICON_LIBRARY[0] ?? '⚓');
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        const token = await network.login(email, password);
        // Fetch account info — use the token's accountId as a stand-in display
        const account: UserAccount = {
          id: token.accountId,
          email,
          displayName: email.split('@')[0] ?? email,
          profileIcon,
          verified: true,
          createdAt: new Date().toISOString(),
        };
        onAuth(token, account);
      } else {
        const account = await network.register(email, displayName, profileIcon, password);
        const token = await network.login(email, password);
        onAuth(token, account);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <button onClick={onBack} style={styles.backBtn}>← Back</button>

      <div style={styles.card}>
        <h2 style={styles.title}>
          {mode === 'login' ? '🔑 Login' : '📝 Register'}
        </h2>

        {/* Mode toggle */}
        <div style={styles.modeToggle}>
          <button
            onClick={() => setMode('login')}
            style={{ ...styles.modeBtn, ...(mode === 'login' ? styles.modeBtnActive : {}) }}
          >
            Login
          </button>
          <button
            onClick={() => setMode('register')}
            style={{ ...styles.modeBtn, ...(mode === 'register' ? styles.modeBtnActive : {}) }}
          >
            Register
          </button>
        </div>

        <form onSubmit={(e) => { void handleSubmit(e); }} style={styles.form}>
          <label style={styles.label}>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={styles.input}
              placeholder="you@example.com"
            />
          </label>

          {mode === 'register' && (
            <label style={styles.label}>
              Display Name
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                style={styles.input}
                placeholder="Captain Jack"
              />
            </label>
          )}

          {mode === 'register' && (
            <div>
              <div style={{ ...styles.label, marginBottom: 6 }}>Profile Icon</div>
              <div style={styles.iconGrid}>
                {ICON_LIBRARY.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setProfileIcon(icon)}
                    style={{
                      ...styles.iconBtn,
                      ...(profileIcon === icon ? styles.iconBtnSelected : {}),
                    }}
                    title={icon}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label style={styles.label}>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={styles.input}
              placeholder="••••••••"
            />
          </label>

          {error && <div style={styles.error}>{error}</div>}

          <button type="submit" disabled={loading} style={styles.submitBtn}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Login' : 'Create Account'}
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
  title: {
    margin: 0,
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: 700,
    textAlign: 'center',
  },
  modeToggle: {
    display: 'flex',
    borderRadius: 8,
    overflow: 'hidden',
    border: '1px solid #334155',
  },
  modeBtn: {
    flex: 1,
    padding: '8px 0',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
  },
  modeBtnActive: {
    backgroundColor: '#3b82f6',
    color: '#ffffff',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: 500,
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
  iconGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 6,
    border: '2px solid #334155',
    backgroundColor: '#0f172a',
    cursor: 'pointer',
    fontSize: 18,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnSelected: {
    border: '2px solid #3b82f6',
    backgroundColor: '#1d4ed8',
  },
  error: {
    padding: '8px 12px',
    borderRadius: 6,
    backgroundColor: '#450a0a',
    border: '1px solid #dc2626',
    color: '#fca5a5',
    fontSize: 13,
  },
  submitBtn: {
    padding: '12px 0',
    borderRadius: 8,
    border: 'none',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 4,
  },
};

export default OnlineAuth;
