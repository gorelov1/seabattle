/**
 * AccountManager — registration and authentication for user accounts.
 *
 * Designed for dependency injection: pass a `DbInterface` in the constructor
 * so tests can use an in-memory SQLite database without touching the file system.
 */
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
// ---------------------------------------------------------------------------
// Icon library
// ---------------------------------------------------------------------------
export const ICON_LIBRARY = [
    "anchor",
    "ship",
    "compass",
    "wave",
    "lighthouse",
    "fish",
    "crab",
    "octopus",
    "shark",
    "whale",
    "torpedo",
    "periscope",
];
// ---------------------------------------------------------------------------
// Email verifier
// ---------------------------------------------------------------------------
export const EmailVerifier = {
    /**
     * Returns true iff the string matches `local-part@domain` where:
     *  - local-part is non-empty
     *  - domain is non-empty and contains at least one dot
     *
     * // Feature: sea-battle-game, Property 12: Email format validation is total
     */
    isValidFormat(email) {
        // Must contain exactly one '@'
        const atIndex = email.indexOf("@");
        if (atIndex <= 0)
            return false; // no '@' or empty local part
        if (email.indexOf("@", atIndex + 1) !== -1)
            return false; // multiple '@'
        const local = email.slice(0, atIndex);
        const domain = email.slice(atIndex + 1);
        if (local.length === 0)
            return false;
        if (domain.length === 0)
            return false;
        if (!domain.includes("."))
            return false;
        // Domain must not start or end with a dot
        if (domain.startsWith(".") || domain.endsWith("."))
            return false;
        return true;
    },
};
export var RegistrationError;
(function (RegistrationError) {
    RegistrationError["InvalidEmail"] = "InvalidEmail";
    RegistrationError["EmailTaken"] = "EmailTaken";
    RegistrationError["InvalidIcon"] = "InvalidIcon";
    RegistrationError["WeakPassword"] = "WeakPassword";
})(RegistrationError || (RegistrationError = {}));
export var AuthError;
(function (AuthError) {
    AuthError["InvalidCredentials"] = "InvalidCredentials";
    AuthError["AccountNotFound"] = "AccountNotFound";
})(AuthError || (AuthError = {}));
export var UpdateError;
(function (UpdateError) {
    UpdateError["AccountNotFound"] = "AccountNotFound";
    UpdateError["InvalidIcon"] = "InvalidIcon";
    UpdateError["InvalidEmail"] = "InvalidEmail";
    UpdateError["WrongCurrentPassword"] = "WrongCurrentPassword";
    UpdateError["EmailTaken"] = "EmailTaken";
})(UpdateError || (UpdateError = {}));
// ---------------------------------------------------------------------------
// Account deletion types
// ---------------------------------------------------------------------------
export var DeleteError;
(function (DeleteError) {
    DeleteError["AccountNotFound"] = "AccountNotFound";
    DeleteError["ConfirmationRequired"] = "ConfirmationRequired";
})(DeleteError || (DeleteError = {}));
// ---------------------------------------------------------------------------
// AccountManager
// ---------------------------------------------------------------------------
const BCRYPT_SALT_ROUNDS = 10;
const JWT_EXPIRY_SECONDS = 24 * 60 * 60; // 24 hours
export class AccountManager {
    accountQueries;
    authTokenQueries;
    jwtSecret;
    constructor(accountQueries, authTokenQueries, jwtSecret) {
        this.accountQueries = accountQueries;
        this.authTokenQueries = authTokenQueries;
        this.jwtSecret =
            jwtSecret ??
                process.env["JWT_SECRET"] ??
                "dev-secret-change-in-production";
    }
    /**
     * Register a new user account.
     *
     * Steps:
     * 1. Validate email format
     * 2. Check email uniqueness
     * 3. Validate profileIcon is in ICON_LIBRARY
     * 4. Hash password with bcrypt
     * 5. Generate UUID accountId
     * 6. Persist to DB
     * 7. Return UserAccount (never return passwordHash)
     */
    async register(req) {
        // 1. Validate email format
        if (!EmailVerifier.isValidFormat(req.email)) {
            return { ok: false, error: RegistrationError.InvalidEmail };
        }
        // 2. Check email uniqueness
        const existing = this.accountQueries.findByEmail(req.email);
        if (existing !== undefined) {
            return { ok: false, error: RegistrationError.EmailTaken };
        }
        // 3. Validate profileIcon
        if (!ICON_LIBRARY.includes(req.profileIcon)) {
            return { ok: false, error: RegistrationError.InvalidIcon };
        }
        // 4. Hash password
        const passwordHash = await bcrypt.hash(req.password, BCRYPT_SALT_ROUNDS);
        // 5. Generate UUID
        const accountId = uuidv4();
        const createdAt = new Date().toISOString();
        // 6. Persist
        const row = {
            id: accountId,
            email: req.email,
            pending_email: null,
            display_name: req.displayName,
            profile_icon: req.profileIcon,
            password_hash: passwordHash,
            verified: 0,
            created_at: createdAt,
        };
        this.accountQueries.insert(row);
        // 7. Return UserAccount (no passwordHash)
        const account = {
            id: accountId,
            email: req.email,
            pendingEmail: null,
            displayName: req.displayName,
            profileIcon: req.profileIcon,
            verified: false,
            createdAt,
        };
        return { ok: true, value: account };
    }
    /**
     * Authenticate with email and password; returns a signed JWT AuthToken.
     *
     * Steps:
     * 1. Look up account by email — return InvalidCredentials if not found
     *    (do not reveal whether the email exists)
     * 2. Compare password with bcrypt hash — return InvalidCredentials if mismatch
     * 3. Generate UUID tokenId
     * 4. Issue signed JWT with payload { accountId, tokenId }, expires in 24h
     * 5. Persist token to auth_tokens table
     * 6. Return AuthToken
     */
    async authenticate(email, password) {
        // 1. Look up account — use InvalidCredentials to avoid email enumeration
        const row = this.accountQueries.findByEmail(email);
        if (row === undefined) {
            return { ok: false, error: AuthError.InvalidCredentials };
        }
        // 2. Compare password
        const passwordMatch = await bcrypt.compare(password, row.password_hash);
        if (!passwordMatch) {
            return { ok: false, error: AuthError.InvalidCredentials };
        }
        // 3. Generate tokenId
        const tokenId = uuidv4();
        // 4. Issue JWT
        const issuedAt = new Date();
        const expiresAt = new Date(issuedAt.getTime() + JWT_EXPIRY_SECONDS * 1000);
        const jwtPayload = { accountId: row.id, tokenId };
        const jwtString = jwt.sign(jwtPayload, this.jwtSecret, {
            expiresIn: JWT_EXPIRY_SECONDS,
        });
        // 5. Persist token
        const tokenRow = {
            token_id: tokenId,
            account_id: row.id,
            issued_at: issuedAt.toISOString(),
            expires_at: expiresAt.toISOString(),
        };
        this.authTokenQueries.insert(tokenRow);
        // 6. Return AuthToken
        const authToken = {
            accountId: row.id,
            issuedAt: issuedAt.toISOString(),
            expiresAt: expiresAt.toISOString(),
            tokenId,
            jwt: jwtString,
        };
        return { ok: true, value: authToken };
    }
    /**
     * Update a user's profile fields.
     *
     * Steps:
     * 1. Look up account by accountId — return AccountNotFound if not found
     * 2. If displayName provided: update it
     * 3. If profileIcon provided: validate against ICON_LIBRARY — return InvalidIcon if invalid
     * 4. If newPassword provided: verify current password — return WrongCurrentPassword if mismatch; hash new password
     * 5. If email provided: validate format — return InvalidEmail if invalid; check uniqueness — return EmailTaken if taken; set pending_email
     * 6. Persist changes via accountQueries.update
     * 7. Return updated UserAccount (no passwordHash)
     */
    async updateProfile(accountId, update) {
        // 1. Look up account
        const row = this.accountQueries.findById(accountId);
        if (row === undefined) {
            return { ok: false, error: UpdateError.AccountNotFound };
        }
        // Work on a mutable copy (never modify id or created_at)
        let displayName = row.display_name;
        let profileIcon = row.profile_icon;
        let passwordHash = row.password_hash;
        let pendingEmail = row.pending_email;
        // 2. Update displayName
        if (update.displayName !== undefined) {
            displayName = update.displayName;
        }
        // 3. Validate and update profileIcon
        if (update.profileIcon !== undefined) {
            if (!ICON_LIBRARY.includes(update.profileIcon)) {
                return { ok: false, error: UpdateError.InvalidIcon };
            }
            profileIcon = update.profileIcon;
        }
        // 4. Password update
        if (update.newPassword !== undefined) {
            const passwordMatch = await bcrypt.compare(update.newPassword.current, row.password_hash);
            if (!passwordMatch) {
                return { ok: false, error: UpdateError.WrongCurrentPassword };
            }
            passwordHash = await bcrypt.hash(update.newPassword.new, BCRYPT_SALT_ROUNDS);
        }
        // 5. Email update — sets pending_email, does NOT change active email
        if (update.email !== undefined) {
            if (!EmailVerifier.isValidFormat(update.email)) {
                return { ok: false, error: UpdateError.InvalidEmail };
            }
            const existing = this.accountQueries.findByEmail(update.email);
            if (existing !== undefined && existing.id !== accountId) {
                return { ok: false, error: UpdateError.EmailTaken };
            }
            pendingEmail = update.email;
        }
        // 6. Persist — never modify id or created_at
        const updatedRow = {
            id: row.id, // immutable
            email: row.email, // active email unchanged
            pending_email: pendingEmail,
            display_name: displayName,
            profile_icon: profileIcon,
            password_hash: passwordHash,
            verified: row.verified,
        };
        this.accountQueries.update(updatedRow);
        // 7. Return UserAccount (no passwordHash)
        const account = {
            id: row.id,
            email: row.email,
            pendingEmail,
            displayName,
            profileIcon,
            verified: row.verified === 1,
            createdAt: row.created_at,
        };
        return { ok: true, value: account };
    }
    /**
     * Permanently delete a user account and all associated auth tokens.
     *
     * Steps:
     * 1. If confirmation !== true → return ConfirmationRequired
     * 2. Look up account by accountId — return AccountNotFound if not found
     * 3. Delete all auth_tokens for the account
     * 4. Delete the account
     * 5. Return { ok: true, value: undefined }
     *
     * Note: In-progress match handling (notifying opponents) is handled at the
     * WebSocket layer, not here.
     */
    async deleteAccount(accountId, confirmation) {
        // 1. Require explicit confirmation
        if (confirmation !== true) {
            return { ok: false, error: DeleteError.ConfirmationRequired };
        }
        // 2. Look up account
        const row = this.accountQueries.findById(accountId);
        if (row === undefined) {
            return { ok: false, error: DeleteError.AccountNotFound };
        }
        // 3. Invalidate all auth tokens
        this.authTokenQueries.deleteByAccount(accountId);
        // 4. Delete the account
        this.accountQueries.delete(accountId);
        // 5. Return success
        return { ok: true, value: undefined };
    }
}
// ---------------------------------------------------------------------------
// Factory helper — creates an AccountManager backed by the real DB.
// Import lazily to avoid running migrations at module load time in tests.
// ---------------------------------------------------------------------------
export async function createDefaultAccountManager() {
    const { accountQueries, authTokenQueries } = await import("./db.js");
    return new AccountManager(accountQueries, authTokenQueries);
}
//# sourceMappingURL=accountManager.js.map