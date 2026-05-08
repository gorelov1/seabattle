/**
 * PlacementPhase — UI for placing ships on the board before the match starts.
 *
 * Features:
 * - Ghost ship preview on hover/touch (blue = valid, red = invalid)
 * - Toast error overlay that dismisses on tap or auto-fades
 *
 * Requirements: 3.1–3.4, 4.1–4.4, 5.1, 5.2, 5.3, 12.2
 */

import React from 'react';
import {
  ShipType,
  Orientation,
  FLEET_SPEC,
  shipSize,
  Column,
  placeShip,
} from '@sea-battle/domain';
import type { Board, Coordinate, ShipPlacement } from '@sea-battle/domain';
import { BoardGrid } from './BoardGrid';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PlacementPhaseProps {
  board: Board;
  onPlaceShip: (placement: ShipPlacement) => void;
  onRemoveShip: (coord: Coordinate) => void;
  onReady: () => void;
  onAutoPlace?: () => void;
  error?: string;
  isReady: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SHIP_TYPES: ShipType[] = [
  ShipType.Battleship,
  ShipType.Cruiser,
  ShipType.Destroyer,
  ShipType.PatrolBoat,
];

const REQUIRED_COUNTS: Record<ShipType, number> = {
  [ShipType.Battleship]: FLEET_SPEC.battleships,
  [ShipType.Cruiser]:    FLEET_SPEC.cruisers,
  [ShipType.Destroyer]:  FLEET_SPEC.destroyers,
  [ShipType.PatrolBoat]: FLEET_SPEC.patrolBoats,
};

const SHIP_LABELS: Record<ShipType, string> = {
  [ShipType.Battleship]: 'Battleship',
  [ShipType.Cruiser]:    'Cruiser',
  [ShipType.Destroyer]:  'Destroyer',
  [ShipType.PatrolBoat]: 'Patrol Boat',
};

const COLUMN_ORDER = ['A','B','C','D','E','F','G','H','I','J'] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countPlaced(board: Board): Record<ShipType, number> {
  const counts: Record<ShipType, number> = {
    [ShipType.Battleship]: 0,
    [ShipType.Cruiser]:    0,
    [ShipType.Destroyer]:  0,
    [ShipType.PatrolBoat]: 0,
  };
  for (const ship of board.ships) {
    counts[ship.type] = (counts[ship.type] ?? 0) + 1;
  }
  return counts;
}

/** Compute the cells a ship would occupy given origin + orientation. */
function computeGhostCells(
  origin: Coordinate,
  type: ShipType,
  orientation: Orientation,
): string[] {
  const size = shipSize(type);
  const colIdx = COLUMN_ORDER.indexOf(origin.col as typeof COLUMN_ORDER[number]);
  const keys: string[] = [];
  for (let i = 0; i < size; i++) {
    if (orientation === Orientation.Horizontal) {
      const ci = colIdx + i;
      if (ci > 9) return []; // out of bounds
      keys.push(`${COLUMN_ORDER[ci]}${origin.row}`);
    } else {
      const r = origin.row + i;
      if (r > 10) return []; // out of bounds
      keys.push(`${origin.col}${r}`);
    }
  }
  return keys;
}

// ---------------------------------------------------------------------------
// PlacementPhase component
// ---------------------------------------------------------------------------

export function PlacementPhase({
  board,
  onPlaceShip,
  onRemoveShip,
  onReady,
  onAutoPlace,
  error,
  isReady,
}: PlacementPhaseProps): React.ReactElement {
  const [selectedType, setSelectedType] = React.useState<ShipType>(ShipType.Battleship);
  const [orientation, setOrientation] = React.useState<Orientation>(Orientation.Horizontal);
  const [hoverCoord, setHoverCoord] = React.useState<Coordinate | null>(null);
  const [toastVisible, setToastVisible] = React.useState(false);
  const toastTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const placedCounts = React.useMemo(() => countPlaced(board), [board]);

  // Auto-advance to next unplaced ship type
  React.useEffect(() => {
    const remaining = SHIP_TYPES.find(t => placedCounts[t] < REQUIRED_COUNTS[t]);
    if (remaining !== undefined) setSelectedType(remaining);
  }, [placedCounts]);

  // Show toast when error prop changes
  React.useEffect(() => {
    if (!error) { setToastVisible(false); return; }
    setToastVisible(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastVisible(false), 3000);
    return () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); };
  }, [error]);

  // Compute ghost cells map
  const ghostCells = React.useMemo((): Map<string, 'valid' | 'invalid'> => {
    if (!hoverCoord) return new Map();
    const keys = computeGhostCells(hoverCoord, selectedType, orientation);
    if (keys.length === 0) {
      // Out of bounds — show red on origin
      return new Map([[`${hoverCoord.col}${hoverCoord.row}`, 'invalid']]);
    }
    // Check if placement would be valid
    const testResult = placeShip(board, {
      type: selectedType,
      origin: hoverCoord,
      orientation,
    });
    const state: 'valid' | 'invalid' = testResult.ok ? 'valid' : 'invalid';
    const map = new Map<string, 'valid' | 'invalid'>();
    for (const k of keys) map.set(k, state);
    return map;
  }, [hoverCoord, selectedType, orientation, board]);

  const handleCellClick = React.useCallback((coord: Coordinate) => {
    onPlaceShip({ type: selectedType, origin: coord, orientation });
  }, [onPlaceShip, selectedType, orientation]);

  const handleShipCellClick = React.useCallback((coord: Coordinate) => {
    onRemoveShip(coord);
  }, [onRemoveShip]);

  const handleCellHover = React.useCallback((coord: Coordinate | null) => {
    setHoverCoord(coord);
  }, []);

  const cells = React.useMemo(() => Array.from(board.cells.values()), [board]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 8, backgroundColor: '#0f172a', minHeight: '100%', color: '#f8fafc' }}>

      {/* Board — positioned relative so toast can overlay it */}
      <div style={{ position: 'relative', alignSelf: 'flex-start' }}>
        <BoardGrid
          cells={cells}
          ships={board.ships}
          onCellClick={handleCellClick}
          onShipCellClick={handleShipCellClick}
          onCellHover={handleCellHover}
          ghostCells={ghostCells}
          label="Tap to place · Tap ship to remove"
        />

        {/* Toast error — overlays the board */}
        {toastVisible && error && (
          <div
            onClick={() => setToastVisible(false)}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: 'rgba(30,10,10,0.92)',
              border: '1px solid #dc2626',
              borderRadius: 10,
              padding: '12px 16px',
              color: '#fca5a5',
              fontSize: 14,
              fontWeight: 600,
              textAlign: 'center',
              maxWidth: '80%',
              zIndex: 10,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
            }}
          >
            <span style={{ flex: 1 }}>{error}</span>
            <span style={{ fontSize: 18, lineHeight: 1, color: '#f87171' }}>✕</span>
          </div>
        )}
      </div>

      {/* Controls row */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>

        {/* Ship selector */}
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Select Ship</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {SHIP_TYPES.map((type) => {
              const placed = placedCounts[type];
              const required = REQUIRED_COUNTS[type];
              const remaining = required - placed;
              const isSelected = selectedType === type;
              const isDone = remaining <= 0;
              return (
                <button
                  key={type}
                  onClick={() => !isDone && setSelectedType(type)}
                  disabled={isDone}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: isSelected ? '2px solid #3b82f6' : '1px solid #334155',
                    backgroundColor: isDone ? '#1e293b' : isSelected ? '#1e3a5f' : '#1e293b',
                    color: isDone ? '#475569' : '#f8fafc',
                    cursor: isDone ? 'default' : 'pointer',
                    fontSize: 12,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span>{SHIP_LABELS[type]} <span style={{ color: '#64748b' }}>({shipSize(type)})</span></span>
                  <span style={{ fontWeight: 700, color: isDone ? '#22c55e' : '#f59e0b', fontSize: 11 }}>
                    {isDone ? '✓' : `${remaining}×`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right column: orientation + buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 120 }}>
          {/* Orientation */}
          <div>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Direction</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {([Orientation.Horizontal, Orientation.Vertical] as Orientation[]).map((o) => (
                <button
                  key={o}
                  onClick={() => setOrientation(o)}
                  style={{
                    flex: 1,
                    padding: '6px 4px',
                    borderRadius: 6,
                    border: orientation === o ? '2px solid #3b82f6' : '1px solid #334155',
                    backgroundColor: orientation === o ? '#1e3a5f' : '#1e293b',
                    color: '#f8fafc',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: orientation === o ? 700 : 400,
                  }}
                >
                  {o === Orientation.Horizontal ? '↔' : '↕'}
                </button>
              ))}
            </div>
          </div>

          {/* Auto-place */}
          {onAutoPlace && (
            <button
              onClick={onAutoPlace}
              style={{
                padding: '8px 10px',
                borderRadius: 6,
                border: '1px solid #334155',
                backgroundColor: '#1e293b',
                color: '#94a3b8',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              🎲 Auto
            </button>
          )}

          {/* Ready */}
          <button
            onClick={onReady}
            disabled={!isReady}
            style={{
              padding: '10px 10px',
              borderRadius: 6,
              border: 'none',
              backgroundColor: isReady ? '#3b82f6' : '#1e293b',
              color: isReady ? '#ffffff' : '#475569',
              cursor: isReady ? 'pointer' : 'default',
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            ✓ Ready
          </button>
        </div>
      </div>
    </div>
  );
}

export default PlacementPhase;
