/**
 * Unit tests for AccountManager — registration and authentication.
 *
 * Uses a simple in-memory store (Map-based) for dependency injection so that
 * tests run without any native binaries (better-sqlite3 requires a compiled
 * native module that may not be available in all environments).
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import jwt from "jsonwebtoken";

import {
  AccountManager,
  EmailVerifier,
  ICON_LIBRARY,
  RegistrationError,
  AuthError,
  UpdateError,
  DeleteError,
  type AccountQueries,
  type AuthTokenQueries,
  type AccountRow,
  type AuthTokenRow,
} from "./accountManager.js";

// ---------------------------------------------------------------------------
// In-memory store implementations
// ---------------------------------------------------------------------------

function createInMemoryAccountQueries(): AccountQueries & {
  _store: Map<string, AccountRow>;
} {
  const store = new Map<string, AccountRow>();
  return {
    _store: store,
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

function createInMemoryAuthTokenQueries(): AuthTokenQueries & {
  _store: Map<string, AuthTokenRow>;
} {
  const store = new Map<string, AuthTokenRow>();
  return {
    _store: store,
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
// Test helpers
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = "test-secret";

function createManager(): {
  manager: AccountManager;
  accountStore: ReturnType<typeof createInMemoryAccountQueries>;
  tokenStore: ReturnType<typeof createInMemoryAuthTokenQueries>;
} {
  const accountStore = createInMemoryAccountQueries();
  const tokenStore = createInMemoryAuthTokenQueries();
  const manager = new AccountManager(accountStore, tokenStore, TEST_JWT_SECRET);
  return { manager, accountStore, tokenStore };
}

const validRequest = {
  email: "alice@example.com",
  displayName: "Alice",
  profileIcon: ICON_LIBRARY[0]!, // "anchor"
  password: "correct-horse-battery-staple",
};

// ---------------------------------------------------------------------------
// EmailVerifier tests
// ---------------------------------------------------------------------------

describe("EmailVerifier.isValidFormat", () => {
  it("accepts a standard email address", () => {
    expect(EmailVerifier.isValidFormat("user@example.com")).toBe(true);
  });

  it("accepts email with subdomain", () => {
    expect(EmailVerifier.isValidFormat("user@mail.example.com")).toBe(true);
  });

  it("rejects string with no @", () => {
    expect(EmailVerifier.isValidFormat("userexample.com")).toBe(false);
  });

  it("rejects string with empty local part", () => {
    expect(EmailVerifier.isValidFormat("@example.com")).toBe(false);
  });

  it("rejects string with empty domain", () => {
    expect(EmailVerifier.isValidFormat("user@")).toBe(false);
  });

  it("rejects domain with no dot", () => {
    expect(EmailVerifier.isValidFormat("user@localhost")).toBe(false);
  });

  it("rejects domain starting with a dot", () => {
    expect(EmailVerifier.isValidFormat("user@.example.com")).toBe(false);
  });

  it("rejects domain ending with a dot", () => {
    expect(EmailVerifier.isValidFormat("user@example.com.")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(EmailVerifier.isValidFormat("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ICON_LIBRARY tests
// ---------------------------------------------------------------------------

describe("ICON_LIBRARY", () => {
  it("contains at least 10 icons", () => {
    expect(ICON_LIBRARY.length).toBeGreaterThanOrEqual(10);
  });

  it("contains expected icons", () => {
    expect(ICON_LIBRARY).toContain("anchor");
    expect(ICON_LIBRARY).toContain("ship");
    expect(ICON_LIBRARY).toContain("compass");
  });
});

// ---------------------------------------------------------------------------
// AccountManager.register tests
// ---------------------------------------------------------------------------

describe("AccountManager.register", () => {
  let manager: AccountManager;
  let accountStore: ReturnType<typeof createInMemoryAccountQueries>;

  beforeEach(() => {
    ({ manager, accountStore } = createManager());
  });

  it("succeeds with valid registration data", async () => {
    const result = await manager.register(validRequest);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.email).toBe(validRequest.email);
    expect(result.value.displayName).toBe(validRequest.displayName);
    expect(result.value.profileIcon).toBe(validRequest.profileIcon);
    expect(result.value.verified).toBe(false);
    expect(result.value.pendingEmail).toBeNull();
    expect(typeof result.value.id).toBe("string");
    expect(result.value.id.length).toBeGreaterThan(0);
    expect(typeof result.value.createdAt).toBe("string");
  });

  it("does not include passwordHash in the returned UserAccount", async () => {
    const result = await manager.register(validRequest);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // The returned object must not have a passwordHash field
    const asRecord = result.value as unknown as Record<string, unknown>;
    expect(asRecord["passwordHash"]).toBeUndefined();
    expect(asRecord["password_hash"]).toBeUndefined();
  });

  it("stores a bcrypt hash, not the plain-text password", async () => {
    const result = await manager.register(validRequest);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Read directly from the in-memory store to verify the stored hash
    const row = accountStore.findByEmail(validRequest.email) as AccountRow;
    expect(row).toBeDefined();
    expect(row.password_hash).not.toBe(validRequest.password);
    // bcryptjs hashes start with $2b$ or $2a$
    expect(row.password_hash).toMatch(/^\$2[ab]\$/);
  });

  it("rejects an invalid email format", async () => {
    const result = await manager.register({
      ...validRequest,
      email: "not-an-email",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(RegistrationError.InvalidEmail);
  });

  it("rejects a duplicate email", async () => {
    await manager.register(validRequest);

    const result = await manager.register({
      ...validRequest,
      displayName: "Bob",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(RegistrationError.EmailTaken);
  });

  it("rejects an icon not in ICON_LIBRARY", async () => {
    const result = await manager.register({
      ...validRequest,
      profileIcon: "unicorn",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(RegistrationError.InvalidIcon);
  });

  it("assigns a unique UUID to each account", async () => {
    const result1 = await manager.register(validRequest);
    const result2 = await manager.register({
      ...validRequest,
      email: "bob@example.com",
    });

    expect(result1.ok).toBe(true);
    expect(result2.ok).toBe(true);
    if (!result1.ok || !result2.ok) return;

    expect(result1.value.id).not.toBe(result2.value.id);
  });
});

// ---------------------------------------------------------------------------
// AccountManager.authenticate tests
// ---------------------------------------------------------------------------

describe("AccountManager.authenticate", () => {
  let manager: AccountManager;
  let tokenStore: ReturnType<typeof createInMemoryAuthTokenQueries>;

  beforeEach(async () => {
    ({ manager, tokenStore } = createManager());
    // Pre-register an account for authentication tests
    await manager.register(validRequest);
  });

  it("succeeds with correct credentials and returns a JWT", async () => {
    const result = await manager.authenticate(
      validRequest.email,
      validRequest.password
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const token = result.value;
    expect(typeof token.jwt).toBe("string");
    expect(token.jwt.length).toBeGreaterThan(0);
    expect(typeof token.tokenId).toBe("string");
    expect(typeof token.accountId).toBe("string");
    expect(typeof token.issuedAt).toBe("string");
    expect(typeof token.expiresAt).toBe("string");
  });

  it("JWT payload contains accountId and tokenId", async () => {
    const result = await manager.authenticate(
      validRequest.email,
      validRequest.password
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const decoded = jwt.verify(result.value.jwt, TEST_JWT_SECRET) as Record<
      string,
      unknown
    >;
    expect(decoded["accountId"]).toBe(result.value.accountId);
    expect(decoded["tokenId"]).toBe(result.value.tokenId);
  });

  it("expiresAt is approximately 24 hours after issuedAt", async () => {
    const result = await manager.authenticate(
      validRequest.email,
      validRequest.password
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const issued = new Date(result.value.issuedAt).getTime();
    const expires = new Date(result.value.expiresAt).getTime();
    const diffHours = (expires - issued) / (1000 * 60 * 60);

    // Allow a small tolerance for test execution time
    expect(diffHours).toBeCloseTo(24, 0);
  });

  it("rejects wrong password with InvalidCredentials", async () => {
    const result = await manager.authenticate(
      validRequest.email,
      "wrong-password"
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(AuthError.InvalidCredentials);
  });

  it("rejects unknown email with InvalidCredentials (not AccountNotFound)", async () => {
    const result = await manager.authenticate(
      "nobody@example.com",
      validRequest.password
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    // Must return InvalidCredentials to avoid email enumeration
    expect(result.error).toBe(AuthError.InvalidCredentials);
    expect(result.error).not.toBe(AuthError.AccountNotFound);
  });

  it("persists the auth token to the in-memory store", async () => {
    const result = await manager.authenticate(
      validRequest.email,
      validRequest.password
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const tokenRow = tokenStore.findById(result.value.tokenId);
    expect(tokenRow).toBeDefined();
    expect(tokenRow!.account_id).toBe(result.value.accountId);
  });
});

// ---------------------------------------------------------------------------
// AccountManager.updateProfile tests
// ---------------------------------------------------------------------------

describe("AccountManager.updateProfile", () => {
  let manager: AccountManager;
  let accountStore: ReturnType<typeof createInMemoryAccountQueries>;
  let registeredId: string;

  beforeEach(async () => {
    ({ manager, accountStore } = createManager());
    const result = await manager.register(validRequest);
    if (!result.ok) throw new Error("Setup failed: registration error");
    registeredId = result.value.id;
  });

  it("updates displayName successfully", async () => {
    const result = await manager.updateProfile(registeredId, {
      displayName: "Alice Updated",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.displayName).toBe("Alice Updated");
    expect(result.value.email).toBe(validRequest.email);
  });

  it("updates profileIcon with a valid icon successfully", async () => {
    const newIcon = ICON_LIBRARY[1]!; // "ship"
    const result = await manager.updateProfile(registeredId, {
      profileIcon: newIcon,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.profileIcon).toBe(newIcon);
  });

  it("rejects profileIcon update with an invalid icon", async () => {
    const result = await manager.updateProfile(registeredId, {
      profileIcon: "unicorn",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(UpdateError.InvalidIcon);
  });

  it("updates password with correct current password", async () => {
    const newPassword = "new-super-secure-password";
    const result = await manager.updateProfile(registeredId, {
      newPassword: { current: validRequest.password, new: newPassword },
    });

    expect(result.ok).toBe(true);

    // Verify new password works for authentication
    const authResult = await manager.authenticate(
      validRequest.email,
      newPassword
    );
    expect(authResult.ok).toBe(true);
  });

  it("rejects password update with wrong current password", async () => {
    const result = await manager.updateProfile(registeredId, {
      newPassword: { current: "wrong-password", new: "new-password" },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(UpdateError.WrongCurrentPassword);
  });

  it("email update sets pendingEmail and does not change active email", async () => {
    const newEmail = "alice-new@example.com";
    const result = await manager.updateProfile(registeredId, {
      email: newEmail,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Active email must remain unchanged
    expect(result.value.email).toBe(validRequest.email);
    // Pending email must be set to the new address
    expect(result.value.pendingEmail).toBe(newEmail);
  });

  it("rejects email update with invalid format", async () => {
    const result = await manager.updateProfile(registeredId, {
      email: "not-an-email",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(UpdateError.InvalidEmail);
  });

  it("rejects email update when email is already taken by another account", async () => {
    // Register a second account
    await manager.register({
      ...validRequest,
      email: "bob@example.com",
      displayName: "Bob",
    });

    // Try to update Alice's email to Bob's email
    const result = await manager.updateProfile(registeredId, {
      email: "bob@example.com",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(UpdateError.EmailTaken);
  });

  it("accountId is never changed by any update", async () => {
    const originalId = registeredId;

    const result = await manager.updateProfile(registeredId, {
      displayName: "New Name",
      profileIcon: ICON_LIBRARY[2]!,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.id).toBe(originalId);

    // Also verify in the store
    const row = accountStore.findById(originalId);
    expect(row).toBeDefined();
    expect(row!.id).toBe(originalId);
  });

  it("returns AccountNotFound for unknown accountId", async () => {
    const result = await manager.updateProfile("non-existent-id", {
      displayName: "Ghost",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(UpdateError.AccountNotFound);
  });
});

// ---------------------------------------------------------------------------
// AccountManager.deleteAccount tests
// ---------------------------------------------------------------------------

describe("AccountManager.deleteAccount", () => {
  let manager: AccountManager;
  let accountStore: ReturnType<typeof createInMemoryAccountQueries>;
  let tokenStore: ReturnType<typeof createInMemoryAuthTokenQueries>;
  let registeredId: string;

  beforeEach(async () => {
    ({ manager, accountStore, tokenStore } = createManager());
    const result = await manager.register(validRequest);
    if (!result.ok) throw new Error("Setup failed: registration error");
    registeredId = result.value.id;
  });

  it("succeeds with confirmation=true", async () => {
    const result = await manager.deleteAccount(registeredId, true);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeUndefined();

    // Account should no longer exist in the store
    expect(accountStore.findById(registeredId)).toBeUndefined();
  });

  it("rejects deletion with confirmation=false", async () => {
    const result = await manager.deleteAccount(registeredId, false);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(DeleteError.ConfirmationRequired);

    // Account must still exist
    expect(accountStore.findById(registeredId)).toBeDefined();
  });

  it("returns AccountNotFound for unknown accountId", async () => {
    const result = await manager.deleteAccount("non-existent-id", true);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(DeleteError.AccountNotFound);
  });

  it("invalidates all auth tokens after deletion", async () => {
    // Issue a couple of tokens first
    await manager.authenticate(validRequest.email, validRequest.password);
    await manager.authenticate(validRequest.email, validRequest.password);

    // Confirm tokens exist
    const tokensBefore = tokenStore.findByAccount(registeredId);
    expect(tokensBefore.length).toBeGreaterThan(0);

    // Delete the account
    const result = await manager.deleteAccount(registeredId, true);
    expect(result.ok).toBe(true);

    // All tokens for this account must be gone
    const tokensAfter = tokenStore.findByAccount(registeredId);
    expect(tokensAfter.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------

// Feature: sea-battle-game, Property 12: Email format validation is total
describe("Property 12: Email format validation is total", () => {
  /**
   * Validates: Requirements 15.3, 15.4, 16.8, 16.9
   *
   * EmailVerifier.isValidFormat accepts a string iff it matches
   * `local-part@domain` (non-empty local, `@`, non-empty domain with at
   * least one dot, domain must not start or end with a dot).
   */

  // -------------------------------------------------------------------------
  // Strategy 1: valid emails are accepted
  // -------------------------------------------------------------------------
  it("accepts any string matching local@domain.tld — Validates: Requirements 15.3, 15.4, 16.8, 16.9", () => {
    // Generate a non-empty local part (printable ASCII, no @)
    const localArb = fc
      .string({ minLength: 1, maxLength: 20 })
      .filter((s) => s.length > 0 && !s.includes("@"));

    // Generate a non-empty domain label (no dots, no @)
    const labelArb = fc
      .string({ minLength: 1, maxLength: 10 })
      .filter((s) => s.length > 0 && !s.includes(".") && !s.includes("@"));

    // Domain = label + "." + label (at least one dot, does not start/end with dot)
    const domainArb = fc
      .tuple(labelArb, labelArb)
      .map(([left, right]) => `${left}.${right}`);

    const validEmailArb = fc
      .tuple(localArb, domainArb)
      .map(([local, domain]) => `${local}@${domain}`);

    fc.assert(
      fc.property(validEmailArb, (email) => {
        return EmailVerifier.isValidFormat(email) === true;
      }),
      { numRuns: 100 }
    );
  });

  // -------------------------------------------------------------------------
  // Strategy 2: strings missing @ are rejected
  // -------------------------------------------------------------------------
  it("rejects any string that contains no @ character — Validates: Requirements 15.3, 15.4, 16.8, 16.9", () => {
    const noAtArb = fc
      .string({ minLength: 0, maxLength: 30 })
      .filter((s) => !s.includes("@"));

    fc.assert(
      fc.property(noAtArb, (s) => {
        return EmailVerifier.isValidFormat(s) === false;
      }),
      { numRuns: 100 }
    );
  });

  // -------------------------------------------------------------------------
  // Strategy 3: strings with empty local part are rejected
  // -------------------------------------------------------------------------
  it("rejects strings with an empty local part (starts with @) — Validates: Requirements 15.3, 15.4, 16.8, 16.9", () => {
    // Generate a non-empty domain with at least one dot
    const labelArb = fc
      .string({ minLength: 1, maxLength: 10 })
      .filter((s) => s.length > 0 && !s.includes(".") && !s.includes("@"));

    const domainArb = fc
      .tuple(labelArb, labelArb)
      .map(([left, right]) => `${left}.${right}`);

    const emptyLocalArb = domainArb.map((domain) => `@${domain}`);

    fc.assert(
      fc.property(emptyLocalArb, (email) => {
        return EmailVerifier.isValidFormat(email) === false;
      }),
      { numRuns: 100 }
    );
  });

  // -------------------------------------------------------------------------
  // Strategy 4: strings with empty domain are rejected
  // -------------------------------------------------------------------------
  it("rejects strings with an empty domain (ends with @) — Validates: Requirements 15.3, 15.4, 16.8, 16.9", () => {
    const localArb = fc
      .string({ minLength: 1, maxLength: 20 })
      .filter((s) => s.length > 0 && !s.includes("@"));

    const emptyDomainArb = localArb.map((local) => `${local}@`);

    fc.assert(
      fc.property(emptyDomainArb, (email) => {
        return EmailVerifier.isValidFormat(email) === false;
      }),
      { numRuns: 100 }
    );
  });

  // -------------------------------------------------------------------------
  // Strategy 5: strings with a domain that has no dot are rejected
  // -------------------------------------------------------------------------
  it("rejects strings whose domain contains no dot — Validates: Requirements 15.3, 15.4, 16.8, 16.9", () => {
    const localArb = fc
      .string({ minLength: 1, maxLength: 20 })
      .filter((s) => s.length > 0 && !s.includes("@"));

    // Domain with no dot and no @
    const noDotDomainArb = fc
      .string({ minLength: 1, maxLength: 20 })
      .filter((s) => s.length > 0 && !s.includes(".") && !s.includes("@"));

    const noDotEmailArb = fc
      .tuple(localArb, noDotDomainArb)
      .map(([local, domain]) => `${local}@${domain}`);

    fc.assert(
      fc.property(noDotEmailArb, (email) => {
        return EmailVerifier.isValidFormat(email) === false;
      }),
      { numRuns: 100 }
    );
  });

  // -------------------------------------------------------------------------
  // Strategy 6: strings with multiple @ characters are rejected
  // -------------------------------------------------------------------------
  it("rejects strings containing more than one @ character — Validates: Requirements 15.3, 15.4, 16.8, 16.9", () => {
    const labelArb = fc
      .string({ minLength: 1, maxLength: 10 })
      .filter((s) => s.length > 0 && !s.includes("@") && !s.includes("."));

    // Build strings with exactly two @ signs: local@middle@domain.tld
    const multiAtArb = fc
      .tuple(labelArb, labelArb, labelArb, labelArb)
      .map(([a, b, c, d]) => `${a}@${b}@${c}.${d}`);

    fc.assert(
      fc.property(multiAtArb, (email) => {
        return EmailVerifier.isValidFormat(email) === false;
      }),
      { numRuns: 100 }
    );
  });
});

