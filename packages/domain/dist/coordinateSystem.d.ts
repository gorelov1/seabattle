/**
 * CoordinateSystem module — serialization, parsing, and validation of board coordinates.
 * Requirements: 1.2, 1.3, 1.4, 1.5, 11.1, 11.2, 11.3
 */
import { Column, type Coordinate, type ParseError, type Result, type Row } from "./types.js";
/**
 * Converts a Coordinate to its canonical string representation.
 * e.g. { col: Column.G, row: 7 } → "G7"
 *
 * Requirements: 11.1, 11.2
 */
export declare function serialize(coord: Coordinate): string;
/**
 * Parses a coordinate string into a typed Coordinate, or returns a ParseError.
 * Accepts strings matching [A-J](10|[1-9]) — uppercase column letter followed by row number.
 * e.g. "G7" → { ok: true, value: { col: Column.G, row: 7 } }
 * e.g. "g7" → { ok: false, error: { message: "..." } }
 *
 * Requirements: 1.5, 11.3
 */
export declare function parse(s: string): Result<Coordinate, ParseError>;
/**
 * Returns true if the given column and row form a valid board coordinate.
 * Valid: column A–J (Column enum), row 1–10.
 *
 * Requirements: 1.2, 1.3, 1.4
 */
export declare function isValid(col: Column, row: Row): boolean;
//# sourceMappingURL=coordinateSystem.d.ts.map