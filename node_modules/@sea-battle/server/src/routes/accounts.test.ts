/**
 * Unit tests for the accounts REST API router.
 *
 * Uses supertest to exercise the HTTP layer and an in-memory AccountManager
 * (same pattern as accountManager.test.ts) so no real database is required.
 */

import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";

import {
  AccountManager,
  ICON_LIBRARY,
  type AccountQueries,
  type AuthTokenQueries,
  type AccountRow,
  type AuthTokenRow,
} from "../accountManager.js";
import { createAccountsRouter } from "./accounts.js";

// ---------------------------------------------------------------------------
// In-memory store helpers (copied from accountManager.test.ts pattern)
// ---------------------------------------------------------------------------

function createInMemoryAccountQueries(): AccountQueries {
  const store = new Map<string, AccountRow>();
  return {
    insert(row: AccountRow) {
      store.set(row.id, row);
    },
    findByEmail(email: string): AccountRow | undefined {
      for (const row of store.values()) {
        if (row.email === email) return row;
      }
      return undefined;
    },
    findById(id: string): AccountRow | undefined {
      return store.get(id);
    },
    update(row: Omit<AccountRow, "created_at">) {
      const existing = store.get(row.id);
      if (existing === undefined) return;
      store.set(row.id, { ...existing, ...row });
    },
    delete(id: string) {
      store.delete(id);
    },
  };
}

