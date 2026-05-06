/**
 * JWT authentication middleware.
 *
 * Reads the `Authorization: Bearer <token>` header, verifies the JWT using
 * the same secret as AccountManager, and attaches `{ accountId, tokenId }`
 * to `req.user`.  Returns 401 if the token is missing or invalid.
 */
import type { Request, Response, NextFunction } from "express";
export interface AuthPayload {
    accountId: string;
    tokenId: string;
}
declare global {
    namespace Express {
        interface Request {
            user?: AuthPayload;
        }
    }
}
export declare function createAuthMiddleware(jwtSecret: string): (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.d.ts.map