// Feature: sea-battle-game, Property 13: Profile icon membership check is total
describe("Property 13: Profile icon membership check is total", () => {
  /**
   * Validates: Requirements 15.7, 15.8, 16.3, 16.4
   *
   * AccountManager accepts a profileIcon iff it is a member of ICON_LIBRARY.
   * This is tested via both register() and updateProfile():
   *   - Strategy 1: any icon drawn from ICON_LIBRARY is accepted on registration
   *   - Strategy 2: any string not in ICON_LIBRARY is rejected on registration
   *   - Strategy 3: any icon drawn from ICON_LIBRARY is accepted on profile update
   *   - Strategy 4: any string not in ICON_LIBRARY is rejected on profile update
   */

  // -------------------------------------------------------------------------
  // Strategy 1: icons from ICON_LIBRARY are accepted during registration
  // -------------------------------------------------------------------------
  it("accepts any icon that is a member of ICON_LIBRARY during registration — Validates: Requirements 15.7, 15.8", async () => {
    // Arbitrarily pick an icon from the library by index
    const iconArb = fc
      .integer({ min: 0, max: ICON_LIBRARY.length - 1 })
      .map((i) => ICON_LIBRARY[i]!);

    await fc.assert(
      fc.asyncProperty(iconArb, async (icon) => {
        const { manager } = createManager();
        // Use a unique email per run to avoid EmailTaken errors
        const email = `user-${icon}-${Math.random().toString(36).slice(2)}@example.com`;
        const result = await manager.register({
          email,
          displayName: "TestUser",
          profileIcon: icon,
          password: "test-password-123",
        });
        return result.ok === true;
      }),
      { numRuns: 100 }
    );
  }, 60000);

  // -------------------------------------------------------------------------
  // Strategy 2: strings not in ICON_LIBRARY are rejected during registration
  // -------------------------------------------------------------------------
  it("rejects any icon that is not a member of ICON_LIBRARY during registration — Validates: Requirements 15.7, 15.8", async () => {
    // Generate arbitrary strings and filter out any that happen to be in ICON_LIBRARY
    const invalidIconArb = fc
      .string({ minLength: 1, maxLength: 30 })
      .filter((s) => !ICON_LIBRARY.includes(s));

    await fc.assert(
      fc.asyncProperty(invalidIconArb, async (icon) => {
        const { manager } = createManager();
        const email = `user-${Math.random().toString(36).slice(2)}@example.com`;
        const result = await manager.register({
          email,
          displayName: "TestUser",
          profileIcon: icon,
          password: "test-password-123",
        });
        if (result.ok) return false;
        return result.error === RegistrationError.InvalidIcon;
      }),
      { numRuns: 100 }
    );
  }, 60000);

  // -------------------------------------------------------------------------
  // Strategy 3: icons from ICON_LIBRARY are accepted during profile update
  // -------------------------------------------------------------------------
  it("accepts any icon that is a member of ICON_LIBRARY during profile update — Validates: Requirements 16.3, 16.4", async () => {
    const iconArb = fc
      .integer({ min: 0, max: ICON_LIBRARY.length - 1 })
      .map((i) => ICON_LIBRARY[i]!);

    await fc.assert(
      fc.asyncProperty(iconArb, async (icon) => {
        const { manager } = createManager();
        // Register an account first
        const regResult = await manager.register({
          ...validRequest,
          email: `update-${icon}-${Math.random().toString(36).slice(2)}@example.com`,
        });
        if (!regResult.ok) return false;

        const updateResult = await manager.updateProfile(regResult.value.id, {
          profileIcon: icon,
        });
        return updateResult.ok === true;
      }),
      { numRuns: 100 }
    );
  }, 60000);

  // -------------------------------------------------------------------------
  // Strategy 4: strings not in ICON_LIBRARY are rejected during profile update
  // -------------------------------------------------------------------------
  it("rejects any icon that is not a member of ICON_LIBRARY during profile update — Validates: Requirements 16.3, 16.4", async () => {
    const invalidIconArb = fc
      .string({ minLength: 1, maxLength: 30 })
      .filter((s) => !ICON_LIBRARY.includes(s));

    await fc.assert(
      fc.asyncProperty(invalidIconArb, async (icon) => {
        const { manager } = createManager();
        // Register an account first
        const regResult = await manager.register({
          ...validRequest,
          email: `update-invalid-${Math.random().toString(36).slice(2)}@example.com`,
        });
        if (!regResult.ok) return false;

        const updateResult = await manager.updateProfile(regResult.value.id, {
          profileIcon: icon,
        });
        if (updateResult.ok) return false;
        return updateResult.error === UpdateError.InvalidIcon;
      }),
      { numRuns: 100 }
    );
  }, 60000);
});

