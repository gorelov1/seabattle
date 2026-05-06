/**
 * Integration tests for WsGateway — WebSocket session lifecycle.
 *
 * Tests cover:
 *   - Two clients connecting, completing fleet placement, firing shots
 *   - ShotResult events broadcast to both clients
 *   - OpponentDisconnected event sent when one client disconnects
 *   - SessionRestored event sent on reconnect within timeout
 *   - MatchEnded event sent when reconnect timeout expires
 *
 * Uses in-memory stores (no SQLite), real HTTP server, and the `ws` package
 * for WebSocket clients. Fake timers (vi.useFakeTimers) control the 60-second
 * timeout without actually waiting.
 *
 * Requirements: 13.5, 13.6, 14.5, 14.6, 14.7
 */
export {};
//# sourceMappingURL=wsGateway.test.d.ts.map