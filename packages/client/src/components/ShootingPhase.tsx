/**
 * ShootingPhase — displays both boards side-by-side during the shooting phase,
 * plus a ship status panel for each player.
 *
 * Requirements: 6.1–6.5, 7.1–7.4, 8.1–8.4, 13.6, 13.7
 */

import React from 'react';
import { ShipType, shipSize } from '@sea-battle/domain';
import type { Board, Coordinate, Ship } from '@sea-battle/domain';
import { BoardGrid } from './BoardGrid';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ShootingPhaseProps {
  myBoard: Board;
  opponentBoard: Board;
  activePlayer: string;
  myPlayerId: string;
  onFireShot: (coord: Coordinate) => void;
  lastShotResult?: string;
  /** Serialized coord of the last shot on the opponent board, e.g. "G7" */
  lastOpponentShotCoord?: string;
  /** Serialized coord of the last shot on my board (incoming), e.g. "B3" */
  lastIncomingShotCoord?: string;
  /** When true, disable firing (e.g. AI is thinking) */
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Ship status panel
// ---------------------------------------------------------------------------

const SHIP_ORDER: ShipType[] = [
  ShipType.Battleship,
  ShipType.Cruiser,
  ShipType.Destroyer,
  ShipType.PatrolBoat,
];

const SHIP_LABEL: Record<ShipType, string> = {
  [ShipType.Battleship]: 'Battleship',
  [ShipType.Cruiser]:    'Cruiser',
  [ShipType.Destroyer]:  'Destroyer',
  [ShipType.PatrolBoat]: 'Patrol Boat',
};

function shipStatus(ship: Ship): 'sunk' | 'hit' | 'healthy' {
  if (ship.sunk) return 'sunk';
  if (ship.hitCount > 0) return 'hit';
  return 'healthy';
}

interface FleetPanelProps {
  ships: Ship[];
  label: string;
  /**
   * When true (enemy fleet): hide ship type and hit count until fully sunk.
   * Only show: unknown pips for healthy/hit ships, full info for sunk ships.
   */
  enemy?: boolean;
}

function FleetPanel({ ships, label, enemy = false }: FleetPanelProps): React.ReactElement {
  // Group by type
  const byType = React.useMemo(() => {
    const map = new Map<ShipType, Ship[]>();
    for (const type of SHIP_ORDER) map.set(type, []);
    for (const ship of ships) {
      map.get(ship.type)?.push(ship);
    }
    return map;
  }, [ships]);

  // For the enemy panel we only know about sunk ships — count them
  const sunkByType = React.useMemo(() => {
    if (!enemy) return null;
    const map = new Map<ShipType, number>();
    for (const type of SHIP_ORDER) map.set(type, 0);
    for (const ship of ships) {
      if (ship.sunk) map.set(ship.type, (map.get(ship.type) ?? 0) + 1);
    }
    return map;
  }, [ships, enemy]);

  // Total ships per type from FLEET_SPEC
  const TOTAL: Record<ShipType, number> = {
    [ShipType.Battleship]: 1,
    [ShipType.Cruiser]:    2,
    [ShipType.Destroyer]:  3,
    [ShipType.PatrolBoat]: 4,
  };

  return (
    <div style={{ minWidth: 160 }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
        {label}
      </div>

      {enemy ? (
        // Enemy panel: always show the full fleet grid (1×4, 2×3, 3×2, 4×1).
        // Multi-cell ships: pips stay grey until sunk (no hit hints).
        // PatrolBoat (1-cell): sunk on first hit, so showing red is fine.
        // Sunk ships: show red pips + "SUNK".
        SHIP_ORDER.map((type) => {
          const total = TOTAL[type];
          const sunkCount = sunkByType?.get(type) ?? 0;
          const size = shipSize(type);
          return (
            <div key={type} style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 3 }}>
                {SHIP_LABEL[type]} ({size})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {Array.from({ length: total }).map((_, i) => {
                  const isSunk = i < sunkCount;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ display: 'flex', gap: 2 }}>
                        {Array.from({ length: size }).map((_, seg) => (
                          <div
                            key={seg}
                            style={{
                              width: 10, height: 10, borderRadius: 2,
                              backgroundColor: isSunk ? '#991b1b' : '#334155',
                              border: '1px solid #1e293b',
                            }}
                          />
                        ))}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: isSunk ? '#f87171' : '#475569' }}>
                        {isSunk ? 'SUNK' : '?'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      ) : (
        // Own fleet panel: full info always visible
        SHIP_ORDER.map((type) => {
          const group = byType.get(type) ?? [];
          const size = shipSize(type);
          return (
            <div key={type} style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 3 }}>
                {SHIP_LABEL[type]} ({size})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {group.map((ship, i) => {
                  const st = shipStatus(ship);
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ display: 'flex', gap: 2 }}>
                        {Array.from({ length: size }).map((_, seg) => {
                          let bg = '#475569';
                          if (st === 'sunk') bg = '#991b1b';
                          else if (st === 'hit' && seg < ship.hitCount) bg = '#f97316';
                          return (
                            <div key={seg} style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: bg, border: '1px solid #1e293b' }} />
                          );
                        })}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: st === 'sunk' ? '#f87171' : st === 'hit' ? '#fb923c' : '#4ade80' }}>
                        {st === 'sunk' ? 'SUNK' : st === 'hit' ? `HIT (${ship.hitCount}/${size})` : 'OK'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
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
  lastOpponentShotCoord,
  lastIncomingShotCoord,
  disabled = false,
}: ShootingPhaseProps): React.ReactElement {
  const isMyTurn = !disabled && activePlayer === myPlayerId;

  const myCells = React.useMemo(() => Array.from(myBoard.cells.values()), [myBoard]);
  const opponentCells = React.useMemo(() => Array.from(opponentBoard.cells.values()), [opponentBoard]);

  const resultStyle = React.useMemo((): React.CSSProperties => {
    switch (lastShotResult) {
      case 'Sunk':  return { backgroundColor: '#991b1b', color: '#fff' };
      case 'Hit':   return { backgroundColor: '#f97316', color: '#fff' };
      case 'Miss':  return { backgroundColor: '#93c5fd', color: '#1e3a5f' };
      default:      return { backgroundColor: '#e2e8f0', color: '#1e293b' };
    }
  }, [lastShotResult]);

  return (
    <div style={{ padding: 16, backgroundColor: '#0f172a', minHeight: '100vh', color: '#f8fafc' }}>
      {/* Turn indicator */}
      <div style={{
        marginBottom: 16,
        padding: '10px 16px',
        borderRadius: 8,
        backgroundColor: isMyTurn ? '#1e3a5f' : '#1e293b',
        border: `2px solid ${isMyTurn ? '#3b82f6' : '#334155'}`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: isMyTurn ? '#93c5fd' : '#64748b' }}>
          {disabled ? '🤖 AI is thinking…' : isMyTurn ? '🎯 Your turn — click a cell to fire!' : '⏳ Waiting for opponent…'}
        </span>
        {lastShotResult && (
          <span aria-live="polite" style={{ padding: '4px 10px', borderRadius: 20, fontSize: 13, fontWeight: 600, ...resultStyle }}>
            Last shot: {lastShotResult}
          </span>
        )}
      </div>

      {/* Main layout: fleet panel | opponent board | my board | fleet panel */}
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>

        {/* My fleet status */}
        <FleetPanel ships={myBoard.ships} label="My Fleet" />

        {/* Opponent board */}
        <div>
          <BoardGrid
            cells={opponentCells}
            onCellClick={isMyTurn ? onFireShot : undefined}
            disabled={!isMyTurn}
            label="Opponent's Board"
            lastShotCoord={lastOpponentShotCoord}
          />
        </div>

        {/* My board */}
        <div>
          <BoardGrid
            cells={myCells}
            ships={myBoard.ships}
            label="Your Board"
            lastShotCoord={lastIncomingShotCoord}
          />
        </div>

        {/* Opponent fleet status (hidden — show only sunk ships) */}
        <FleetPanel ships={opponentBoard.ships} label="Enemy Fleet" enemy />
      </div>
    </div>
  );
}

export default ShootingPhase;
