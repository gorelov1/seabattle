import { describe, it, expect } from "vitest";
import {
  Column,
  CellStatus,
  ShipType,
  TurnPhase,
  ShotOutcome,
  PlacementError,
  ShotError,
  Orientation,
  FLEET_SPEC,
  shipSize,
} from "./types.js";

describe("Column enum", () => {
  it("contains exactly 10 columns A through J", () => {
    const cols = Object.values(Column);
    expect(cols).toHaveLength(10);
    expect(cols).toEqual(["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]);
  });
});

describe("CellStatus enum", () => {
  it("has all four statuses", () => {
    expect(CellStatus.Unshot).toBe("Unshot");
    expect(CellStatus.Miss).toBe("Miss");
    expect(CellStatus.Hit).toBe("Hit");
    expect(CellStatus.Sunk).toBe("Sunk");
  });
});

describe("ShipType enum and shipSize", () => {
  it("Battleship has size 4", () => {
    expect(shipSize(ShipType.Battleship)).toBe(4);
  });

  it("Cruiser has size 3", () => {
    expect(shipSize(ShipType.Cruiser)).toBe(3);
  });

  it("Destroyer has size 2", () => {
    expect(shipSize(ShipType.Destroyer)).toBe(2);
  });

  it("PatrolBoat has size 1", () => {
    expect(shipSize(ShipType.PatrolBoat)).toBe(1);
  });
});

describe("FLEET_SPEC", () => {
  it("specifies the correct fleet composition (Requirement 2.1, 2.2)", () => {
    expect(FLEET_SPEC.battleships).toBe(1);
    expect(FLEET_SPEC.cruisers).toBe(2);
    expect(FLEET_SPEC.destroyers).toBe(3);
    expect(FLEET_SPEC.patrolBoats).toBe(4);
  });

  it("totals 10 ships", () => {
    const total =
      FLEET_SPEC.battleships +
      FLEET_SPEC.cruisers +
      FLEET_SPEC.destroyers +
      FLEET_SPEC.patrolBoats;
    expect(total).toBe(10);
  });

  it("totals 20 segments", () => {
    const segments =
      FLEET_SPEC.battleships * shipSize(ShipType.Battleship) +
      FLEET_SPEC.cruisers * shipSize(ShipType.Cruiser) +
      FLEET_SPEC.destroyers * shipSize(ShipType.Destroyer) +
      FLEET_SPEC.patrolBoats * shipSize(ShipType.PatrolBoat);
    expect(segments).toBe(20);
  });
});

describe("TurnPhase enum", () => {
  it("has Placement, Shooting, and Finished phases", () => {
    expect(TurnPhase.Placement).toBe("Placement");
    expect(TurnPhase.Shooting).toBe("Shooting");
    expect(TurnPhase.Finished).toBe("Finished");
  });
});

describe("ShotOutcome enum", () => {
  it("has Miss, Hit, and Sunk outcomes", () => {
    expect(ShotOutcome.Miss).toBe("Miss");
    expect(ShotOutcome.Hit).toBe("Hit");
    expect(ShotOutcome.Sunk).toBe("Sunk");
  });
});

describe("PlacementError enum", () => {
  it("has all expected error variants", () => {
    expect(PlacementError.OutOfBounds).toBe("OutOfBounds");
    expect(PlacementError.AdjacencyViolation).toBe("AdjacencyViolation");
    expect(PlacementError.QuotaExceeded).toBe("QuotaExceeded");
    expect(PlacementError.Overlap).toBe("Overlap");
    expect(PlacementError.InvalidOrientation).toBe("InvalidOrientation");
  });
});

describe("ShotError enum", () => {
  it("has AlreadyShot and NotYourTurn variants", () => {
    expect(ShotError.AlreadyShot).toBe("AlreadyShot");
    expect(ShotError.NotYourTurn).toBe("NotYourTurn");
  });
});

describe("Orientation enum", () => {
  it("has Horizontal and Vertical", () => {
    expect(Orientation.Horizontal).toBe("Horizontal");
    expect(Orientation.Vertical).toBe("Vertical");
  });
});

describe("Result type", () => {
  it("can represent success", () => {
    const ok = { ok: true as const, value: 42 };
    expect(ok.ok).toBe(true);
    expect(ok.value).toBe(42);
  });

  it("can represent failure", () => {
    const err = { ok: false as const, error: "something went wrong" };
    expect(err.ok).toBe(false);
    expect(err.error).toBe("something went wrong");
  });
});

describe("Option type", () => {
  it("can represent Some", () => {
    const some = { some: true as const, value: "hello" };
    expect(some.some).toBe(true);
    expect(some.value).toBe("hello");
  });

  it("can represent None", () => {
    const none = { some: false as const };
    expect(none.some).toBe(false);
  });
});
