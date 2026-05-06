/**
 * Core TypeScript types and enums for the Sea Battle game domain.
 * Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 10.1, 10.2
 */
// ---------------------------------------------------------------------------
// Coordinate system (Requirement 1.2, 1.3, 1.4)
// ---------------------------------------------------------------------------
/** Column labels A through J (left to right). */
export var Column;
(function (Column) {
    Column["A"] = "A";
    Column["B"] = "B";
    Column["C"] = "C";
    Column["D"] = "D";
    Column["E"] = "E";
    Column["F"] = "F";
    Column["G"] = "G";
    Column["H"] = "H";
    Column["I"] = "I";
    Column["J"] = "J";
})(Column || (Column = {}));
// ---------------------------------------------------------------------------
// Cell status (Requirement 10.1)
// ---------------------------------------------------------------------------
/** The shot status of a single cell on the board. */
export var CellStatus;
(function (CellStatus) {
    CellStatus["Unshot"] = "Unshot";
    CellStatus["Miss"] = "Miss";
    CellStatus["Hit"] = "Hit";
    CellStatus["Sunk"] = "Sunk";
})(CellStatus || (CellStatus = {}));
// ---------------------------------------------------------------------------
// Ship types and sizes (Requirement 2.1, 2.2)
// ---------------------------------------------------------------------------
/** The type of a ship, which determines its size. */
export var ShipType;
(function (ShipType) {
    ShipType["Battleship"] = "Battleship";
    ShipType["Cruiser"] = "Cruiser";
    ShipType["Destroyer"] = "Destroyer";
    ShipType["PatrolBoat"] = "PatrolBoat";
})(ShipType || (ShipType = {}));
/** Returns the number of segments (cells) for a given ship type. */
export function shipSize(type) {
    switch (type) {
        case ShipType.Battleship:
            return 4;
        case ShipType.Cruiser:
            return 3;
        case ShipType.Destroyer:
            return 2;
        case ShipType.PatrolBoat:
            return 1;
    }
}
/** The canonical fleet specification used throughout the game. */
export const FLEET_SPEC = {
    battleships: 1,
    cruisers: 2,
    destroyers: 3,
    patrolBoats: 4,
};
// ---------------------------------------------------------------------------
// Turn management
// ---------------------------------------------------------------------------
/** The current phase of the game. */
export var TurnPhase;
(function (TurnPhase) {
    TurnPhase["Placement"] = "Placement";
    TurnPhase["Shooting"] = "Shooting";
    TurnPhase["Finished"] = "Finished";
})(TurnPhase || (TurnPhase = {}));
// ---------------------------------------------------------------------------
// Shot outcomes and results
// ---------------------------------------------------------------------------
/** The outcome of a single shot. */
export var ShotOutcome;
(function (ShotOutcome) {
    ShotOutcome["Miss"] = "Miss";
    ShotOutcome["Hit"] = "Hit";
    ShotOutcome["Sunk"] = "Sunk";
})(ShotOutcome || (ShotOutcome = {}));
// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------
/** Errors that can occur during ship placement. */
export var PlacementError;
(function (PlacementError) {
    PlacementError["OutOfBounds"] = "OutOfBounds";
    PlacementError["AdjacencyViolation"] = "AdjacencyViolation";
    PlacementError["QuotaExceeded"] = "QuotaExceeded";
    PlacementError["Overlap"] = "Overlap";
    PlacementError["InvalidOrientation"] = "InvalidOrientation";
})(PlacementError || (PlacementError = {}));
/** Errors that can occur when processing a shot. */
export var ShotError;
(function (ShotError) {
    ShotError["AlreadyShot"] = "AlreadyShot";
    ShotError["NotYourTurn"] = "NotYourTurn";
})(ShotError || (ShotError = {}));
// ---------------------------------------------------------------------------
// Ship placement input (used by PlacementEngine)
// ---------------------------------------------------------------------------
/** Orientation of a ship placement. */
export var Orientation;
(function (Orientation) {
    Orientation["Horizontal"] = "Horizontal";
    Orientation["Vertical"] = "Vertical";
})(Orientation || (Orientation = {}));
//# sourceMappingURL=types.js.map