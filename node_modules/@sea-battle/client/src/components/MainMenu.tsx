/**
 * MainMenu — the game's main menu screen.
 *
 * Requirements: 12.1, 13.1, 14.1, 14.3, 14.4, 15.1, 15.2, 16.1, 17.1
 */

import React from 'react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface MainMenuProps {
  onLocalGame: () => void;
  onAiGame: () => void;
  onInviteGame: () => void;
  onMatchmaking: () => void;
  onAccountSettings: () => void;
  currentUser?: { displayName: string; profileIcon: string } | null;
}

// ---------------------------------------------------------------------------
// MainMenu component
// ---------------------------------------------------------------------------

export function MainMenu({
  onLocalGame,
  onAiGame,
  onInviteGame,
  onMatchmaking,
  onAccountSettings,
  currentUser,
}: MainMenuProps): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: 32,
        gap: 24,
        backgroundColor: '#0f172a',
        color: '#f8fafc',
      }}
    >
      {/* Game title */}
      <h1
        style={{
          fontSize: 56,
          fontWeight: 900,
          letterSpacing: '-1px',
          margin: 0,
          color: '#38bdf8',
          textShadow: '0 0 40px rgba(56,189,248,0.4)',
        }}
      >
        ⚓ Sea Battle
      </h1>

      {/* User info / login link */}
      <div
        style={{
          fontSize: 14,
          color: '#94a3b8',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {currentUser ? (
          <>
            <span style={{ fontSize: 22 }}>{currentUser.profileIcon}</span>
            <span style={{ fontWeight: 600, color: '#e2e8f0' }}>
              {currentUser.displayName}
            </span>
          </>
        ) : (
          <button
            onClick={onAccountSettings}
            style={{
              background: 'none',
              border: 'none',
              color: '#38bdf8',
              cursor: 'pointer',
              fontSize: 14,
              textDecoration: 'underline',
              padding: 0,
            }}
          >
            Login / Register
          </button>
        )}
      </div>

      {/* Game mode buttons */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          width: '100%',
          maxWidth: 320,
        }}
      >
        <MenuButton
          icon="👥"
          label="Local 2-Player"
          description="Play on the same device"
          onClick={onLocalGame}
          primary
        />
        <MenuButton
          icon="🤖"
          label="vs AI"
          description="Challenge the computer"
          onClick={onAiGame}
          primary
        />
        <MenuButton
          icon="🔗"
          label="Online (Invite)"
          description="Invite a friend with a code"
          onClick={onInviteGame}
        />
        <MenuButton
          icon="🌐"
          label="Online (Matchmaking)"
          description="Find a random opponent"
          onClick={onMatchmaking}
        />
      </div>

      {/* Account settings */}
      <button
        onClick={onAccountSettings}
        style={{
          marginTop: 8,
          padding: '8px 20px',
          borderRadius: 6,
          border: '1px solid #334155',
          backgroundColor: 'transparent',
          color: '#94a3b8',
          cursor: 'pointer',
          fontSize: 13,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        ⚙️ Account Settings
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal helper component
// ---------------------------------------------------------------------------

interface MenuButtonProps {
  icon: string;
  label: string;
  description: string;
  onClick: () => void;
  primary?: boolean;
}

function MenuButton({
  icon,
  label,
  description,
  onClick,
  primary = false,
}: MenuButtonProps): React.ReactElement {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '14px 20px',
        borderRadius: 10,
        border: primary ? 'none' : '1px solid #334155',
        backgroundColor: primary ? '#1d4ed8' : '#1e293b',
        color: '#f8fafc',
        cursor: 'pointer',
        textAlign: 'left',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        transition: 'background-color 0.15s',
      }}
    >
      <span style={{ fontSize: 24 }}>{icon}</span>
      <span>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{label}</div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{description}</div>
      </span>
    </button>
  );
}

export default MainMenu;