// Feature: sea-battle-game, Property 15: Register-then-authenticate round-trip
describe("Property 15: Register-then-authenticate round-trip", () => {
  /**
   * Validates: Requirements 15.10, 15.11
   *
   * For any valid registration payload, registering and then authenticating
   * with the same credentials succeeds.
   *
   * Strategy:
   *   1. Generate a valid registration payload (valid email, valid icon from
   *      ICON_LIBRARY, non-empty password)
   *   2. Register the account
   *   3. Authenticate with the same email and password
   *   4. Verify authentication succeeds
   */
  it("authenticating with the same credentials after registration always succeeds — Validates: Requirements 15.10, 15.11", async () => {
    // Generate a non-empty local part (no @ sign)
    const localArb = fc
      .string({ minLength: 1, maxLength: 20 })
      .filter((s) => s.length > 0 && !s.includes("@"));

    // Generate a valid domain label (no dots, no @)
    const labelArb = fc
      .string({ minLength: 1, maxLength: 10 })
      .filter((s) => s.length > 0 && !s.includes(".") && !s.includes("@"));

    // Domain = label + "." + label (at least one dot, does not start/end with dot)
    const domainArb = fc
      .tuple(labelArb, labelArb)
      .map(([left, right]) => `${left}.${right}`);

    // Valid email
    const emailArb = fc
      .tuple(localArb, domainArb)
      .map(([local, domain]) => `${local}@${domain}`);

    // Valid icon from ICON_LIBRARY
    const iconArb = fc
      .integer({ min: 0, max: ICON_LIBRARY.length - 1 })
      .map((i) => ICON_LIBRARY[i]!);

    // Non-empty password
    const passwordArb = fc.string({ minLength: 1, maxLength: 50 });

    // Display name (any string)
    const displayNameArb = fc.string({ minLength: 1, maxLength: 30 });

    await fc.assert(
      fc.asyncProperty(
        emailArb,
        iconArb,
        passwordArb,
        displayNameArb,
        async (email, profileIcon, password, displayName) => {
          const { manager } = createManager();

          // Step 2: Register the account
          const regResult = await manager.register({
            email,
            displayName,
            profileIcon,
            password,
          });

          // Registration must succeed for a valid payload
          if (!regResult.ok) return false;

          // Step 3: Authenticate with the same email and password
          const authResult = await manager.authenticate(email, password);

          // Step 4: Verify authentication succeeds
          return authResult.ok === true;
        }
      ),
      { numRuns: 100 }
    );
  }, 60000);
});

