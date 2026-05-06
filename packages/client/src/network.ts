/**
 * Shared NetworkManager singleton.
 *
 * The base URL is read from the VITE_API_BASE_URL environment variable so it
 * can be set per-environment without changing source code.
 *
 * In development: set VITE_API_BASE_URL in packages/client/.env
 * In production:  set VITE_API_BASE_URL in packages/client/.env.production
 *                 or as a build-time env var on your hosting platform.
 */

import { NetworkManager } from './networkManager';

const baseUrl = import.meta.env['VITE_API_BASE_URL'] as string | undefined ?? '';

export const network = new NetworkManager(baseUrl);
