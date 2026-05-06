/**
 * BoardGrid — renders a 10×10 Sea Battle board with column/row labels,
 * cell status coloring, optional ship segment highlighting, and click handling.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 6.4, 8.4, 9.4
 */

import React from 'react';
import { Column, CellStatus } from '@sea-battle/domain';
import type { Cell, Ship, Coordinate } from '@sea-battle/domain';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface BoardGridProps {
  /** 100 cells representing the full 10×10 board. */
  cells: Cell[];
  /** Optional ships — when provided, ship segments are highlighted. */
  ships?: Ship[];
  /** Called when an Unshot cell is clicked (shooting phase). */
  onCellClick?: (coord: Coordinate) => void;
  /** When true, all cell clicks are disabled. */
  disabled?: boolean;
  /** Optional label rendered above the grid. */
  label?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLUMNS: Column[] = [
  Column.A, Column.B, Column.C, Column.D, Column.E,
  Column.F, Column.G, Column.H, Column.I, Column.J,
];

const ROWS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

const CELL_SIZE = 36; // px

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

/** Returns the background color for a cell based on its status and whether
 *  it contains a ship segment. */
function cellBackground(
  status: CellStatus,
  hasShip: boolean,
): string {
  switch (status) {
    case CellStatus.Miss:
      return '#93c5fd'; // light blue — water splash
    case CellStatus.Hit:
      return '#f97316'; // orange — fire
    case CellStatus.Sunk:
      return '#991b1b'; // dark red / crimson
    case CellStatus.Unshot:
    default:
      return hasShip ? '#475569' : '#f1f5f9'; // ship: slate-600, empty: light gray
  }
}

/** Returns the text/border color for a cell. */
function cellForeground(status: CellStatus): string {
  switch (status) {
    case CellStatus.Hit:
    case CellStatus.Sunk:
      return '#ffffff';
    case CellStatus.Miss:
      return '#1e3a5f';
    default:
      return '#334155';
  }
}

// ---------------------------------------------------------------------------
// BoardGrid component
// ---------------------------------------------------------------------------

export function BoardGrid({
  cells,
  ships,
  onCellClick,
  disabled = false,
  label,
}: BoardGridProps): React.ReactElement {
  // Build a lookup map: serialized coord → Cell for O(1) access
  const cellMap = React.useMemo(() => {
    const map = new Map<string, Cell>();
    for (const cell of cells) {
      map.set(`${cell.coord.col}${cell.coord.row}`, cell);
    }
    return map;
  }, [cells]);

  // Build a set of coordinates occupied by ships for quick lookup
  const shipCellSet = React.useMemo(() => {
    const set = new Set<string>();
    if (ships) {
      for (const ship of ships) {
        for (const coord of ship.cells) {
          set.add(`${coord.col}${coord.row}`);
        }
      }
    }
    return set;
  }, [ships]);

  const handleCellClick = React.useCallback(
    (cell: Cell) => {
      if (disabled) return;
      if (!onCellClick) return;
      // LOG-02: only Unshot cells are clickable
      if (cell.status !== CellStatus.Unshot) return;
      onCellClick(cell.coord);
    },
    [disabled, onCellClick],
  );

  return (
    <div style={{ display: 'inline-block', userSelect: 'none' }}>
      {/* Optional label */}
      {label && (
        <div
          style={{
            textAlign: 'center',
            fontWeight: 600,
            fontSize: 14,
            marginBottom: 6,
            color: '#1e293b',
          }}
        >
          {label}
        </div>
      )}

      {/* Grid wrapper: column labels row + (row label + cells) rows */}
      <div style={{ display: 'inline-grid' }}>
        {/* Column header row: empty corner + A–J labels */}
        <div style={{ display: 'flex' }}>
          {/* Corner spacer */}
          <div style={{ width: CELL_SIZE, height: CELL_SIZE }} />
          {COLUMNS.map((col) => (
            <div
              key={col}
              aria-label={`column-${col}`}
              style={{
                width: CELL_SIZE,
                height: CELL_SIZE,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
                fontSize: 13,
                color: '#475569',
              }}
            >
              {col}
            </div>
          ))}
        </div>

        {/* Data rows */}
        {ROWS.map((row) => (
          <div key={row} style={{ display: 'flex' }}>
            {/* Row label */}
            <div
              aria-label={`row-${row}`}
              style={{
                width: CELL_SIZE,
                height: CELL_SIZE,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
                fontSize: 13,
                color: '#475569',
              }}
            >
              {row}
            </div>

            {/* Cells for this row */}
            {COLUMNS.map((col) => {
              const key = `${col}${row}`;
              const cell = cellMap.get(key);
              if (!cell) return null;

              const hasShip = shipCellSet.has(key);
              const bg = cellBackground(cell.status, hasShip);
              const fg = cellForeground(cell.status);
              const isClickable =
                !disabled &&
                !!onCellClick &&
                cell.status === CellStatus.Unshot;

              return (
                <div
                  key={key}
                  role="button"
                  aria-label={`cell-${col}${row}`}
                  aria-disabled={!isClickable}
                  tabIndex={isClickable ? 0 : -1}
                  onClick={() => handleCellClick(cell)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleCellClick(cell);
                    }
                  }}
                  style={{
                    width: CELL_SIZE,
                    height: CELL_SIZE,
                    backgroundColor: bg,
                    color: fg,
                    border: '1px solid #cbd5e1',
                    boxSizing: 'border-box',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    cursor: isClickable ? 'pointer' : 'default',
                    transition: 'background-color 0.15s',
                  }}
                >
                  {cell.status === CellStatus.Hit && '🔥'}
                  {cell.status === CellStatus.Sunk && '💥'}
                  {cell.status === CellStatus.Miss && '·'}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default BoardGrid;
