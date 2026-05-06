/**
 * WsGateway — WebSocket gateway for Sea Battle game sessions.
 *
 * Manages WebSocket connections, validates JWTs, routes client messages to
 * GameService, and broadcasts GameEvents to connected clients.
 *
 * Requirements: 13.5, 13.6, 13.7, 14.5, 14.7
 */
import * as http from "http";
import { type GameService } from "./gameService.js";
import type { SessionService } from "./sessionService.js";
export type GameEvent = {
    type: "SessionRestored";
    boardA: string;
    boardB: string;
    turnState: string;
    status: string;
} | {
    type: "PlacementAck";
    playerId: string;
    boardReady: boolean;
} | {
    type: "MatchStarted";
    firstPlayer: string;
} | {
    type: "ShotResult";
    shooter: string;
    coord: string;
    outcome: string;
    autoMarked: string[];
    winner?: string;
} | {
    type: "TurnChanged";
    activePlayer: string;
} | {
    type: "MatchEnded";
    winner: string;
} | {
    type: "OpponentDisconnected";
    timeout: number;
} | {
    type: "OpponentReconnected";
} | {
    type: "pong";
};
export declare class WsGateway {
    private readonly wss;
    private readonly gameService;
    private readonly sessionService;
    private readonly jwtSecret;
    private readonly disconnectTimeoutMs;
    /**
     * Map from sessionId → Map<playerId, WebSocket>
     * Tracks all currently connected clients per session.
     */
    private readonly clients;
    /**
     * Map from sessionId → Map<playerId, NodeJS.Timeout>
     * Tracks pending disconnection timers.
     */
    private readonly disconnectTimers;
    constructor(server: http.Server, gameService: GameService, sessionService: SessionService, jwtSecret: string, disconnectTimeoutMs?: number);
    private handleConnection;
    private handleMessage;
    private handlePlaceShip;
    private handleFireShot;
    private handleDisconnect;
    private handleDisconnectTimeout;
    /** Sends a GameEvent to all clients in a session. */
    private broadcastToSession;
    /** Sends a GameEvent to all clients in a session except the specified player. */
    private broadcastToOthers;
    /** Sends a GameEvent to a single WebSocket. */
    private send;
}
//# sourceMappingURL=wsGateway.d.ts.map