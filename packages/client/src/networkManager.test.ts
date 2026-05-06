/**
 * Unit tests for NetworkManager REST API helpers.
 *
 * Uses vitest's built-in fetch mocking (via jsdom environment) to verify that
 * each REST helper sends the correct HTTP method, path, headers, and body, and
 * correctly returns the parsed response.
 *
 * Requirements: 13.1, 13.5, 13.6, 14.5, 14.7
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NetworkManager } from './networkManager';
import type { UserAccount, AuthToken } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a minimal Response-like object for fetch mocking. */
function mockResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NetworkManager REST helpers', () => {
  let nm: NetworkManager;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fetchSpy: any;

  beforeEach(() => {
    nm = new NetworkManager('http://localhost:3000');
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // register
  // -------------------------------------------------------------------------

  describe('register', () => {
    it('sends POST /accounts/register with correct body and returns UserAccount', async () => {
      const account: UserAccount = {
        id: 'acc-1',
        email: 'alice@example.com',
        displayName: 'Alice',
        profileIcon: 'anchor',
        verified: false,
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      fetchSpy.mockResolvedValueOnce(mockResponse(account, 201));

      const result = await nm.register('alice@example.com', 'Alice', 'anchor', 'secret123');

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];

      expect(url).toBe('http://localhost:3000/accounts/register');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual({
        email: 'alice@example.com',
        displayName: 'Alice',
        profileIcon: 'anchor',
        password: 'secret123',
      });
      expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
      expect(result).toEqual(account);
    });

    it('throws on non-OK response', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse({ error: 'EmailTaken' }, 409));

      await expect(nm.register('taken@example.com', 'Bob', 'ship', 'pass')).rejects.toThrow(
        'EmailTaken'
      );
    });
  });

  // -------------------------------------------------------------------------
  // login
  // -------------------------------------------------------------------------

  describe('login', () => {
    it('sends POST /accounts/login with correct body and returns AuthToken', async () => {
      const authToken: AuthToken = {
        accountId: 'acc-1',
        issuedAt: '2024-01-01T00:00:00.000Z',
        expiresAt: '2024-01-02T00:00:00.000Z',
        tokenId: 'tok-1',
        jwt: 'jwt.token.here',
      };

      fetchSpy.mockResolvedValueOnce(mockResponse(authToken, 200));

      const result = await nm.login('alice@example.com', 'secret123');

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];

      expect(url).toBe('http://localhost:3000/accounts/login');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual({
        email: 'alice@example.com',
        password: 'secret123',
      });
      expect(result).toEqual(authToken);
    });

    it('throws on invalid credentials', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse({ error: 'InvalidCredentials' }, 401));

      await expect(nm.login('alice@example.com', 'wrong')).rejects.toThrow('InvalidCredentials');
    });
  });

  // -------------------------------------------------------------------------
  // createSession
  // -------------------------------------------------------------------------

  describe('createSession', () => {
    it('sends POST /sessions with Authorization header and returns sessionId + inviteCode', async () => {
      const sessionResponse = { sessionId: 'sess-1', inviteCode: 'ABC123' };

      fetchSpy.mockResolvedValueOnce(mockResponse(sessionResponse, 201));

      const result = await nm.createSession('my-jwt-token');

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];

      expect(url).toBe('http://localhost:3000/sessions');
      expect(init.method).toBe('POST');
      expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer my-jwt-token');
      expect(result).toEqual(sessionResponse);
    });
  });

  // -------------------------------------------------------------------------
  // joinSession
  // -------------------------------------------------------------------------

  describe('joinSession', () => {
    it('sends POST /sessions/join with inviteCode and Authorization header', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse({ sessionId: 'sess-2' }, 200));

      const result = await nm.joinSession('my-jwt-token', 'XYZ789');

      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://localhost:3000/sessions/join');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual({ inviteCode: 'XYZ789' });
      expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer my-jwt-token');
      expect(result).toEqual({ sessionId: 'sess-2' });
    });
  });

  // -------------------------------------------------------------------------
  // updateProfile
  // -------------------------------------------------------------------------

  describe('updateProfile', () => {
    it('sends PATCH /accounts/me with update payload and Authorization header', async () => {
      const updated: UserAccount = {
        id: 'acc-1',
        email: 'alice@example.com',
        displayName: 'Alice Updated',
        profileIcon: 'anchor',
        verified: true,
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      fetchSpy.mockResolvedValueOnce(mockResponse(updated, 200));

      const result = await nm.updateProfile('my-jwt-token', { displayName: 'Alice Updated' });

      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://localhost:3000/accounts/me');
      expect(init.method).toBe('PATCH');
      expect(JSON.parse(init.body as string)).toEqual({ displayName: 'Alice Updated' });
      expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer my-jwt-token');
      expect(result).toEqual(updated);
    });
  });

  // -------------------------------------------------------------------------
  // deleteAccount
  // -------------------------------------------------------------------------

  describe('deleteAccount', () => {
    it('sends DELETE /accounts/me with confirmation and Authorization header', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse({ message: 'Account deleted successfully' }, 200));

      await nm.deleteAccount('my-jwt-token', true);

      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://localhost:3000/accounts/me');
      expect(init.method).toBe('DELETE');
      expect(JSON.parse(init.body as string)).toEqual({ confirmation: true });
      expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer my-jwt-token');
    });
  });

  // -------------------------------------------------------------------------
  // enqueueMatchmaking / dequeueMatchmaking
  // -------------------------------------------------------------------------

  describe('enqueueMatchmaking', () => {
    it('sends POST /matchmaking/enqueue with Authorization header', async () => {
      const queueResponse = { status: 'queued', queuedAt: '2024-01-01T00:00:00.000Z' };
      fetchSpy.mockResolvedValueOnce(mockResponse(queueResponse, 200));

      const result = await nm.enqueueMatchmaking('my-jwt-token');

      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://localhost:3000/matchmaking/enqueue');
      expect(init.method).toBe('POST');
      expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer my-jwt-token');
      expect(result).toEqual(queueResponse);
    });
  });

  describe('dequeueMatchmaking', () => {
    it('sends DELETE /matchmaking/enqueue with Authorization header', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse({ status: 'dequeued' }, 200));

      const result = await nm.dequeueMatchmaking('my-jwt-token');

      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://localhost:3000/matchmaking/enqueue');
      expect(init.method).toBe('DELETE');
      expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer my-jwt-token');
      expect(result).toEqual({ status: 'dequeued' });
    });
  });

  // -------------------------------------------------------------------------
  // baseUrl trailing slash handling
  // -------------------------------------------------------------------------

  describe('baseUrl normalization', () => {
    it('strips trailing slash from baseUrl', async () => {
      const nmTrailing = new NetworkManager('http://localhost:3000/');
      fetchSpy.mockResolvedValueOnce(mockResponse({ status: 'queued', queuedAt: '' }, 200));

      await nmTrailing.enqueueMatchmaking('tok');

      const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://localhost:3000/matchmaking/enqueue');
    });
  });
});