// Feature: sea-battle-game, Property 14: Account identifier is immutable across updates
describe("Property 14: Account identifier is immutable across updates", () => {
  /**
   * Validates: Requirements 15.9, 16.12
   *
   * For any account and any sequence of valid profile updates
   * (displayName, profileIcon, email, password), the accountId SHALL remain
   * unchanged after every update in the sequence.
   *
   * Strategy:
   *   1. Register an account and capture the accountId
   *   2. Generate a random sequence of valid profile updates
   *   3. Apply each update and verify the accountId is unchanged after every update
   */
  it("accountId is unchanged after every profile update in a sequence — Validates: Requirements 15.9, 16.12", async () => {
    // Arbitraries for valid update fields

    // Valid display name: non-empty string
    const displayNameArb = fc.string({ minLength: 1, maxLength: 30 });

    // Valid icon from ICON_LIBRARY
    const iconArb = fc
      .integer({ min: 0, max: ICON_LIBRARY.length - 1 })
      .map((i) => ICON_LIBRARY[i]!);

    // Valid email for pending email change (unique per run via random suffix)
    const labelArb = fc
      .string({ minLength: 1, maxLength: 10 })
      .filter((s) => s.length > 0 && !s.includes(".") && !s.includes("@"));
    const domainArb = fc
      .tuple(labelArb, labelArb)
      .map(([left, right]) => `${left}.${right}`);
    const localArb = fc
      .string({ minLength: 1, maxLength: 20 })
      .filter((s) => s.length > 0 && !s.includes("@"));
    const emailArb = fc
      .tuple(localArb, domainArb)
      .map(([local, domain]) => `${local}@${domain}`);

    // A single update step: one of the four supported update types
    const updateStepArb = fc.oneof(
      // displayName update
      displayNameArb.map((displayName) => ({ displayName })),
      // profileIcon update
      iconArb.map((profileIcon) => ({ profileIcon })),
      // email update (pending email change — does not affect active credential)
      emailArb.map((email) => ({ email }))
    );

    // A sequence of 1–5 update steps
    const updateSequenceArb = fc.array(updateStepArb, {
      minLength: 1,
      maxLength: 5,
    });

    await fc.assert(
      fc.asyncProperty(updateSequenceArb, async (updates) => {
        const { manager } = createManager();

        // Step 1: Register an account and capture the accountId
        const regResult = await manager.register({
          ...validRequest,
          // Use a unique email per property run to avoid EmailTaken collisions
          email: `prop14-${Math.random().toString(36).slice(2)}@example.com`,
        });
        if (!regResult.ok) return false;

        const originalAccountId = regResult.value.id;

        // Step 2 & 3: Apply each update and verify accountId is unchanged
        for (const update of updates) {
          const updateResult = await manager.updateProfile(
            originalAccountId,
            update
          );

          // The update must succeed (all generated updates are valid)
          if (!updateResult.ok) return false;

          // accountId must be identical to the original after every update
          if (updateResult.value.id !== originalAccountId) return false;
        }

        return true;
      }),
      { numRuns: 100 }
    );
  }, 60000);
});

