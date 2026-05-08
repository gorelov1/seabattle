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
  onShipCellClick?: (coord: Coordinate) => void;
  onCellHover?: (coord: Coordinate | null) => void;
  disabled?: boolean;
  label?: string;
  lastShotCoord?: string;
  ghostCells?: Map<string, 'valid' | 'invalid'>;
  /** When true, sizes cells for half-screen width (side-by-side layout). */
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLUMNS: Column[] = [
  Column.A, Column.B, Column.C, Column.D, Column.E,
  Column.F, Column.G, Column.H, Column.I, Column.J,
];

const ROWS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

// Cell size: fit 11 columns (10 cells + 1 label) into the available width.
// `compact` mode uses half the screen width (for side-by-side boards).
function calcCellSize(compact = false): number {
  const w = compact
    ? Math.floor((window.innerWidth - 8) / 2)  // half screen minus gap
    : window.innerWidth;
  const size = Math.floor((w - 8) / 11);
  return Math.max(16, Math.min(size, 36));
}

function useCellSize(compact = false): number {
  const [size, setSize] = React.useState(() => calcCellSize(compact));
  React.useEffect(() => {
    const handler = () => setSize(calcCellSize(compact));
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [compact]);
  return size;
}

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
  onShipCellClick,
  onCellHover,
  disabled = false,
  label,
  lastShotCoord,
  ghostCells,
  compact = false,
}: BoardGridProps): React.ReactElement {
  React.useEffect(() => { ensureBlinkStyle(); }, []);

  const CELL_SIZE = useCellSize(compact);

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
      if (disabled) return;
      const key = `${cell.coord.col}${cell.coord.row}`;
      const hasShip = shipCellSet.has(key);
      if (hasShip && onShipCellClick) {
        onShipCellClick(cell.coord);
        return;
      }
      if (!onCellClick) return;
      if (cell.status !== CellStatus.Unshot) return;
      onCellClick(cell.coord);
    },
    [disabled, onCellClick, onShipCellClick, shipCellSet],
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
              const isClickable = !disabled && (
                (!!onCellClick && cell.status === CellStatus.Unshot && !hasShip) ||
                (!!onShipCellClick && hasShip && cell.status === CellStatus.Unshot)
              );
              const isLastShot = lastShotCoord === key;
              const ghost = ghostCells?.get(key);

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
                  onMouseEnter={onCellHover ? () => onCellHover(cell.coord) : undefined}
                  onMouseLeave={onCellHover ? () => onCellHover(null) : undefined}
                  onTouchStart={onCellHover ? () => onCellHover(cell.coord) : undefined}
                  style={{
                    width: CELL_SIZE,
                    height: CELL_SIZE,
                    backgroundColor: ghost === 'valid' ? 'rgba(59,130,246,0.45)'
                                   : ghost === 'invalid' ? 'rgba(220,38,38,0.45)'
                                   : bg,
                    color: fg,
                    border: isLastShot ? '2px solid #facc15'
                          : ghost === 'valid' ? '1px dashed #3b82f6'
                          : ghost === 'invalid' ? '1px dashed #dc2626'
                          : '1px solid #cbd5e1',
                    boxSizing: 'border-box',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    cursor: isClickable
                      ? (hasShip && !!onShipCellClick ? 'not-allowed' : 'pointer')
                      : 'default',
                    transition: 'background-color 0.1s',
                  }}
                >
                  {!ghost && cell.status === CellStatus.Hit  && '🔥'}
                  {!ghost && cell.status === CellStatus.Sunk && '💥'}
                  {!ghost && cell.status === CellStatus.Miss && '·'}
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
