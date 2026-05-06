/**
 * NetworkManager — manages WebSocket connection and REST API calls for the
 * Sea Battle client.
 *
 * WebSocket: connects to wss://<host>/sessions/{sessionId}?token=<jwt>
 * REST: uses the browser's native fetch API for account and session endpoints.
 *
 * Requirements: 13.1, 13.5, 13.6, 14.5, 14.7
 */

import type { ShipPlacement } from '@sea-battle/domain';
import type {
  GameEvent,
  UserAccount,
  AuthToken,
  ProfileUpdate,
} from './types';

// ---------------------------------------------------------------------------
// NetworkManager
// ---------------------------------------------------------------------------

export class NetworkManager {
  private ws: WebSocket | null = null;
  private eventHandlers: Array<(event: GameEvent) => void> = [];
  private readonly baseUrl: string;

  /**
   * @param baseUrl - Base URL for REST API calls (e.g. "http://localhost:3000").
   *                  Defaults to empty string (same origin).
   */
  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  // ---------------------------------------------------------------------------
  // WebSocket methods
  // ---------------------------------------------------------------------------

  /**
   * Opens a WebSocket connection to the given session.
   * The JWT token is passed as a query parameter so the server can authenticate
   * the connection before any messages are exchanged.
   *
   * Requirement 13.5, 13.6
   */
  connect(sessionId: string, token: string): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Derive WebSocket URL from baseUrl (http → ws, https → wss)
    const wsBase = this.baseUrl
      .replace(/^https:\/\//, 'wss://')
      .replace(/^http:\/\//, 'ws://');

    const url = `${wsBase}/sessions/${encodeURIComponent(sessionId)}?token=${encodeURIComponent(token)}`;
    this.ws = new WebSocket(url);

    this.ws.addEventListener('message', (event: MessageEvent) => {
      let parsed: GameEvent;
      try {
        parsed = JSON.parse(event.data as string) as GameEvent;
      } catch {
        // Ignore malformed messages
        return;
      }
      for (const handler of this.eventHandlers) {
        handler(parsed);
      }
    });
  }

  /**
   * Sends a ship placement to the server.
   * Requirement 13.5
   */
  sendPlacement(placement: ShipPlacement): void {
    this.sendMessage({ type: 'place_ship', placement });
  }

  /**
   * Sends a shot to the server.
   * @param coord - Serialized coordinate string, e.g. "G7".
   * Requirement 13.6
   */
  sendShot(coord: string): void {
    this.sendMessage({ type: 'fire_shot', coord });
  }

  /**
   * Sends a ping to the server to keep the connection alive.
   * Requirement 14.7
   */
  ping(): void {
    this.sendMessage({ type: 'ping' });
  }

  /**
   * Registers a handler for incoming GameEvents.
   * Returns an unsubscribe function that removes the handler.
   * Requirement 13.6
   */
  onEvent(handler: (event: GameEvent) => void): () => void {
    this.eventHandlers.push(handler);
    return () => {
      this.eventHandlers = this.eventHandlers.filter((h) => h !== handler);
    };
  }

  /**
   * Closes the WebSocket connection and clears all event handlers.
   * Requirement 14.5
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.eventHandlers = [];
  }

  // ---------------------------------------------------------------------------
  // REST API helpers — Account endpoints
  // ---------------------------------------------------------------------------

  /**
   * Registers a new user account.
   * POST /accounts/register
   * Requirement 13.1
   */
  async register(
    email: string,
    displayName: string,
    profileIcon: string,
    password: string
  ): Promise<UserAccount> {
    return this.post<UserAccount>('/accounts/register', {
      email,
      displayName,
      profileIcon,
      password,
    });
  }

  /**
   * Authenticates with email and password; returns an AuthToken.
   * POST /accounts/login
   * Requirement 13.1
   */
  async login(email: string, password: string): Promise<AuthToken> {
    return this.post<AuthToken>('/accounts/login', { email, password });
  }

  /**
   * Updates the authenticated user's profile.
   * PATCH /accounts/me
   * Requirement 13.1
   */
  async updateProfile(token: string, update: ProfileUpdate): Promise<UserAccount> {
    return this.patch<UserAccount>('/accounts/me', update, token);
  }

  /**
   * Deletes the authenticated user's account.
   * DELETE /accounts/me
   * Requirement 13.1
   */
  async deleteAccount(token: string, confirmation: boolean): Promise<void> {
    await this.delete('/accounts/me', { confirmation }, token);
  }

  // ---------------------------------------------------------------------------
  // REST API helpers — Session endpoints
  // ---------------------------------------------------------------------------

  /**
   * Creates a new invite-based session.
   * POST /sessions
   * Requirement 13.1
   */
  async createSession(token: string): Promise<{ sessionId: string; inviteCode: string }> {
    return this.post<{ sessionId: string; inviteCode: string }>('/sessions', {}, token);
  }

  /**
   * Joins an existing session by invite code.
   * POST /sessions/join
   * Requirement 13.1
   */
  async joinSession(token: string, inviteCode: string): Promise<{ sessionId: string }> {
    return this.post<{ sessionId: string }>('/sessions/join', { inviteCode }, token);
  }

  // ---------------------------------------------------------------------------
  // REST API helpers — Matchmaking endpoints
  // ---------------------------------------------------------------------------

  /**
   * Enters the matchmaking queue.
   * POST /matchmaking/enqueue
   * Requirement 14.5
   */
  async enqueueMatchmaking(token: string): Promise<{ status: string; queuedAt: string }> {
    return this.post<{ status: string; queuedAt: string }>('/matchmaking/enqueue', {}, token);
  }

  /**
   * Cancels matchmaking and leaves the queue.
   * DELETE /matchmaking/enqueue
   * Requirement 14.5
   */
  async dequeueMatchmaking(token: string): Promise<{ status: string }> {
    return this.delete<{ status: string }>('/matchmaking/enqueue', undefined, token);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private sendMessage(msg: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private async post<T>(path: string, body: unknown, token?: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.buildHeaders(token),
      body: JSON.stringify(body),
    });
    return this.handleResponse<T>(res);
  }

  private async patch<T>(path: string, body: unknown, token?: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'PATCH',
      headers: this.buildHeaders(token),
      body: JSON.stringify(body),
    });
    return this.handleResponse<T>(res);
  }

  private async delete<T = void>(path: string, body?: unknown, token?: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'DELETE',
      headers: this.buildHeaders(token),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return this.handleResponse<T>(res);
  }

  private buildHeaders(token?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  private async handleResponse<T>(res: Response): Promise<T> {
    if (!res.ok) {
      let errorMessage = `HTTP ${res.status}`;
      try {
        const body = await res.json() as { error?: string };
        if (body.error) {
          errorMessage = body.error;
        }
      } catch {
        // Ignore JSON parse errors on error responses
      }
      throw new Error(errorMessage);
    }

    // 204 No Content — return undefined cast to T
    if (res.status === 204) {
      return undefined as unknown as T;
    }

    return res.json() as Promise<T>;
  }
}