// Feature: sea-battle-game, Property 16: Password update invalidates old credential
describe("Property 16: Password update invalidates old credential", () => {
  /**
   * Validates: Requirements 16.7
   *
   * After a successful password update, authenticating with the new password
   * succeeds and authenticating with the old password fails.
   *
   * Strategy:
   *   1. Register an account with a known password
   *   2. Generate a new password (different from the old one)
   *   3. Update the password (supplying the current password for verification)
   *   4. Verify: authenticating with the new password succeeds
   *   5. Verify: authenticating with the old password fails
   */
  it("new password authenticates successfully and old password is rejected after update — Validates: Requirements 16.7", async () => {
    // Non-empty password arbitraries
    const passwordArb = fc.string({ minLength: 1, maxLength: 50 });

    // Generate two distinct passwords
    const distinctPasswordsArb = fc
      .tuple(passwordArb, passwordArb)
      .filter(([oldPw, newPw]) => oldPw !== newPw);

    await fc.assert(
      fc.asyncProperty(distinctPasswordsArb, async ([oldPassword, newPassword]) => {
        const { manager } = createManager();

        // Step 1: Register an account with the old password
        const email = `prop16-${Math.random().toString(36).slice(2)}@example.com`;
        const regResult = await manager.register({
          email,
          displayName: "TestUser",
          profileIcon: ICON_LIBRARY[0]!,
          password: oldPassword,
        });
        if (!regResult.ok) return false;

        const accountId = regResult.value.id;

        // Step 3: Update the password (requires current password verification)
        const updateResult = await manager.updateProfile(accountId, {
          newPassword: { current: oldPassword, new: newPassword },
        });
        // The update must succeed
        if (!updateResult.ok) return false;

        // Step 4: Authenticating with the new password must succeed
        const newAuthResult = await manager.authenticate(email, newPassword);
        if (!newAuthResult.ok) return false;

        // Step 5: Authenticating with the old password must fail
        const oldAuthResult = await manager.authenticate(email, oldPassword);
        if (oldAuthResult.ok) return false;

        return true;
      }),
      { numRuns: 100 }
    );
  }, 60000);
});

