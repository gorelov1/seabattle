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
  cells: Cell[];
  ships?: Ship[];
  onCellClick?: (coord: Coordinate) => void;
  disabled?: boolean;
  label?: string;
  /** Coordinate of the most recent shot — that cell blinks. */
  lastShotCoord?: string; // serialized, e.g. "G7"
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLUMNS: Column[] = [
  Column.A, Column.B, Column.C, Column.D, Column.E,
  Column.F, Column.G, Column.H, Column.I, Column.J,
];

const ROWS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

const CELL_SIZE = 36;

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

function cellBackground(status: CellStatus, hasShip: boolean): string {
  switch (status) {
    case CellStatus.Miss:  return '#93c5fd';
    case CellStatus.Hit:   return '#f97316';
    case CellStatus.Sunk:  return '#991b1b';
    case CellStatus.Unshot:
    default:
      return hasShip ? '#475569' : '#f1f5f9';
  }
}

function cellForeground(status: CellStatus): string {
  switch (status) {
    case CellStatus.Hit:
    case CellStatus.Sunk:  return '#ffffff';
    case CellStatus.Miss:  return '#1e3a5f';
    default:               return '#334155';
  }
}

// ---------------------------------------------------------------------------
// Blink keyframe injected once
// ---------------------------------------------------------------------------

let blinkStyleInjected = false;
function ensureBlinkStyle(): void {
  if (blinkStyleInjected) return;
  blinkStyleInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes sea-blink {
      0%, 100% { opacity: 1; transform: scale(1); }
      50%       { opacity: 0.35; transform: scale(1.18); }
    }
    .sea-last-shot {
      animation: sea-blink 0.7s ease-in-out infinite;
      z-index: 1;
      position: relative;
    }
  `;
  document.head.appendChild(style);
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
  lastShotCoord,
}: BoardGridProps): React.ReactElement {
  React.useEffect(() => { ensureBlinkStyle(); }, []);

  const cellMap = React.useMemo(() => {
    const map = new Map<string, Cell>();
    for (const cell of cells) {
      map.set(`${cell.coord.col}${cell.coord.row}`, cell);
    }
    return map;
  }, [cells]);

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
      if (disabled || !onCellClick) return;
      if (cell.status !== CellStatus.Unshot) return;
      onCellClick(cell.coord);
    },
    [disabled, onCellClick],
  );

  return (
    <div style={{ display: 'inline-block', userSelect: 'none' }}>
      {label && (
        <div style={{ textAlign: 'center', fontWeight: 600, fontSize: 14, marginBottom: 6, color: '#1e293b' }}>
          {label}
        </div>
      )}

      <div style={{ display: 'inline-grid' }}>
        {/* Column headers */}
        <div style={{ display: 'flex' }}>
          <div style={{ width: CELL_SIZE, height: CELL_SIZE }} />
          {COLUMNS.map((col) => (
            <div key={col} style={{ width: CELL_SIZE, height: CELL_SIZE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 13, color: '#475569' }}>
              {col}
            </div>
          ))}
        </div>

        {/* Data rows */}
        {ROWS.map((row) => (
          <div key={row} style={{ display: 'flex' }}>
            <div style={{ width: CELL_SIZE, height: CELL_SIZE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 13, color: '#475569' }}>
              {row}
            </div>

            {COLUMNS.map((col) => {
              const key = `${col}${row}`;
              const cell = cellMap.get(key);
              if (!cell) return null;

              const hasShip = shipCellSet.has(key);
              const bg = cellBackground(cell.status, hasShip);
              const fg = cellForeground(cell.status);
              const isClickable = !disabled && !!onCellClick && cell.status === CellStatus.Unshot;
              const isLastShot = lastShotCoord === key;

              return (
                <div
                  key={key}
                  role="button"
                  aria-label={`cell-${col}${row}`}
                  aria-disabled={!isClickable}
                  tabIndex={isClickable ? 0 : -1}
                  className={isLastShot ? 'sea-last-shot' : undefined}
                  onClick={() => handleCellClick(cell)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCellClick(cell); }}
                  style={{
                    width: CELL_SIZE,
                    height: CELL_SIZE,
                    backgroundColor: bg,
                    color: fg,
                    border: isLastShot ? '2px solid #facc15' : '1px solid #cbd5e1',
                    boxSizing: 'border-box',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    cursor: isClickable ? 'pointer' : 'default',
                    transition: 'background-color 0.15s',
                  }}
                >
                  {cell.status === CellStatus.Hit  && '🔥'}
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
