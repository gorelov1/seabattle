/**
 * JWT authentication middleware.
 *
 * Reads the `Authorization: Bearer <token>` header, verifies the JWT using
 * the same secret as AccountManager, and attaches `{ accountId, tokenId }`
 * to `req.user`.  Returns 401 if the token is missing or invalid.
 */
import jwt from "jsonwebtoken";
// ---------------------------------------------------------------------------
// Middleware factory — accepts the JWT secret so it can be injected in tests
// ---------------------------------------------------------------------------
export function createAuthMiddleware(jwtSecret) {
    return function authMiddleware(req, res, next) {
        const authHeader = req.headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            res.status(401).json({ error: "Missing or malformed Authorization header" });
            return;
        }
        const token = authHeader.slice("Bearer ".length);
        try {
            const payload = jwt.verify(token, jwtSecret);
            const accountId = payload["accountId"];
            const tokenId = payload["tokenId"];
            if (typeof accountId !== "string" || typeof tokenId !== "string") {
                res.status(401).json({ error: "Invalid token payload" });
                return;
            }
            req.user = { accountId, tokenId };
            next();
        }
        catch {
            res.status(401).json({ error: "Invalid or expired token" });
        }
    };
}
//# sourceMappingURL=auth.js.map