// Feature: sea-battle-game, Property 17: Pending email change retains old credential
describe("Property 17: Pending email change retains old credential", () => {
  /**
   * Validates: Requirements 16.11
   *
   * For any account with a pending (unconfirmed) email change, authenticating
   * with the original email address SHALL succeed.
   *
   * Strategy:
   *   1. Register an account with a known email
   *   2. Submit an email change (sets pendingEmail, does not change active email)
   *   3. Verify: authenticating with the ORIGINAL email still succeeds
   *   4. Verify: the pendingEmail is set to the new email
   */
  it("original email still authenticates after a pending email change — Validates: Requirements 16.11", async () => {
    // Arbitraries for valid email addresses
    const labelArb = fc
      .string({ minLength: 1, maxLength: 10 })
      .filter((s) => s.length > 0 && !s.includes(".") && !s.includes("@"));
    const domainArb = fc
      .tuple(labelArb, labelArb)
      .map(([left, right]) => `${left}.${right}`);
    const localArb = fc
      .string({ minLength: 1, maxLength: 20 })
      .filter((s) => s.length > 0 && !s.includes("@"));
    const emailArb = fc
      .tuple(localArb, domainArb)
      .map(([local, domain]) => `${local}@${domain}`);

    // Generate two distinct valid emails: one for registration, one for the pending change
    const distinctEmailsArb = fc
      .tuple(emailArb, emailArb)
      .filter(([original, pending]) => original !== pending);

    await fc.assert(
      fc.asyncProperty(distinctEmailsArb, async ([originalEmail, newEmail]) => {
        const { manager } = createManager();

        // Step 1: Register an account with the original email
        const regResult = await manager.register({
          email: originalEmail,
          displayName: "TestUser",
          profileIcon: ICON_LIBRARY[0]!,
          password: validRequest.password,
        });

        // Registration must succeed for a valid payload
        if (!regResult.ok) return false;

        const accountId = regResult.value.id;

        // Step 2: Submit an email change — sets pendingEmail, does NOT change active email
        const updateResult = await manager.updateProfile(accountId, {
          email: newEmail,
        });

        // The update must succeed
        if (!updateResult.ok) return false;

        // Step 4: Verify pendingEmail is set to the new email
        if (updateResult.value.pendingEmail !== newEmail) return false;

        // Step 3: Verify authenticating with the ORIGINAL email still succeeds
        const authResult = await manager.authenticate(
          originalEmail,
          validRequest.password
        );

        return authResult.ok === true;
      }),
      { numRuns: 100 }
    );
  }, 60000);
});

// Feature: sea-battle-game, Property 18: Deleted account tokens are all invalidated
describe("Property 18: Deleted account tokens are all invalidated", () => {
  /**
   * Validates: Requirements 17.5, 17.7
   *
   * After account deletion, every previously issued token for that account
   * SHALL be rejected by the authentication system.
   *
   * Strategy:
   *   1. Register an account
   *   2. Generate a random number of tokens (1 to 5) by authenticating multiple times
   *   3. Delete the account
   *   4. Verify: all previously issued tokens are no longer in the token store
   *              (tokenStore.findByAccount returns empty array)
   *   5. Verify: attempting to authenticate after deletion fails
   */
  it("all previously issued tokens are invalidated after account deletion — Validates: Requirements 17.5, 17.7", async () => {
    const tokenCountArb = fc.integer({ min: 1, max: 5 });

    await fc.assert(
      fc.asyncProperty(tokenCountArb, async (tokenCount) => {
        const { manager, tokenStore } = createManager();

        // Step 1: Register an account
        const email = `prop18-${Math.random().toString(36).slice(2)}@example.com`;
        const regResult = await manager.register({
          email,
          displayName: "TestUser",
          profileIcon: ICON_LIBRARY[0]!,
          password: validRequest.password,
        });
        if (!regResult.ok) return false;

        const accountId = regResult.value.id;

        // Step 2: Generate multiple tokens by authenticating multiple times
        const issuedTokenIds: string[] = [];
        for (let i = 0; i < tokenCount; i++) {
          const authResult = await manager.authenticate(
            email,
            validRequest.password
          );
          if (!authResult.ok) return false;
          issuedTokenIds.push(authResult.value.tokenId);
        }

        // Verify tokens exist in the store before deletion
        const tokensBeforeDeletion = tokenStore.findByAccount(accountId);
        if (tokensBeforeDeletion.length !== tokenCount) return false;

        // Step 3: Delete the account
        const deleteResult = await manager.deleteAccount(accountId, true);
        if (!deleteResult.ok) return false;

        // Step 4: Verify all previously issued tokens are no longer in the token store
        const tokensAfterDeletion = tokenStore.findByAccount(accountId);
        if (tokensAfterDeletion.length !== 0) return false;

        // Also verify each individual token is gone from the store
        for (const tokenId of issuedTokenIds) {
          const token = tokenStore.findById(tokenId);
          if (token !== undefined) return false;
        }

        // Step 5: Verify attempting to authenticate after deletion fails
        const authAfterDelete = await manager.authenticate(
          email,
          validRequest.password
        );
        if (authAfterDelete.ok) return false;

        return true;
      }),
      { numRuns: 100 }
    );
  }, 60000);
});

