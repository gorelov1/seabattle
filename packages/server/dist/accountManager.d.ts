/**
 * AccountManager — registration and authentication for user accounts.
 *
 * Designed for dependency injection: pass a `DbInterface` in the constructor
 * so tests can use an in-memory SQLite database without touching the file system.
 */
export declare const ICON_LIBRARY: string[];
export declare const EmailVerifier: {
    /**
     * Returns true iff the string matches `local-part@domain` where:
     *  - local-part is non-empty
     *  - domain is non-empty and contains at least one dot
     *
     * // Feature: sea-battle-game, Property 12: Email format validation is total
     */
    isValidFormat(email: string): boolean;
};
export type Result<T, E> = {
    ok: true;
    value: T;
} | {
    ok: false;
    error: E;
};
export interface RegistrationRequest {
    email: string;
    displayName: string;
    profileIcon: string;
    password: string;
}
export declare enum RegistrationError {
    InvalidEmail = "InvalidEmail",
    EmailTaken = "EmailTaken",
    InvalidIcon = "InvalidIcon",
    WeakPassword = "WeakPassword"
}
export interface UserAccount {
    id: string;
    email: string;
    pendingEmail: string | null;
    displayName: string;
    profileIcon: string;
    verified: boolean;
    createdAt: string;
}
export declare enum AuthError {
    InvalidCredentials = "InvalidCredentials",
    AccountNotFound = "AccountNotFound"
}
export interface ProfileUpdate {
    displayName?: string;
    profileIcon?: string;
    newPassword?: {
        current: string;
        new: string;
    };
    email?: string;
}
export declare enum UpdateError {
    AccountNotFound = "AccountNotFound",
    InvalidIcon = "InvalidIcon",
    InvalidEmail = "InvalidEmail",
    WrongCurrentPassword = "WrongCurrentPassword",
    EmailTaken = "EmailTaken"
}
export declare enum DeleteError {
    AccountNotFound = "AccountNotFound",
    ConfirmationRequired = "ConfirmationRequired"
}
export interface AuthToken {
    accountId: string;
    issuedAt: string;
    expiresAt: string;
    tokenId: string;
    jwt: string;
}
export interface AccountRow {
    id: string;
    email: string;
    pending_email: string | null;
    display_name: string;
    profile_icon: string;
    password_hash: string;
    verified: number;
    created_at: string;
}
export interface AuthTokenRow {
    token_id: string;
    account_id: string;
    issued_at: string;
    expires_at: string;
}
export interface AccountQueries {
    insert(row: AccountRow): unknown;
    findByEmail(email: string): AccountRow | undefined;
    findById(id: string): AccountRow | undefined;
    update(row: Omit<AccountRow, "created_at">): unknown;
    delete(id: string): unknown;
}
export interface AuthTokenQueries {
    insert(row: AuthTokenRow): unknown;
    findById(tokenId: string): AuthTokenRow | undefined;
    findByAccount(accountId: string): AuthTokenRow[];
    delete(tokenId: string): unknown;
    deleteByAccount(accountId: string): unknown;
}
export declare class AccountManager {
    private readonly accountQueries;
    private readonly authTokenQueries;
    private readonly jwtSecret;
    constructor(accountQueries: AccountQueries, authTokenQueries: AuthTokenQueries, jwtSecret?: string);
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
    register(req: RegistrationRequest): Promise<Result<UserAccount, RegistrationError>>;
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
    authenticate(email: string, password: string): Promise<Result<AuthToken, AuthError>>;
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
    updateProfile(accountId: string, update: ProfileUpdate): Promise<Result<UserAccount, UpdateError>>;
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
    deleteAccount(accountId: string, confirmation: boolean): Promise<Result<void, DeleteError>>;
}
export declare function createDefaultAccountManager(): Promise<AccountManager>;
//# sourceMappingURL=accountManager.d.ts.map