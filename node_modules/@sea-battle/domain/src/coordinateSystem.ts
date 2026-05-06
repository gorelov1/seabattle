/**
 * CoordinateSystem module — serialization, parsing, and validation of board coordinates.
 * Requirements: 1.2, 1.3, 1.4, 1.5, 11.1, 11.2, 11.3
 */

import { Column, type Coordinate, type ParseError, type Result, type Row } from "./types.js";

/** All valid row numbers as a set for O(1) lookup. */
const VALID_ROWS = new Set<number>([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

/** All valid column values as a set for O(1) lookup. */
const VALID_COLUMNS = new Set<string>(Object.values(Column));

/**
 * Converts a Coordinate to its canonical string representation.
 * e.g. { col: Column.G, row: 7 } → "G7"
 *
 * Requirements: 11.1, 11.2
 */
export function serialize(coord: Coordinate): string {
  return `${coord.col}${coord.row}`;
}

/**
 * Parses a coordinate string into a typed Coordinate, or returns a ParseError.
 * Accepts strings matching [A-J](10|[1-9]) — uppercase column letter followed by row number.
 * e.g. "G7" → { ok: true, value: { col: Column.G, row: 7 } }
 * e.g. "g7" → { ok: false, error: { message: "..." } }
 *
 * Requirements: 1.5, 11.3
 */
export function parse(s: string): Result<Coordinate, ParseError> {
  if (s.length === 0) {
    return { ok: false, error: { message: "Coordinate string must not be empty" } };
  }

  // Must match: one uppercase letter A-J, followed by 1 or 2 digits (1-10)
  const match = /^([A-J])(10|[1-9])$/.exec(s);
  if (match === null) {
    return {
      ok: false,
      error: {
        message: `Invalid coordinate string "${s}". Expected format: column letter A–J followed by row number 1–10 (e.g. "A1", "J10", "G7").`,
      },
    };
  }

  const colStr = match[1] as Column;
  const rowNum = parseInt(match[2], 10) as Row;

  return {
    ok: true,
    value: { col: colStr, row: rowNum },
  };
}

/**
 * Returns true if the given column and row form a valid board coordinate.
 * Valid: column A–J (Column enum), row 1–10.
 *
 * Requirements: 1.2, 1.3, 1.4
 */
export function isValid(col: Column, row: Row): boolean {
  return VALID_COLUMNS.has(col) && VALID_ROWS.has(row);
}
