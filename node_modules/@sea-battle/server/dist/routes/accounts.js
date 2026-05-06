/**
 * Express router for account and session setup endpoints.
 *
 * Routes:
 *   POST   /accounts/register  → AccountManager.register
 *   POST   /accounts/login     → AccountManager.authenticate
 *   PATCH  /accounts/me        → AccountManager.updateProfile  (auth required)
 *   DELETE /accounts/me        → AccountManager.deleteAccount  (auth required)
 *
 * Domain errors are mapped to HTTP status codes per the design document.
 */
import { Router } from "express";
import { RegistrationError, AuthError, UpdateError, DeleteError, } from "../accountManager.js";
import { createAuthMiddleware } from "../middleware/auth.js";
// ---------------------------------------------------------------------------
// Error → HTTP status mapping
// ---------------------------------------------------------------------------
const REGISTRATION_STATUS = {
    [RegistrationError.InvalidEmail]: 400,
    [RegistrationError.InvalidIcon]: 400,
    [RegistrationError.WeakPassword]: 400,
    [RegistrationError.EmailTaken]: 409,
};
const AUTH_STATUS = {
    [AuthError.InvalidCredentials]: 401,
    [AuthError.AccountNotFound]: 404,
};
const UPDATE_STATUS = {
    [UpdateError.AccountNotFound]: 404,
    [UpdateError.InvalidIcon]: 400,
    [UpdateError.InvalidEmail]: 400,
    [UpdateError.WrongCurrentPassword]: 401,
    [UpdateError.EmailTaken]: 409,
};
const DELETE_STATUS = {
    [DeleteError.AccountNotFound]: 404,
    [DeleteError.ConfirmationRequired]: 400,
};
// ---------------------------------------------------------------------------
// Router factory — accepts AccountManager and JWT secret for DI / testing
// ---------------------------------------------------------------------------
export function createAccountsRouter(accountManager, jwtSecret) {
    const router = Router();
    const requireAuth = createAuthMiddleware(jwtSecret);
    // -------------------------------------------------------------------------
    // POST /accounts/register
    // -------------------------------------------------------------------------
    router.post("/register", async (req, res) => {
        const { email, displayName, profileIcon, password } = req.body;
        if (typeof email !== "string" ||
            typeof displayName !== "string" ||
            typeof profileIcon !== "string" ||
            typeof password !== "string") {
            res.status(400).json({ error: "Missing required fields" });
            return;
        }
        const result = await accountManager.register({
            email,
            displayName,
            profileIcon,
            password,
        });
        if (!result.ok) {
            const status = REGISTRATION_STATUS[result.error] ?? 400;
            res.status(status).json({ error: result.error });
            return;
        }
        res.status(201).json(result.value);
    });
    // -------------------------------------------------------------------------
    // POST /accounts/login
    // -------------------------------------------------------------------------
    router.post("/login", async (req, res) => {
        const { email, password } = req.body;
        if (typeof email !== "string" || typeof password !== "string") {
            res.status(400).json({ error: "Missing required fields" });
            return;
        }
        const result = await accountManager.authenticate(email, password);
        if (!result.ok) {
            const status = AUTH_STATUS[result.error] ?? 401;
            res.status(status).json({ error: result.error });
            return;
        }
        res.status(200).json(result.value);
    });
    // -------------------------------------------------------------------------
    // PATCH /accounts/me  (auth required)
    // -------------------------------------------------------------------------
    router.patch("/me", requireAuth, async (req, res) => {
        const accountId = req.user.accountId;
        const { displayName, profileIcon, newPassword, email } = req.body;
        const update = {};
        if (displayName !== undefined) {
            if (typeof displayName !== "string") {
                res.status(400).json({ error: "displayName must be a string" });
                return;
            }
            update.displayName = displayName;
        }
        if (profileIcon !== undefined) {
            if (typeof profileIcon !== "string") {
                res.status(400).json({ error: "profileIcon must be a string" });
                return;
            }
            update.profileIcon = profileIcon;
        }
        if (newPassword !== undefined) {
            const np = newPassword;
            if (typeof np["current"] !== "string" ||
                typeof np["new"] !== "string") {
                res
                    .status(400)
                    .json({ error: "newPassword must have current and new fields" });
                return;
            }
            update.newPassword = { current: np["current"], new: np["new"] };
        }
        if (email !== undefined) {
            if (typeof email !== "string") {
                res.status(400).json({ error: "email must be a string" });
                return;
            }
            update.email = email;
        }
        const result = await accountManager.updateProfile(accountId, update);
        if (!result.ok) {
            const status = UPDATE_STATUS[result.error] ?? 400;
            res.status(status).json({ error: result.error });
            return;
        }
        res.status(200).json(result.value);
    });
    // -------------------------------------------------------------------------
    // DELETE /accounts/me  (auth required)
    // -------------------------------------------------------------------------
    router.delete("/me", requireAuth, async (req, res) => {
        const accountId = req.user.accountId;
        const { confirmation } = req.body;
        const result = await accountManager.deleteAccount(accountId, confirmation === true);
        if (!result.ok) {
            const status = DELETE_STATUS[result.error] ?? 400;
            res.status(status).json({ error: result.error });
            return;
        }
        res.status(200).json({ message: "Account deleted successfully" });
    });
    return router;
}
//# sourceMappingURL=accounts.js.map