function createInMemoryAuthTokenQueries(): AuthTokenQueries {
  const store = new Map<string, AuthTokenRow>();
  return {
    insert(row: AuthTokenRow) {
      store.set(row.token_id, row);
    },
    findById(tokenId: string): AuthTokenRow | undefined {
      return store.get(tokenId);
    },
    findByAccount(accountId: string): AuthTokenRow[] {
      return [...store.values()].filter((r) => r.account_id === accountId);
    },
    delete(tokenId: string) {
      store.delete(tokenId);
    },
    deleteByAccount(accountId: string) {
      for (const [key, row] of store.entries()) {
        if (row.account_id === accountId) store.delete(key);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Test app factory
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = "test-secret";

function createTestApp() {
  const accountManager = new AccountManager(
    createInMemoryAccountQueries(),
    createInMemoryAuthTokenQueries(),
    TEST_JWT_SECRET
  );

  const app = express();
  app.use(express.json());
  app.use("/accounts", createAccountsRouter(accountManager, TEST_JWT_SECRET));

  return { app, accountManager };
}

// ---------------------------------------------------------------------------
// Shared test data
// ---------------------------------------------------------------------------

const validRegistration = {
  email: "alice@example.com",
  displayName: "Alice",
  profileIcon: ICON_LIBRARY[0]!, // "anchor"
  password: "correct-horse-battery-staple",
};

// ---------------------------------------------------------------------------
// POST /accounts/register
// ---------------------------------------------------------------------------

describe("POST /accounts/register", () => {
  let app: express.Application;

  beforeEach(() => {
    ({ app } = createTestApp());
  });

  it("returns 201 with account data on successful registration", async () => {
    const res = await request(app)
      .post("/accounts/register")
      .send(validRegistration);

    expect(res.status).toBe(201);
    expect(res.body.email).toBe(validRegistration.email);
    expect(res.body.displayName).toBe(validRegistration.displayName);
    expect(res.body.profileIcon).toBe(validRegistration.profileIcon);
    expect(typeof res.body.id).toBe("string");
    // Password hash must never be exposed
    expect(res.body.passwordHash).toBeUndefined();
    expect(res.body.password_hash).toBeUndefined();
  });

  it("returns 400 on invalid email format", async () => {
    const res = await request(app)
      .post("/accounts/register")
      .send({ ...validRegistration, email: "not-an-email" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("returns 409 on duplicate email", async () => {
    // First registration succeeds
    await request(app).post("/accounts/register").send(validRegistration);

    // Second registration with same email
    const res = await request(app)
      .post("/accounts/register")
      .send({ ...validRegistration, displayName: "Bob" });

    expect(res.status).toBe(409);
    expect(res.body.error).toBeDefined();
  });

  it("returns 400 on invalid profile icon", async () => {
    const res = await request(app)
      .post("/accounts/register")
      .send({ ...validRegistration, profileIcon: "unicorn" });

    expect(res.status).toBe(400);
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await request(app)
      .post("/accounts/register")
      .send({ email: "alice@example.com" }); // missing other fields

    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /accounts/login
// ---------------------------------------------------------------------------

describe("POST /accounts/login", () => {
  let app: express.Application;

  beforeEach(async () => {
    ({ app } = createTestApp());
    // Pre-register an account
    await request(app).post("/accounts/register").send(validRegistration);
  });

  it("returns 200 with JWT on successful login", async () => {
    const res = await request(app)
      .post("/accounts/login")
      .send({ email: validRegistration.email, password: validRegistration.password });

    expect(res.status).toBe(200);
    expect(typeof res.body.jwt).toBe("string");
    expect(res.body.jwt.length).toBeGreaterThan(0);
    expect(typeof res.body.accountId).toBe("string");
    expect(typeof res.body.tokenId).toBe("string");
  });

  it("JWT payload contains accountId and tokenId", async () => {
    const res = await request(app)
      .post("/accounts/login")
      .send({ email: validRegistration.email, password: validRegistration.password });

    expect(res.status).toBe(200);

    const decoded = jwt.verify(res.body.jwt, TEST_JWT_SECRET) as Record<
      string,
      unknown
    >;
    expect(decoded["accountId"]).toBe(res.body.accountId);
    expect(decoded["tokenId"]).toBe(res.body.tokenId);
  });

  it("returns 401 on wrong password", async () => {
    const res = await request(app)
      .post("/accounts/login")
      .send({ email: validRegistration.email, password: "wrong-password" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it("returns 401 on unknown email", async () => {
    const res = await request(app)
      .post("/accounts/login")
      .send({ email: "nobody@example.com", password: "any-password" });

    expect(res.status).toBe(401);
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await request(app)
      .post("/accounts/login")
      .send({ email: validRegistration.email }); // missing password

    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// PATCH /accounts/me
// ---------------------------------------------------------------------------

describe("PATCH /accounts/me", () => {
  let app: express.Application;
  let jwtToken: string;

  beforeEach(async () => {
    ({ app } = createTestApp());

    // Register and login to get a JWT
    await request(app).post("/accounts/register").send(validRegistration);
    const loginRes = await request(app)
      .post("/accounts/login")
      .send({ email: validRegistration.email, password: validRegistration.password });

    jwtToken = loginRes.body.jwt as string;
  });

  it("returns 200 with updated account on success with valid JWT", async () => {
    const res = await request(app)
      .patch("/accounts/me")
      .set("Authorization", `Bearer ${jwtToken}`)
      .send({ displayName: "Alice Updated" });

    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe("Alice Updated");
    expect(res.body.email).toBe(validRegistration.email);
  });

  it("returns 401 without JWT", async () => {
    const res = await request(app)
      .patch("/accounts/me")
      .send({ displayName: "Alice Updated" });

    expect(res.status).toBe(401);
  });

  it("returns 401 with invalid JWT", async () => {
    const res = await request(app)
      .patch("/accounts/me")
      .set("Authorization", "Bearer invalid.token.here")
      .send({ displayName: "Alice Updated" });

    expect(res.status).toBe(401);
  });

  it("returns 400 on invalid profile icon", async () => {
    const res = await request(app)
      .patch("/accounts/me")
      .set("Authorization", `Bearer ${jwtToken}`)
      .send({ profileIcon: "unicorn" });

    expect(res.status).toBe(400);
  });

  it("returns 401 on wrong current password during password update", async () => {
    const res = await request(app)
      .patch("/accounts/me")
      .set("Authorization", `Bearer ${jwtToken}`)
      .send({ newPassword: { current: "wrong-password", new: "new-password" } });

    expect(res.status).toBe(401);
  });

  it("updates profile icon successfully", async () => {
    const newIcon = ICON_LIBRARY[1]!; // "ship"
    const res = await request(app)
      .patch("/accounts/me")
      .set("Authorization", `Bearer ${jwtToken}`)
      .send({ profileIcon: newIcon });

    expect(res.status).toBe(200);
    expect(res.body.profileIcon).toBe(newIcon);
  });
});

// ---------------------------------------------------------------------------
// DELETE /accounts/me
// ---------------------------------------------------------------------------

describe("DELETE /accounts/me", () => {
  let app: express.Application;
  let jwtToken: string;

  beforeEach(async () => {
    ({ app } = createTestApp());

    // Register and login to get a JWT
    await request(app).post("/accounts/register").send(validRegistration);
    const loginRes = await request(app)
      .post("/accounts/login")
      .send({ email: validRegistration.email, password: validRegistration.password });

    jwtToken = loginRes.body.jwt as string;
  });

  it("returns 200 on successful deletion with confirmation=true", async () => {
    const res = await request(app)
      .delete("/accounts/me")
      .set("Authorization", `Bearer ${jwtToken}`)
      .send({ confirmation: true });

    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();
  });

  it("returns 400 without confirmation (confirmation=false)", async () => {
    const res = await request(app)
      .delete("/accounts/me")
      .set("Authorization", `Bearer ${jwtToken}`)
      .send({ confirmation: false });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("returns 400 without confirmation field", async () => {
    const res = await request(app)
      .delete("/accounts/me")
      .set("Authorization", `Bearer ${jwtToken}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it("returns 401 without JWT", async () => {
    const res = await request(app)
      .delete("/accounts/me")
      .send({ confirmation: true });

    expect(res.status).toBe(401);
  });

  it("account is no longer accessible after deletion", async () => {
    // Delete the account
    await request(app)
      .delete("/accounts/me")
      .set("Authorization", `Bearer ${jwtToken}`)
      .send({ confirmation: true });

    // Attempting to login after deletion should fail
    const loginRes = await request(app)
      .post("/accounts/login")
      .send({ email: validRegistration.email, password: validRegistration.password });

    expect(loginRes.status).toBe(401);
  });
});