// ---------------------------------------------------------------------------
// Integration tests — account persistence lifecycle
// ---------------------------------------------------------------------------

describe("Integration: full account lifecycle", () => {
  /**
   * Validates: Requirements 15.1–15.11, 16.1–16.12, 17.1–17.7
   *
   * Exercises the complete account lifecycle end-to-end using the in-memory
   * store, verifying DB state after each operation:
   *   1. Register → account in store with correct fields
   *   2. Update display name → persisted in store
   *   3. Update profile icon → persisted in store
   *   4. Change password → old password fails, new password works
   *   5. Initiate email change → pendingEmail set, original email still authenticates
   *   6. Delete account → removed from store, tokens invalidated, auth fails
   */
  it("persists correct state after each lifecycle operation and rejects deleted-account tokens", async () => {
    const { manager, accountStore, tokenStore } = createManager();

    const email = "lifecycle@example.com";
    const password = "initial-password-123";
    const newPassword = "updated-password-456";
    const newEmail = "lifecycle-new@example.com";

    // -----------------------------------------------------------------------
    // Step 1: Register
    // -----------------------------------------------------------------------
    const regResult = await manager.register({
      email,
      displayName: "Lifecycle User",
      profileIcon: ICON_LIBRARY[0]!, // "anchor"
      password,
    });

    expect(regResult.ok).toBe(true);
    if (!regResult.ok) return;

    const accountId = regResult.value.id;

    // Verify DB state after registration
    const rowAfterReg = accountStore.findById(accountId);
    expect(rowAfterReg).toBeDefined();
    expect(rowAfterReg!.email).toBe(email);
    expect(rowAfterReg!.display_name).toBe("Lifecycle User");
    expect(rowAfterReg!.profile_icon).toBe(ICON_LIBRARY[0]);
    expect(rowAfterReg!.pending_email).toBeNull();
    expect(rowAfterReg!.verified).toBe(0);
    // Password must be stored as a bcrypt hash, not plain text
    expect(rowAfterReg!.password_hash).not.toBe(password);
    expect(rowAfterReg!.password_hash).toMatch(/^\$2[ab]\$/);

    // -----------------------------------------------------------------------
    // Step 2: Update display name
    // -----------------------------------------------------------------------
    const updateNameResult = await manager.updateProfile(accountId, {
      displayName: "Updated Name",
    });

    expect(updateNameResult.ok).toBe(true);
    if (!updateNameResult.ok) return;
    expect(updateNameResult.value.displayName).toBe("Updated Name");

    // Verify DB state after display name update
    const rowAfterNameUpdate = accountStore.findById(accountId);
    expect(rowAfterNameUpdate).toBeDefined();
    expect(rowAfterNameUpdate!.display_name).toBe("Updated Name");
    // Other fields must be unchanged
    expect(rowAfterNameUpdate!.email).toBe(email);
    expect(rowAfterNameUpdate!.profile_icon).toBe(ICON_LIBRARY[0]);
    expect(rowAfterNameUpdate!.id).toBe(accountId);

    // -----------------------------------------------------------------------
    // Step 3: Update profile icon
    // -----------------------------------------------------------------------
    const newIcon = ICON_LIBRARY[1]!; // "ship"
    const updateIconResult = await manager.updateProfile(accountId, {
      profileIcon: newIcon,
    });

    expect(updateIconResult.ok).toBe(true);
    if (!updateIconResult.ok) return;
    expect(updateIconResult.value.profileIcon).toBe(newIcon);

    // Verify DB state after icon update
    const rowAfterIconUpdate = accountStore.findById(accountId);
    expect(rowAfterIconUpdate).toBeDefined();
    expect(rowAfterIconUpdate!.profile_icon).toBe(newIcon);
    // Other fields must be unchanged
    expect(rowAfterIconUpdate!.display_name).toBe("Updated Name");
    expect(rowAfterIconUpdate!.email).toBe(email);
    expect(rowAfterIconUpdate!.id).toBe(accountId);

    // -----------------------------------------------------------------------
    // Step 4: Change password
    // -----------------------------------------------------------------------
    const changePasswordResult = await manager.updateProfile(accountId, {
      newPassword: { current: password, new: newPassword },
    });

    expect(changePasswordResult.ok).toBe(true);
    if (!changePasswordResult.ok) return;

    // Verify DB state: password hash must have changed
    const rowAfterPasswordChange = accountStore.findById(accountId);
    expect(rowAfterPasswordChange).toBeDefined();
    // The stored hash must differ from the original hash
    expect(rowAfterPasswordChange!.password_hash).not.toBe(
      rowAfterReg!.password_hash
    );

    // Old password must now fail authentication
    const oldPasswordAuth = await manager.authenticate(email, password);
    expect(oldPasswordAuth.ok).toBe(false);
    if (!oldPasswordAuth.ok) {
      expect(oldPasswordAuth.error).toBe(AuthError.InvalidCredentials);
    }

    // New password must succeed authentication
    const newPasswordAuth = await manager.authenticate(email, newPassword);
    expect(newPasswordAuth.ok).toBe(true);

    // -----------------------------------------------------------------------
    // Step 5: Initiate email change (sets pendingEmail)
    // -----------------------------------------------------------------------
    const emailChangeResult = await manager.updateProfile(accountId, {
      email: newEmail,
    });

    expect(emailChangeResult.ok).toBe(true);
    if (!emailChangeResult.ok) return;
    // Active email must remain unchanged
    expect(emailChangeResult.value.email).toBe(email);
    // Pending email must be set to the new address
    expect(emailChangeResult.value.pendingEmail).toBe(newEmail);

    // Verify DB state after email change initiation
    const rowAfterEmailChange = accountStore.findById(accountId);
    expect(rowAfterEmailChange).toBeDefined();
    expect(rowAfterEmailChange!.email).toBe(email); // active email unchanged
    expect(rowAfterEmailChange!.pending_email).toBe(newEmail);

    // Original email must still authenticate (pending email is not yet active)
    const authWithOriginalEmail = await manager.authenticate(email, newPassword);
    expect(authWithOriginalEmail.ok).toBe(true);

    // -----------------------------------------------------------------------
    // Step 6: Delete account
    // -----------------------------------------------------------------------

    // Issue a token before deletion so we can verify it is invalidated
    const tokenBeforeDelete = await manager.authenticate(email, newPassword);
    expect(tokenBeforeDelete.ok).toBe(true);
    if (!tokenBeforeDelete.ok) return;
    const tokenId = tokenBeforeDelete.value.tokenId;

    // Confirm the token exists in the store
    expect(tokenStore.findById(tokenId)).toBeDefined();

    // Delete the account
    const deleteResult = await manager.deleteAccount(accountId, true);
    expect(deleteResult.ok).toBe(true);

    // Account must be removed from the store
    expect(accountStore.findById(accountId)).toBeUndefined();
    expect(accountStore.findByEmail(email)).toBeUndefined();

    // All tokens for this account must be invalidated
    const tokensAfterDelete = tokenStore.findByAccount(accountId);
    expect(tokensAfterDelete.length).toBe(0);

    // The specific token issued before deletion must be gone
    expect(tokenStore.findById(tokenId)).toBeUndefined();

    // Authentication must fail after deletion
    const authAfterDelete = await manager.authenticate(email, newPassword);
    expect(authAfterDelete.ok).toBe(false);
    if (!authAfterDelete.ok) {
      expect(authAfterDelete.error).toBe(AuthError.InvalidCredentials);
    }
  });
});

