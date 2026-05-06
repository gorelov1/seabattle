import { chooseShot } from './dist/aiOpponent.js';
import { CellStatus, Column } from './dist/types.js';
import { createEmptyBoard } from './dist/placementEngine.js';
import { serialize } from './dist/coordinateSystem.js';

// Simulate: J3=Hit, J4=Hit, J5=Hit — AI should pick J2 or J6 only

let board = createEmptyBoard('player');

const setStatus = (b, col, row, status) => {
  const newCells = new Map(b.cells);
  const key = col + row;
  const cell = newCells.get(key);
  if (!cell) { console.error('cell not found:', key); return b; }
  newCells.set(key, { ...cell, status });
  return { ...b, cells: newCells };
};

board = setStatus(board, 'J', 3, CellStatus.Hit);
board = setStatus(board, 'J', 4, CellStatus.Hit);
board = setStatus(board, 'J', 5, CellStatus.Hit);

const hitCells = [...board.cells.values()].filter(c => c.status === CellStatus.Hit).map(c => c.coord);
console.log('Hit cells:', hitCells.map(c => c.col + c.row));
console.log('allSameCol:', hitCells.every(c => c.col === hitCells[0].col));
console.log('allSameRow:', hitCells.every(c => c.row === hitCells[0].row));

const results = new Set();
for (let i = 0; i < 30; i++) {
  const coord = chooseShot(board);
  results.add(coord.col + coord.row);
}
console.log('AI choices:', [...results]);
console.log('PASS (only J2 or J6):', [...results].every(r => r === 'J2' || r === 'J6'));
