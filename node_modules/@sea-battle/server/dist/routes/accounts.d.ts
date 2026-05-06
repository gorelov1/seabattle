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
import { AccountManager } from "../accountManager.js";
export declare function createAccountsRouter(accountManager: AccountManager, jwtSecret: string): Router;
//# sourceMappingURL=accounts.d.ts.map