describe("Integration: token invalidation after account deletion", () => {
  /**
   * Validates: Requirements 17.5, 17.7
   *
   * Registers an account, issues multiple tokens by authenticating multiple
   * times, deletes the account, and verifies that every previously issued
   * token is removed from the token store.
   */
  it("all tokens issued across multiple authentications are invalidated after deletion", async () => {
    const { manager, accountStore, tokenStore } = createManager();

    const email = "multi-token@example.com";
    const password = "multi-token-password";

    // Register the account
    const regResult = await manager.register({
      email,
      displayName: "Multi Token User",
      profileIcon: ICON_LIBRARY[2]!, // "compass"
      password,
    });

    expect(regResult.ok).toBe(true);
    if (!regResult.ok) return;

    const accountId = regResult.value.id;

    // Issue multiple tokens by authenticating multiple times
    const issuedTokenIds: string[] = [];
    const authCount = 5;

    for (let i = 0; i < authCount; i++) {
      const authResult = await manager.authenticate(email, password);
      expect(authResult.ok).toBe(true);
      if (!authResult.ok) return;
      issuedTokenIds.push(authResult.value.tokenId);
    }

    // Verify all tokens are in the store before deletion
    const tokensBeforeDelete = tokenStore.findByAccount(accountId);
    expect(tokensBeforeDelete.length).toBe(authCount);

    for (const tokenId of issuedTokenIds) {
      expect(tokenStore.findById(tokenId)).toBeDefined();
    }

    // Delete the account
    const deleteResult = await manager.deleteAccount(accountId, true);
    expect(deleteResult.ok).toBe(true);

    // Account must be gone from the store
    expect(accountStore.findById(accountId)).toBeUndefined();

    // All tokens must be gone from the token store
    const tokensAfterDelete = tokenStore.findByAccount(accountId);
    expect(tokensAfterDelete.length).toBe(0);

    // Each individual token must be gone
    for (const tokenId of issuedTokenIds) {
      expect(tokenStore.findById(tokenId)).toBeUndefined();
    }

    // Authentication must fail after deletion (account no longer exists)
    const authAfterDelete = await manager.authenticate(email, password);
    expect(authAfterDelete.ok).toBe(false);
    if (!authAfterDelete.ok) {
      expect(authAfterDelete.error).toBe(AuthError.InvalidCredentials);
    }
  });

  it("tokens from other accounts are not affected when one account is deleted", async () => {
    const { manager, tokenStore } = createManager();

    // Register two accounts
    const regA = await manager.register({
      email: "account-a@example.com",
      displayName: "Account A",
      profileIcon: ICON_LIBRARY[0]!,
      password: "password-a",
    });
    const regB = await manager.register({
      email: "account-b@example.com",
      displayName: "Account B",
      profileIcon: ICON_LIBRARY[1]!,
      password: "password-b",
    });

    expect(regA.ok).toBe(true);
    expect(regB.ok).toBe(true);
    if (!regA.ok || !regB.ok) return;

    const accountIdA = regA.value.id;
    const accountIdB = regB.value.id;

    // Issue tokens for both accounts
    const authA = await manager.authenticate("account-a@example.com", "password-a");
    const authB = await manager.authenticate("account-b@example.com", "password-b");

    expect(authA.ok).toBe(true);
    expect(authB.ok).toBe(true);
    if (!authA.ok || !authB.ok) return;

    const tokenIdA = authA.value.tokenId;
    const tokenIdB = authB.value.tokenId;

    // Delete account A
    const deleteResult = await manager.deleteAccount(accountIdA, true);
    expect(deleteResult.ok).toBe(true);

    // Account A's token must be gone
    expect(tokenStore.findById(tokenIdA)).toBeUndefined();
    expect(tokenStore.findByAccount(accountIdA).length).toBe(0);

    // Account B's token must still exist
    expect(tokenStore.findById(tokenIdB)).toBeDefined();
    expect(tokenStore.findByAccount(accountIdB).length).toBe(1);

    // Account B must still be able to authenticate
    const authBAfterDeleteA = await manager.authenticate(
      "account-b@example.com",
      "password-b"
    );
    expect(authBAfterDeleteA.ok).toBe(true);
  });
});
