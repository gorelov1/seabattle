/**
 * Unit tests for SessionService.
 *
 * Uses a simple in-memory store (Map-based) for dependency injection so that
 * tests run without any native binaries (better-sqlite3 requires a compiled
 * native module that may not be available in all environments).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { SessionService } from "./sessionService.js";
// ---------------------------------------------------------------------------
// In-memory store implementation
// ---------------------------------------------------------------------------
function createInMemorySessionQueries() {
    const store = new Map();
    return {
        _store: store,
        insert(row) {
            store.set(row.id, { ...row });
        },
        findById(id) {
            const row = store.get(id);
            return row ? { ...row } : undefined;
        },
        findByInviteCode(code) {
            for (const row of store.values()) {
                if (row.invite_code === code)
                    return { ...row };
            }
            return undefined;
        },
        update(row) {
            if (store.has(row.id)) {
                store.set(row.id, { ...row });
            }
        },
        delete(id) {
            store.delete(id);
        },
    };
}
// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("SessionService.createSession", () => {
    let service;
    let store;
    beforeEach(() => {
        store = createInMemorySessionQueries();
        service = new SessionService(store);
    });
    it("generates a unique sessionId (UUID format)", () => {
        const session = service.createSession("player-1");
        expect(typeof session.id).toBe("string");
        // UUID v4 pattern
        expect(session.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });
    it("generates a 6-character alphanumeric inviteCode", () => {
        const session = service.createSession("player-1");
        expect(typeof session.inviteCode).toBe("string");
        expect(session.inviteCode).toMatch(/^[A-Z0-9]{6}$/);
    });
    it("generates unique sessionIds for different sessions", () => {
        const s1 = service.createSession("player-1");
        const s2 = service.createSession("player-2");
        expect(s1.id).not.toBe(s2.id);
    });
    it("generates unique inviteCodes for different sessions (with high probability)", () => {
        const codes = new Set();
        for (let i = 0; i < 10; i++) {
            const s = service.createSession(`player-${i}`);
            codes.add(s.inviteCode);
        }
        // With 36^6 ≈ 2.1 billion possibilities, 10 codes should all be unique
        expect(codes.size).toBe(10);
    });
    it("sets playerA to the provided playerId", () => {
        const session = service.createSession("alice");
        expect(session.playerA).toBe("alice");
    });
    it("sets playerB to null initially", () => {
        const session = service.createSession("alice");
        expect(session.playerB).toBeNull();
    });
    it("sets status to WaitingForPlayers", () => {
        const session = service.createSession("alice");
        expect(session.status).toBe("WaitingForPlayers");
    });
    it("persists the session to the store", () => {
        const session = service.createSession("alice");
        const row = store.findById(session.id);
        expect(row).toBeDefined();
        expect(row.player_a).toBe("alice");
    });
    it("initializes disconnected as empty object", () => {
        const session = service.createSession("alice");
        expect(session.disconnected).toEqual({});
    });
    it("sets a createdAt ISO timestamp", () => {
        const before = new Date().toISOString();
        const session = service.createSession("alice");
        const after = new Date().toISOString();
        expect(session.createdAt >= before).toBe(true);
        expect(session.createdAt <= after).toBe(true);
    });
});
describe("SessionService.joinSession", () => {
    let service;
    let store;
    beforeEach(() => {
        store = createInMemorySessionQueries();
        service = new SessionService(store);
    });
    it("succeeds with a valid invite code and returns updated session", () => {
        const created = service.createSession("alice");
        const result = service.joinSession(created.inviteCode, "bob");
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        expect(result.value.id).toBe(created.id);
        expect(result.value.playerB).toBe("bob");
        expect(result.value.status).toBe("Placement");
    });
    it("rejects with InvalidInviteCode when code does not exist", () => {
        const result = service.joinSession("XXXXXX", "bob");
        expect(result.ok).toBe(false);
        if (result.ok)
            return;
        expect(result.error).toBe("InvalidInviteCode");
    });
    it("rejects with SessionFull when playerB is already set", () => {
        const created = service.createSession("alice");
        service.joinSession(created.inviteCode, "bob");
        // Try to join again
        const result = service.joinSession(created.inviteCode, "charlie");
        expect(result.ok).toBe(false);
        if (result.ok)
            return;
        expect(result.error).toBe("SessionFull");
    });
    it("transitions status to Placement on successful join", () => {
        const created = service.createSession("alice");
        const result = service.joinSession(created.inviteCode, "bob");
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        expect(result.value.status).toBe("Placement");
    });
    it("persists the updated session to the store", () => {
        const created = service.createSession("alice");
        service.joinSession(created.inviteCode, "bob");
        const row = store.findById(created.id);
        expect(row).toBeDefined();
        expect(row.player_b).toBe("bob");
        expect(row.status).toBe("Placement");
    });
});
describe("SessionService.getSession", () => {
    let service;
    beforeEach(() => {
        const store = createInMemorySessionQueries();
        service = new SessionService(store);
    });
    it("returns the correct session by sessionId", () => {
        const created = service.createSession("alice");
        const found = service.getSession(created.id);
        expect(found).toBeDefined();
        expect(found.id).toBe(created.id);
        expect(found.playerA).toBe("alice");
    });
    it("returns undefined for an unknown sessionId", () => {
        const found = service.getSession("non-existent-id");
        expect(found).toBeUndefined();
    });
    it("reflects updates after joinSession", () => {
        const created = service.createSession("alice");
        service.joinSession(created.inviteCode, "bob");
        const found = service.getSession(created.id);
        expect(found).toBeDefined();
        expect(found.playerB).toBe("bob");
        expect(found.status).toBe("Placement");
    });
});
describe("SessionService.updateSession", () => {
    let service;
    beforeEach(() => {
        const store = createInMemorySessionQueries();
        service = new SessionService(store);
    });
    it("persists changes made to a session", () => {
        const created = service.createSession("alice");
        const updated = { ...created, status: "Shooting" };
        service.updateSession(updated);
        const found = service.getSession(created.id);
        expect(found).toBeDefined();
        expect(found.status).toBe("Shooting");
    });
});
//# sourceMappingURL=sessionService.test.js.map