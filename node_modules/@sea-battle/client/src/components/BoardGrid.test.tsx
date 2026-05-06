/**
 * Unit tests for the BoardGrid component.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 6.4, 8.4, 9.4
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import { BoardGrid } from './BoardGrid';
import { Column, CellStatus } from '@sea-battle/domain';
import type { Cell, Coordinate } from '@sea-battle/domain';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const COLUMNS = [
  Column.A, Column.B, Column.C, Column.D, Column.E,
  Column.F, Column.G, Column.H, Column.I, Column.J,
] as const;

const ROWS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

/** Builds a full 100-cell array with all cells set to the given status. */
function buildCells(status: CellStatus = CellStatus.Unshot): Cell[] {
  const cells: Cell[] = [];
  for (const col of COLUMNS) {
    for (const row of ROWS) {
      cells.push({ coord: { col, row }, status });
    }
  }
  return cells;
}

/** Returns a single cell with the given coord and status. */
function makeCell(col: Column, row: (typeof ROWS)[number], status: CellStatus): Cell {
  return { coord: { col, row }, status };
}

/** Replaces the cell at the given coord in a cells array. */
function withCell(cells: Cell[], col: Column, row: (typeof ROWS)[number], status: CellStatus): Cell[] {
  return cells.map((c) =>
    c.coord.col === col && c.coord.row === row ? makeCell(col, row, status) : c,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BoardGrid', () => {
  describe('renders 100 cells', () => {
    it('renders exactly 100 cell buttons', () => {
      const cells = buildCells();
      render(<BoardGrid cells={cells} />);

      // Each cell has role="button" and aria-label="cell-{col}{row}"
      const cellButtons = screen.getAllByRole('button');
      expect(cellButtons).toHaveLength(100);
    });
  });

  describe('renders column labels A–J', () => {
    it('renders all 10 column labels', () => {
      const cells = buildCells();
      render(<BoardGrid cells={cells} />);

      for (const col of COLUMNS) {
        // Column labels are rendered with aria-label="column-{col}"
        expect(screen.getByLabelText(`column-${col}`)).toBeInTheDocument();
      }
    });
  });

  describe('renders row labels 1–10', () => {
    it('renders all 10 row labels', () => {
      const cells = buildCells();
      render(<BoardGrid cells={cells} />);

      for (const row of ROWS) {
        expect(screen.getByLabelText(`row-${row}`)).toBeInTheDocument();
      }
    });
  });

  describe('onCellClick', () => {
    it('calls onCellClick when an Unshot cell is clicked', () => {
      const cells = buildCells(CellStatus.Unshot);
      const onCellClick = vi.fn();

      render(<BoardGrid cells={cells} onCellClick={onCellClick} />);

      const cellA1 = screen.getByLabelText('cell-A1');
      fireEvent.click(cellA1);

      expect(onCellClick).toHaveBeenCalledTimes(1);
      const calledWith: Coordinate = onCellClick.mock.calls[0][0];
      expect(calledWith.col).toBe(Column.A);
      expect(calledWith.row).toBe(1);
    });

    it('does NOT call onCellClick when a Miss cell is clicked', () => {
      const cells = withCell(buildCells(), Column.B, 3, CellStatus.Miss);
      const onCellClick = vi.fn();

      render(<BoardGrid cells={cells} onCellClick={onCellClick} />);

      const cellB3 = screen.getByLabelText('cell-B3');
      fireEvent.click(cellB3);

      expect(onCellClick).not.toHaveBeenCalled();
    });

    it('does NOT call onCellClick when a Hit cell is clicked', () => {
      const cells = withCell(buildCells(), Column.C, 5, CellStatus.Hit);
      const onCellClick = vi.fn();

      render(<BoardGrid cells={cells} onCellClick={onCellClick} />);

      const cellC5 = screen.getByLabelText('cell-C5');
      fireEvent.click(cellC5);

      expect(onCellClick).not.toHaveBeenCalled();
    });

    it('does NOT call onCellClick when a Sunk cell is clicked', () => {
      const cells = withCell(buildCells(), Column.D, 7, CellStatus.Sunk);
      const onCellClick = vi.fn();

      render(<BoardGrid cells={cells} onCellClick={onCellClick} />);

      const cellD7 = screen.getByLabelText('cell-D7');
      fireEvent.click(cellD7);

      expect(onCellClick).not.toHaveBeenCalled();
    });

    it('does NOT call onCellClick when disabled=true', () => {
      const cells = buildCells(CellStatus.Unshot);
      const onCellClick = vi.fn();

      render(<BoardGrid cells={cells} onCellClick={onCellClick} disabled={true} />);

      const cellA1 = screen.getByLabelText('cell-A1');
      fireEvent.click(cellA1);

      expect(onCellClick).not.toHaveBeenCalled();
    });

    it('does NOT call onCellClick when no handler is provided', () => {
      const cells = buildCells(CellStatus.Unshot);
      // No onCellClick prop — should not throw
      expect(() => {
        render(<BoardGrid cells={cells} />);
        const cellA1 = screen.getByLabelText('cell-A1');
        fireEvent.click(cellA1);
      }).not.toThrow();
    });
  });

  describe('label prop', () => {
    it('renders the label when provided', () => {
      const cells = buildCells();
      render(<BoardGrid cells={cells} label="Your Board" />);
      expect(screen.getByText('Your Board')).toBeInTheDocument();
    });

    it('does not render a label element when label is not provided', () => {
      const cells = buildCells();
      render(<BoardGrid cells={cells} />);
      expect(screen.queryByText('Your Board')).not.toBeInTheDocument();
    });
  });
});
