/**
 * Unit tests for the CoordinateSystem module.
 * Requirements: 1.2, 1.3, 1.4, 1.5, 11.1, 11.2, 11.3
 */
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { Column } from "./types.js";
import { serialize, parse, isValid } from "./coordinateSystem.js";
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const ALL_COLUMNS = Object.values(Column);
const ALL_ROWS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
// ---------------------------------------------------------------------------
// serialize
// ---------------------------------------------------------------------------
describe("serialize", () => {
    it("serializes a mid-board coordinate correctly", () => {
        expect(serialize({ col: Column.G, row: 7 })).toBe("G7");
    });
    it("serializes the top-left corner A1", () => {
        expect(serialize({ col: Column.A, row: 1 })).toBe("A1");
    });
    it("serializes the bottom-right corner J10", () => {
        expect(serialize({ col: Column.J, row: 10 })).toBe("J10");
    });
    it("serializes all 100 valid coordinates to the expected format", () => {
        for (const col of ALL_COLUMNS) {
            for (const row of ALL_ROWS) {
                const result = serialize({ col, row });
                expect(result).toBe(`${col}${row}`);
                // Must start with the column letter
                expect(result[0]).toBe(col);
                // Remainder must be the row number
                expect(parseInt(result.slice(1), 10)).toBe(row);
            }
        }
    });
    it("produces strings of length 2 for rows 1–9 and length 3 for row 10", () => {
        for (const col of ALL_COLUMNS) {
            for (const row of ALL_ROWS) {
                const s = serialize({ col, row });
                if (row === 10) {
                    expect(s).toHaveLength(3);
                }
                else {
                    expect(s).toHaveLength(2);
                }
            }
        }
    });
});
// ---------------------------------------------------------------------------
// parse — valid inputs
// ---------------------------------------------------------------------------
describe("parse — valid inputs", () => {
    it("parses 'G7' correctly", () => {
        const result = parse("G7");
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.col).toBe(Column.G);
            expect(result.value.row).toBe(7);
        }
    });
    it("parses 'A1' correctly", () => {
        const result = parse("A1");
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.col).toBe(Column.A);
            expect(result.value.row).toBe(1);
        }
    });
    it("parses 'J10' correctly", () => {
        const result = parse("J10");
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.col).toBe(Column.J);
            expect(result.value.row).toBe(10);
        }
    });
    it("accepts all 100 canonical coordinate strings", () => {
        for (const col of ALL_COLUMNS) {
            for (const row of ALL_ROWS) {
                const s = `${col}${row}`;
                const result = parse(s);
                expect(result.ok, `Expected parse("${s}") to succeed`).toBe(true);
                if (result.ok) {
                    expect(result.value.col).toBe(col);
                    expect(result.value.row).toBe(row);
                }
            }
        }
    });
});
// ---------------------------------------------------------------------------
// parse — invalid inputs
// ---------------------------------------------------------------------------
describe("parse — invalid inputs", () => {
    it("rejects an empty string", () => {
        const result = parse("");
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toBeTruthy();
        }
    });
    it("rejects lowercase column letters (e.g. 'a1')", () => {
        expect(parse("a1").ok).toBe(false);
        expect(parse("g7").ok).toBe(false);
        expect(parse("j10").ok).toBe(false);
    });
    it("rejects row 0 (e.g. 'A0')", () => {
        expect(parse("A0").ok).toBe(false);
    });
    it("rejects row 11 (e.g. 'A11')", () => {
        expect(parse("A11").ok).toBe(false);
    });
    it("rejects row 00 (e.g. 'A00')", () => {
        expect(parse("A00").ok).toBe(false);
    });
    it("rejects invalid column letters outside A–J (e.g. 'K1', 'Z5')", () => {
        expect(parse("K1").ok).toBe(false);
        expect(parse("Z5").ok).toBe(false);
        expect(parse("L10").ok).toBe(false);
    });
    it("rejects strings with no column letter (e.g. '7', '10')", () => {
        expect(parse("7").ok).toBe(false);
        expect(parse("10").ok).toBe(false);
    });
    it("rejects strings with no row number (e.g. 'A', 'G')", () => {
        expect(parse("A").ok).toBe(false);
        expect(parse("G").ok).toBe(false);
    });
    it("rejects strings with extra characters (e.g. 'A1X', ' A1', 'A1 ')", () => {
        expect(parse("A1X").ok).toBe(false);
        expect(parse(" A1").ok).toBe(false);
        expect(parse("A1 ").ok).toBe(false);
    });
    it("rejects strings with two column letters (e.g. 'AB1')", () => {
        expect(parse("AB1").ok).toBe(false);
    });
    it("rejects numeric-only strings (e.g. '11', '99')", () => {
        expect(parse("11").ok).toBe(false);
        expect(parse("99").ok).toBe(false);
    });
    it("rejects special characters (e.g. '@1', 'A#')", () => {
        expect(parse("@1").ok).toBe(false);
        expect(parse("A#").ok).toBe(false);
    });
    it("returns a ParseError with a non-empty message on failure", () => {
        const result = parse("invalid");
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(typeof result.error.message).toBe("string");
            expect(result.error.message.length).toBeGreaterThan(0);
        }
    });
});
// ---------------------------------------------------------------------------
// isValid
// ---------------------------------------------------------------------------
describe("isValid", () => {
    it("returns true for all 100 valid (col, row) pairs", () => {
        for (const col of ALL_COLUMNS) {
            for (const row of ALL_ROWS) {
                expect(isValid(col, row), `Expected isValid(${col}, ${row}) to be true`).toBe(true);
            }
        }
    });
    it("returns true for corner coordinates", () => {
        expect(isValid(Column.A, 1)).toBe(true);
        expect(isValid(Column.J, 10)).toBe(true);
        expect(isValid(Column.A, 10)).toBe(true);
        expect(isValid(Column.J, 1)).toBe(true);
    });
    it("returns false for an invalid column cast as Column", () => {
        // Cast an invalid string to Column to simulate a runtime bad value
        expect(isValid("K", 1)).toBe(false);
        expect(isValid("Z", 5)).toBe(false);
        expect(isValid("", 1)).toBe(false);
    });
    it("returns false for an invalid row cast as Row", () => {
        expect(isValid(Column.A, 0)).toBe(false);
        expect(isValid(Column.A, 11)).toBe(false);
        expect(isValid(Column.A, -1)).toBe(false);
    });
});
// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------
// Feature: sea-battle-game, Property 1: Coordinate round-trip
describe("Property 1: Coordinate round-trip", () => {
    it("parse(serialize(c)) equals c for all valid coordinates — Validates: Requirements 11.1, 11.2, 11.4", () => {
        const colArb = fc.constantFrom(...Object.values(Column));
        const rowArb = fc.constantFrom(1, 2, 3, 4, 5, 6, 7, 8, 9, 10);
        const coordArb = fc.record({ col: colArb, row: rowArb });
        fc.assert(fc.property(coordArb, (coord) => {
            const result = parse(serialize(coord));
            if (!result.ok)
                return false;
            return result.value.col === coord.col && result.value.row === coord.row;
        }), { numRuns: 100 });
    });
});
// Feature: sea-battle-game, Property 2: Invalid coordinate strings are rejected
describe("Property 2: Invalid coordinate strings are rejected", () => {
    it("parse(s) returns an error for any string not matching [A-J](10|[1-9]) — Validates: Requirements 1.5, 11.3", () => {
        // The valid coordinate pattern: one of A-J followed by 1-9 or 10
        const validPattern = /^[A-J](10|[1-9])$/;
        // Build an arbitrary that generates strings guaranteed NOT to match the valid pattern.
        // We use fc.oneof to cover a wide variety of invalid shapes:
        //   1. Empty string
        //   2. Lowercase column letters (a-j) + valid row
        //   3. Out-of-range column letters (K-Z) + valid row
        //   4. Valid column + row 0
        //   5. Valid column + row 11-99
        //   6. Valid column + row 00 (leading zero)
        //   7. Strings with extra leading/trailing characters
        //   8. Arbitrary strings filtered to exclude valid coordinates
        const validRows = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
        const validCols = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
        const lowercaseColArb = fc.oneof(...["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"].map((c) => fc.constantFrom(...validRows).map((r) => `${c}${r}`)));
        const outOfRangeColArb = fc.oneof(...["K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"].map((c) => fc.constantFrom(...validRows).map((r) => `${c}${r}`)));
        const row0Arb = fc.constantFrom(...validCols).map((c) => `${c}0`);
        const outOfRangeRowArb = fc.constantFrom(...validCols).chain((c) => fc.integer({ min: 11, max: 99 }).map((r) => `${c}${r}`));
        const leadingZeroRowArb = fc.constantFrom(...validCols).map((c) => `${c}00`);
        const extraLeadingCharArb = fc.constantFrom(...validCols).chain((c) => fc.constantFrom(...validRows).chain((r) => fc.string({ minLength: 1, maxLength: 3 }).map((prefix) => `${prefix}${c}${r}`)));
        const extraTrailingCharArb = fc.constantFrom(...validCols).chain((c) => fc.constantFrom(...validRows).chain((r) => fc.string({ minLength: 1, maxLength: 3 }).map((suffix) => `${c}${r}${suffix}`)));
        const arbitraryStringArb = fc.string({ minLength: 0, maxLength: 10 }).filter((s) => !validPattern.test(s));
        const invalidStringArb = fc.oneof({ arbitrary: lowercaseColArb, weight: 2 }, { arbitrary: outOfRangeColArb, weight: 2 }, { arbitrary: row0Arb, weight: 1 }, { arbitrary: outOfRangeRowArb, weight: 2 }, { arbitrary: leadingZeroRowArb, weight: 1 }, { arbitrary: extraLeadingCharArb, weight: 2 }, { arbitrary: extraTrailingCharArb, weight: 2 }, { arbitrary: arbitraryStringArb, weight: 3 });
        fc.assert(fc.property(invalidStringArb, (s) => {
            // Confirm the string is indeed invalid (guard against generator bugs)
            if (validPattern.test(s))
                return true; // skip accidental valid strings
            const result = parse(s);
            // Must return an error
            if (result.ok)
                return false;
            // Error message must be non-empty
            return typeof result.error.message === "string" && result.error.message.length > 0;
        }), { numRuns: 100 });
    });
});
//# sourceMappingURL=coordinateSystem.test.js.map