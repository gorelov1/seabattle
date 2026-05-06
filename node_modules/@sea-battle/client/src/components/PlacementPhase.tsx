/**
 * PlacementPhase — UI for placing ships on the board before the match starts.
 *
 * Requirements: 3.1–3.4, 4.1–4.4, 5.1, 5.2, 5.3, 12.2
 */

import React from 'react';
import {
  ShipType,
  Orientation,
  FLEET_SPEC,
  shipSize,
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
// Fleet spec helpers
// ---------------------------------------------------------------------------

/** All ship types in display order. */
const SHIP_TYPES: ShipType[] = [
  ShipType.Battleship,
  ShipType.Cruiser,
  ShipType.Destroyer,
  ShipType.PatrolBoat,
];

/** Required count per ship type from FLEET_SPEC. */
const REQUIRED_COUNTS: Record<ShipType, number> = {
  [ShipType.Battleship]: FLEET_SPEC.battleships,
  [ShipType.Cruiser]: FLEET_SPEC.cruisers,
  [ShipType.Destroyer]: FLEET_SPEC.destroyers,
  [ShipType.PatrolBoat]: FLEET_SPEC.patrolBoats,
};

/** Human-readable ship type labels. */
const SHIP_LABELS: Record<ShipType, string> = {
  [ShipType.Battleship]: 'Battleship',
  [ShipType.Cruiser]: 'Cruiser',
  [ShipType.Destroyer]: 'Destroyer',
  [ShipType.PatrolBoat]: 'Patrol Boat',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Counts how many ships of each type are already placed on the board. */
function countPlaced(board: Board): Record<ShipType, number> {
  const counts: Record<ShipType, number> = {
    [ShipType.Battleship]: 0,
    [ShipType.Cruiser]: 0,
    [ShipType.Destroyer]: 0,
    [ShipType.PatrolBoat]: 0,
  };
  for (const ship of board.ships) {
    counts[ship.type] = (counts[ship.type] ?? 0) + 1;
  }
  return counts;
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

  const placedCounts = React.useMemo(() => countPlaced(board), [board]);

  // Automatically advance selectedType to the next ship that still needs placing
  React.useEffect(() => {
    const remaining = SHIP_TYPES.find(
      (t) => placedCounts[t] < REQUIRED_COUNTS[t],
    );
    if (remaining !== undefined) {
      setSelectedType(remaining);
    }
  }, [placedCounts]);

  const handleCellClick = React.useCallback(
    (coord: Coordinate) => {
      onPlaceShip({ type: selectedType, origin: coord, orientation });
    },
    [onPlaceShip, selectedType, orientation],
  );

  // Clicking an occupied ship cell removes that ship
  const handleShipCellClick = React.useCallback(
    (coord: Coordinate) => {
      onRemoveShip(coord);
    },
    [onRemoveShip],
  );

  const cells = React.useMemo(() => Array.from(board.cells.values()), [board]);

  return (
    <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', padding: 16 }}>
      {/* Left panel: board */}
      <div>
        <BoardGrid
          cells={cells}
          ships={board.ships}
          onCellClick={handleCellClick}
          onShipCellClick={handleShipCellClick}
          label="Your Board — Place Your Ships (click a ship to remove it)"
        />
      </div>

      {/* Right panel: controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 220 }}>
        {/* Ship selector */}
        <div>
          <h3 style={{ margin: '0 0 8px', fontSize: 15, color: '#1e293b' }}>
            Select Ship
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
                  aria-pressed={isSelected}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: isSelected ? '2px solid #3b82f6' : '2px solid #e2e8f0',
                    backgroundColor: isDone
                      ? '#f1f5f9'
                      : isSelected
                      ? '#eff6ff'
                      : '#ffffff',
                    color: isDone ? '#94a3b8' : '#1e293b',
                    cursor: isDone ? 'not-allowed' : 'pointer',
                    textAlign: 'left',
                    fontSize: 13,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span>
                    {SHIP_LABELS[type]}
                    <span style={{ fontSize: 11, color: '#64748b', marginLeft: 6 }}>
                      (size {shipSize(type)})
                    </span>
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: isDone ? '#22c55e' : '#f59e0b',
                    }}
                  >
                    {isDone ? '✓' : `${remaining} left`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Orientation toggle */}
        <div>
          <h3 style={{ margin: '0 0 8px', fontSize: 15, color: '#1e293b' }}>
            Orientation
          </h3>
          <div style={{ display: 'flex', gap: 8 }}>
            {([Orientation.Horizontal, Orientation.Vertical] as Orientation[]).map((o) => (
              <button
                key={o}
                onClick={() => setOrientation(o)}
                aria-pressed={orientation === o}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  borderRadius: 6,
                  border: orientation === o ? '2px solid #3b82f6' : '2px solid #e2e8f0',
                  backgroundColor: orientation === o ? '#eff6ff' : '#ffffff',
                  color: '#1e293b',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: orientation === o ? 600 : 400,
                }}
              >
                {o === Orientation.Horizontal ? '↔ Horizontal' : '↕ Vertical'}
              </button>
            ))}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div
            role="alert"
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              backgroundColor: '#fef2f2',
              border: '1px solid #fca5a5',
              color: '#dc2626',
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 'auto' }}>
          {onAutoPlace && (
            <button
              onClick={onAutoPlace}
              style={{
                padding: '10px 16px',
                borderRadius: 6,
                border: '1px solid #e2e8f0',
                backgroundColor: '#f8fafc',
                color: '#475569',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              🎲 Auto-place
            </button>
          )}

          <button
            onClick={onReady}
            disabled={!isReady}
            style={{
              padding: '10px 16px',
              borderRadius: 6,
              border: 'none',
              backgroundColor: isReady ? '#3b82f6' : '#cbd5e1',
              color: isReady ? '#ffffff' : '#94a3b8',
              cursor: isReady ? 'pointer' : 'not-allowed',
              fontSize: 14,
              fontWeight: 600,
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
