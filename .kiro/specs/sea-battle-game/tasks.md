# Implementation Plan: Sea Battle Game

## Overview

Implement the Sea Battle (Mobotan) game in TypeScript as a client–server application. The implementation follows a bottom-up order: pure domain logic first (coordinate system, placement, shot processing, turn management, victory detection), then AI opponent, then server infrastructure (accounts, sessions, matchmaking, WebSocket), and finally the client UI. All 22 correctness properties from the design are covered by property-based tests using [fast-check](https://github.com/dubzzz/fast-check).

---

## Tasks

- [x] 1. Project structure and shared type definitions
  - Create monorepo directory layout: `packages/domain`, `packages/server`, `packages/client`
  - Initialize `package.json`, `tsconfig.json`, and `vitest.config.ts` for each package
  - Install shared dev dependencies: TypeScript, Vitest, fast-check
  - Define all core TypeScript types and enums in `packages/domain/src/types.ts`: `Column`, `Row`, `Coordinate`, `CellStatus`, `ShipType`, `Cell`, `Ship`, `Board`, `FleetSpec`, `TurnState`, `TurnPhase`, `ShotOutcome`, `ShotResult`, `PlacementError`, `ShotError`, `ParseError`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 10.1, 10.2_

- [x] 2. CoordinateSystem
  - [x] 2.1 Implement `CoordinateSystem` module in `packages/domain/src/coordinateSystem.ts`
    - Implement `serialize(coord: Coordinate): string` — converts `{col: "G", row: 7}` to `"G7"`
    - Implement `parse(s: string): Result<Coordinate, ParseError>` — validates format and returns typed coordinate or error
    - Implement `isValid(col: Column, row: Row): boolean`
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 11.1, 11.2, 11.3_

  - [x] 2.2 Write property test — Property 1: Coordinate round-trip
    - **Property 1: For any valid coordinate (col A–J, row 1–10), `parse(serialize(c))` equals `c`**
    - **Validates: Requirements 11.1, 11.2, 11.4**
    - Tag comment: `// Feature: sea-battle-game, Property 1: Coordinate round-trip`

  - [x] 2.3 Write property test — Property 2: Invalid coordinate strings are rejected
    - **Property 2: For any string not matching `[A-J](10|[1-9])`, `parse(s)` returns an error and produces no coordinate**
    - **Validates: Requirements 1.5, 11.3**
    - Tag comment: `// Feature: sea-battle-game, Property 2: Invalid coordinate strings are rejected`

- [x] 3. Checkpoint — coordinate system
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. PlacementEngine
  - [x] 4.1 Implement `PlacementEngine` in `packages/domain/src/placementEngine.ts`
    - Implement `placeShip(board: Board, ship: ShipPlacement): Result<Board, PlacementError>`
    - Validate orientation (horizontal/vertical), bounds (all cells within A–J × 1–10), ship-type quota, cell overlap, and eight-directional adjacency (buffer zone)
    - Implement `isFleetReady(board: Board): boolean` — true when all 10 ships of the FleetSpec are placed
    - Implement `autoPlace(board: Board, fleet: FleetSpec): Board` — random valid placement used by AI
    - _Requirements: 2.3, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 5.2_

  - [x] 4.2 Write property test — Property 3: Ship placement orientation invariant
    - **Property 3: For any accepted placement, horizontal ships share the same row; vertical ships share the same column; all cells are within A–J × 1–10**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
    - Tag comment: `// Feature: sea-battle-game, Property 3: Ship placement orientation invariant`

  - [x] 4.3 Write property test — Property 4: Adjacency rule preserved after every placement
    - **Property 4: For any board produced by a sequence of valid placements, no two ships occupy orthogonally or diagonally adjacent cells**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
    - Tag comment: `// Feature: sea-battle-game, Property 4: Adjacency rule is preserved after every placement`

  - [x] 4.4 Write property test — Property 5: Fleet composition invariant
    - **Property 5: For any board whose fleet is marked ready, it contains exactly 1 Battleship, 2 Cruisers, 3 Destroyers, 4 Patrol Boats — 10 ships and 20 segments**
    - **Validates: Requirements 2.1, 2.2, 5.2**
    - Tag comment: `// Feature: sea-battle-game, Property 5: Fleet composition invariant`

- [x] 5. ShotEngine
  - [x] 5.1 Implement `ShotEngine` in `packages/domain/src/shotEngine.ts`
    - Implement `processShot(board: Board, coord: Coordinate): Result<ShotResult, ShotError>`
    - Return `Miss`, `Hit`, or `Sunk` outcome based on cell content
    - On `Sunk`: increment `hitCount`, set `sunk: true` on the ship, auto-mark all eight-directional buffer-zone cells of the destroyed ship as `Miss` (skip already-shot cells)
    - Reject already-shot coordinates with `ShotError.AlreadyShot` without mutating board state
    - Return `autoMarked: Coordinate[]` in `ShotResult`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 8.1, 8.2, 8.3, 8.4, 10.3, 10.4_

  - [x] 5.2 Write property test — Property 6: Shot outcome correctness
    - **Property 6: For any board and unshot coordinate, outcome is Miss/Hit/Sunk matching cell content**
    - **Validates: Requirements 6.1, 6.2, 6.3**
    - Tag comment: `// Feature: sea-battle-game, Property 6: Shot outcome correctness`

  - [x] 5.3 Write property test — Property 7: Already-shot cells rejected without state change
    - **Property 7: For any board and already-shot coordinate, `processShot` returns `ShotError` and board state is identical before and after**
    - **Validates: Requirements 6.5**
    - Tag comment: `// Feature: sea-battle-game, Property 7: Already-shot cells are rejected without state change`

  - [x] 5.4 Write property test — Property 8: Buffer-zone auto-mark on Sunk
    - **Property 8: After a sinking shot, all previously-Unshot eight-directional neighbors of the destroyed ship are marked Miss; already-shot neighbors are unchanged**
    - **Validates: Requirements 8.1, 8.2, 8.3**
    - Tag comment: `// Feature: sea-battle-game, Property 8: Buffer-zone auto-mark on Sunk`

  - [x] 5.5 Write property test — Property 11: Hit count and sunk flag consistency
    - **Property 11: For any ship, `sunk` is true iff `hitCount == size(shipType)`; `hitCount` never exceeds `size(shipType)`**
    - **Validates: Requirements 10.3, 10.4**
    - Tag comment: `// Feature: sea-battle-game, Property 11: Hit count and sunk flag consistency`

- [x] 6. TurnManager
  - [x] 6.1 Implement `TurnManager` in `packages/domain/src/turnManager.ts`
    - Implement `applyResult(state: TurnState, result: ShotOutcome): TurnState`
    - `Miss` → switch `activePlayer`; `Hit` or `Sunk` → keep `activePlayer` unchanged
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 6.2 Write property test — Property 9: Turn transitions follow shot outcome
    - **Property 9: For any TurnState and sequence of outcomes, active player switches on Miss and stays on Hit/Sunk**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4**
    - Tag comment: `// Feature: sea-battle-game, Property 9: Turn transitions follow shot outcome`

- [x] 7. VictoryDetector
  - [x] 7.1 Implement `VictoryDetector` in `packages/domain/src/victoryDetector.ts`
    - Implement `check(board: Board): Option<Winner>` — returns winner when total sunk segments across all ships equals 20
    - _Requirements: 9.1, 9.2, 9.3_

  - [x] 7.2 Write property test — Property 10: Victory declared iff all 20 segments sunk
    - **Property 10: `check` returns a winner if and only if total sunk segments equals exactly 20**
    - **Validates: Requirements 9.1, 9.2**
    - Tag comment: `// Feature: sea-battle-game, Property 10: Victory is declared if and only if all 20 segments are sunk`

- [x] 8. Checkpoint — core domain logic
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. AIOpponent
  - [x] 9.1 Implement `AIOpponent` in `packages/domain/src/aiOpponent.ts`
    - Implement `placeFleet(spec: FleetSpec): Board` using `PlacementEngine.autoPlace` with random valid placement
    - Implement `chooseShot(opponentBoard: Board): Coordinate` using hunt-and-target strategy: random probing until a hit, then systematic targeting of adjacent unshot cells until the ship is sunk
    - Ensure `chooseShot` always returns a cell with status `Unshot`
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [x] 9.2 Write property test — Property 19: AI placement satisfies all placement rules
    - **Property 19: For any invocation of AI fleet placement, the resulting board satisfies Properties 3, 4, and 5**
    - **Validates: Requirements 12.2**
    - Tag comment: `// Feature: sea-battle-game, Property 19: AI placement satisfies all placement rules`

  - [x] 9.3 Write property test — Property 20: AI never fires at an already-shot cell
    - **Property 20: For any board state, the coordinate chosen by `chooseShot` always has status Unshot**
    - **Validates: Requirements 12.3**
    - Tag comment: `// Feature: sea-battle-game, Property 20: AI never fires at an already-shot cell`

- [x] 10. Local and AI game orchestration
  - Implement `LocalGame` class in `packages/domain/src/localGame.ts` that wires `PlacementEngine`, `ShotEngine`, `TurnManager`, and `VictoryDetector` together for local two-player and single-player vs AI modes
  - Expose methods: `placeShip`, `startMatch`, `fireShot`, `getState`
  - In AI mode, after each human shot that results in Miss, automatically invoke `AIOpponent.chooseShot` and process the AI's turn (including extra turns on Hit/Sunk) until the AI fires a Miss or the match ends
  - Enforce that no shot can be fired before both fleets are ready (Requirement 5.3)
  - Enforce that no shot can be fired after the match has ended (Requirement 9.3)
  - _Requirements: 5.1, 5.3, 5.4, 9.3, 9.4, 12.1, 12.4, 12.5, 12.6_

- [x] 11. Checkpoint — domain and AI
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Server project setup and database schema
  - Initialize `packages/server` with Express, `ws` (WebSocket), `better-sqlite3` (or PostgreSQL via `pg`), `bcrypt`, `jsonwebtoken`, and `uuid`
  - Create database migration files defining tables: `accounts`, `auth_tokens`, `sessions`, `matchmaking_queue`
  - Implement a `db.ts` module that runs migrations on startup and exports a typed query interface
  - _Requirements: 10.5, 15.9, 13.1_

- [x] 13. AccountManager — registration and authentication
  - [x] 13.1 Implement `AccountManager.register` in `packages/server/src/accountManager.ts`
    - Validate email format via `EmailVerifier.isValidFormat`
    - Check email uniqueness against the `accounts` table
    - Validate `profileIcon` membership in `Icon_Library`
    - Hash password with bcrypt; assign UUID `accountId`; persist `UserAccount`
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9, 15.10, 15.11_

  - [x] 13.2 Implement `AccountManager.authenticate`
    - Look up account by email; compare bcrypt hash; issue signed JWT `AuthToken` with `tokenId` UUID
    - _Requirements: 15.11_

  - [x] 13.3 Write property test — Property 12: Email format validation is total
    - **Property 12: `EmailVerifier.isValidFormat` accepts a string iff it matches `local-part@domain` (non-empty local, `@`, non-empty domain with at least one dot)**
    - **Validates: Requirements 15.3, 15.4, 16.8, 16.9**
    - Tag comment: `// Feature: sea-battle-game, Property 12: Email format validation is total`

  - [x] 13.4 Write property test — Property 13: Profile icon membership check is total
    - **Property 13: `AccountManager` accepts an icon iff it is a member of `Icon_Library`**
    - **Validates: Requirements 15.7, 15.8, 16.3, 16.4**
    - Tag comment: `// Feature: sea-battle-game, Property 13: Profile icon membership check is total`

  - [x] 13.5 Write property test — Property 15: Register-then-authenticate round-trip
    - **Property 15: For any valid registration payload, registering and then authenticating with the same credentials succeeds**
    - **Validates: Requirements 15.10, 15.11**
    - Tag comment: `// Feature: sea-battle-game, Property 15: Register-then-authenticate round-trip`

- [x] 14. AccountManager — profile update and deletion
  - [x] 14.1 Implement `AccountManager.updateProfile` in `packages/server/src/accountManager.ts`
    - Support updating `displayName`, `profileIcon`, `password` (requires current password verification), and `email` (sets `pendingEmail`, retains old email as active credential until confirmed)
    - Reject icon updates if icon not in `Icon_Library`; reject email updates if format invalid
    - Never modify `accountId`
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8, 16.9, 16.10, 16.11, 16.12_

  - [x] 14.2 Implement `AccountManager.deleteAccount`
    - Require explicit `confirmation: true`; permanently remove `UserAccount` and all personal data; invalidate all `auth_tokens` for the account; handle in-progress online matches (end match, notify opponent, award win)
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7_

  - [x] 14.3 Write property test — Property 14: Account identifier is immutable across updates
    - **Property 14: For any account and any sequence of valid profile updates, `accountId` is unchanged after every update**
    - **Validates: Requirements 15.9, 16.12**
    - Tag comment: `// Feature: sea-battle-game, Property 14: Account identifier is immutable across updates`

  - [x] 14.4 Write property test — Property 16: Password update invalidates old credential
    - **Property 16: After a successful password update, authenticating with the new password succeeds and with the old password fails**
    - **Validates: Requirements 16.7**
    - Tag comment: `// Feature: sea-battle-game, Property 16: Password update invalidates old credential`

  - [x] 14.5 Write property test — Property 17: Pending email change retains old credential
    - **Property 17: For any account with a pending (unconfirmed) email change, authenticating with the original email address succeeds**
    - **Validates: Requirements 16.11**
    - Tag comment: `// Feature: sea-battle-game, Property 17: Pending email change retains old credential`

  - [x] 14.6 Write property test — Property 18: Deleted account tokens are all invalidated
    - **Property 18: After account deletion, every previously issued token for that account is rejected**
    - **Validates: Requirements 17.5, 17.7**
    - Tag comment: `// Feature: sea-battle-game, Property 18: Deleted account tokens are all invalidated`

- [x] 15. REST API — account and session setup endpoints
  - Implement Express router in `packages/server/src/routes/accounts.ts` for:
    - `POST /accounts/register` → `AccountManager.register`
    - `POST /accounts/login` → `AccountManager.authenticate`
    - `PATCH /accounts/me` → `AccountManager.updateProfile` (JWT auth middleware required)
    - `DELETE /accounts/me` → `AccountManager.deleteAccount` (JWT auth middleware required)
  - Implement JWT auth middleware that validates `AuthToken` and rejects deleted-account tokens
  - Map domain errors to HTTP status codes (400, 401, 403, 404, 409) per the error-handling table in the design
  - _Requirements: 15.1–15.11, 16.1–16.12, 17.1–17.7_

- [x] 16. Session management and invite-code flow
  - [x] 16.1 Implement `SessionService` in `packages/server/src/sessionService.ts`
    - `createSession(playerA: PlayerId): Session` — generates UUID `sessionId` and short alphanumeric `inviteCode`; persists to DB
    - `joinSession(inviteCode: string, playerB: PlayerId): Result<Session, SessionError>` — looks up open session by invite code; rejects invalid codes with `SessionError.InvalidInviteCode`; transitions status to `Placement`
    - `getSession(sessionId: SessionId): Option<Session>`
    - _Requirements: 13.1, 13.2, 13.3, 13.4_

  - [x] 16.2 Implement REST endpoints for session setup in `packages/server/src/routes/sessions.ts`
    - `POST /sessions` → `SessionService.createSession`; returns `{ sessionId, inviteCode }`
    - `POST /sessions/join` → `SessionService.joinSession`; returns `{ sessionId }`
    - _Requirements: 13.1, 13.2, 13.3, 13.4_

- [x] 17. Matchmaking service
  - [x] 17.1 Implement `MatchmakingService` in `packages/server/src/matchmakingService.ts`
    - `enqueue(playerId: PlayerId): QueueTicket` — adds player to `matchmaking_queue` table
    - `dequeue(playerId: PlayerId): void` — removes only the specified player; all other players remain
    - `tryPair(): Option<[PlayerId, PlayerId]>` — pairs the first two players in the queue, removes both, creates a new `Session`; called on a periodic interval
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

  - [x] 17.2 Implement REST endpoints for matchmaking in `packages/server/src/routes/matchmaking.ts`
    - `POST /matchmaking/enqueue` → `MatchmakingService.enqueue`; returns queue status
    - `DELETE /matchmaking/enqueue` → `MatchmakingService.dequeue`; returns to main menu state
    - _Requirements: 14.1, 14.3, 14.4_

  - [x] 17.3 Write property test — Property 22: Matchmaking dequeue removes only the specified player
    - **Property 22: For any queue with multiple players, dequeuing one player removes exactly that player and leaves all others unchanged**
    - **Validates: Requirements 14.4**
    - Tag comment: `// Feature: sea-battle-game, Property 22: Matchmaking dequeue removes only the specified player`

- [x] 18. Checkpoint — server infrastructure
  - Ensure all tests pass, ask the user if questions arise.

- [x] 19. WebSocket gateway and online game service
  - [x] 19.1 Implement WebSocket server in `packages/server/src/wsGateway.ts`
    - Accept connections at `wss://<host>/sessions/{sessionId}?token=<jwt>`; validate JWT on connect
    - On connect, replay current session state (`SessionRestored` event) so reconnecting clients restore their view
    - Handle client messages: `place_ship`, `fire_shot`, `ping`
    - Broadcast `GameEvent` union to both clients in the session: `PlacementAck`, `ShotResult`, `TurnChanged`, `MatchStarted`, `MatchEnded`, `OpponentDisconnected`, `OpponentReconnected`, `SessionRestored`
    - _Requirements: 13.5, 13.6, 13.7, 14.5, 14.7_

  - [x] 19.2 Implement `GameService` in `packages/server/src/gameService.ts`
    - Wire `PlacementEngine`, `ShotEngine`, `TurnManager`, and `VictoryDetector` (from `packages/domain`) as the authoritative server-side game logic
    - `handlePlacement(sessionId, playerId, placement)` — validate and record ship placement; emit `PlacementAck`; when both fleets ready emit `MatchStarted`
    - `handleShot(sessionId, playerId, coord)` — reject if not active player; process shot; emit `ShotResult` and `TurnChanged`; check victory and emit `MatchEnded` if won
    - Enforce turn order: reject shots from the non-active player with `ShotError.NotYourTurn`
    - _Requirements: 5.1, 5.3, 5.4, 6.1–6.5, 7.1–7.4, 8.1–8.4, 9.1–9.4, 13.5, 13.6, 13.7_

  - [x] 19.3 Write property test — Property 21: Turn order enforced — non-active player shots rejected
    - **Property 21: For any session in the shooting phase, a shot from the non-active player is rejected without changing board or turn state**
    - **Validates: Requirements 13.7**
    - Tag comment: `// Feature: sea-battle-game, Property 21: Turn order is enforced — non-active player shots are rejected`

- [x] 20. Disconnection handling and reconnection
  - In `wsGateway.ts`, on WebSocket `close` event: record disconnect timestamp in `session.disconnected` map; emit `OpponentDisconnected { timeout: 60 }` to the remaining client
  - Start a 60-second server-side timer; if the player reconnects within the timeout emit `OpponentReconnected` and resume; if not, emit `MatchEnded { winner: remainingPlayer }` and close the session
  - On reconnect within timeout: send `SessionRestored { boardA, boardB, turnState }` to the reconnecting client
  - _Requirements: 14.5, 14.6, 14.7_

- [x] 21. Checkpoint — WebSocket and online game
  - Ensure all tests pass, ask the user if questions arise.

- [x] 22. Client — project setup and NetworkManager
  - Initialize `packages/client` with Vite + React + TypeScript
  - Implement `NetworkManager` in `packages/client/src/networkManager.ts`
    - `connect(sessionId, token)` — opens WebSocket connection
    - `sendPlacement(placement)`, `sendShot(coord)`, `ping()`
    - `onEvent(handler)` — registers a callback for incoming `GameEvent` messages
    - `disconnect()`
  - Implement REST API client helpers for account and session endpoints
  - _Requirements: 13.1, 13.5, 13.6, 14.5, 14.7_

- [x] 23. Client — board rendering component
  - Implement `BoardGrid` React component in `packages/client/src/components/BoardGrid.tsx`
    - Render a 10×10 grid with column labels A–J and row labels 1–10
    - Accept `cells: Cell[]` and `ships?: Ship[]` props; color cells by status (Unshot, Miss, Hit, Sunk) and mark ship segments
    - Accept an `onCellClick?: (coord: Coordinate) => void` prop for the shooting phase
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 6.4, 8.4, 9.4_

- [x] 24. Client — placement phase UI
  - Implement `PlacementPhase` React component in `packages/client/src/components/PlacementPhase.tsx`
    - Allow the player to select ship type, orientation (horizontal/vertical), and click a cell to place the ship
    - Display placement errors returned by the server (or local `PlacementEngine` in local mode)
    - Show a "Ready" button that becomes active when all 10 ships are placed; clicking it marks the fleet as ready
    - In AI mode, provide an "Auto-place" button that calls `AIOpponent.placeFleet` and populates the board
    - _Requirements: 3.1–3.4, 4.1–4.4, 5.1, 5.2, 5.3, 12.2_

- [x] 25. Client — shooting phase UI
  - Implement `ShootingPhase` React component in `packages/client/src/components/ShootingPhase.tsx`
    - Display both boards: own board (ships visible, incoming shots shown) and opponent board (only shot results visible)
    - Highlight whose turn it is; disable opponent board clicks when it is not the local player's turn
    - Show shot result feedback (Miss / Hit / Sunk) after each shot
    - Auto-mark buffer-zone cells on Sunk using `autoMarked` from `ShotResult`
    - _Requirements: 6.1–6.5, 7.1–7.4, 8.1–8.4, 13.6, 13.7_

- [x] 26. Client — match result and main menu
  - Implement `MatchResult` React component in `packages/client/src/components/MatchResult.tsx`
    - Display the winner's name and a "Play again" / "Main menu" option
    - Handle disconnection result (opponent disconnected and timed out)
    - _Requirements: 9.4, 12.6, 14.5, 14.6_
  - Implement `MainMenu` React component with options: Local 2-player, vs AI, Online (Invite), Online (Matchmaking), and Account settings
  - Implement account registration, login, and profile-update forms
  - _Requirements: 12.1, 13.1, 14.1, 14.3, 14.4, 15.1, 15.2, 16.1, 17.1_

- [x] 27. Checkpoint — client UI
  - Ensure all tests pass, ask the user if questions arise.

- [x] 28. Integration tests
  - [x] 28.1 Write WebSocket session lifecycle integration test
    - Connect two clients, complete fleet placement, fire shots, disconnect one client, reconnect within timeout, verify state restored; then test reconnect after timeout and verify match ends
    - _Requirements: 13.5, 13.6, 14.5, 14.6, 14.7_

  - [x] 28.2 Write matchmaking queue integration test
    - Enqueue two players, verify they are paired into a session and removed from the queue
    - _Requirements: 14.1, 14.2_

  - [x] 28.3 Write account persistence integration test
    - Register, update display name and icon, change password, initiate email change, delete account; verify DB state after each operation and that deleted-account tokens are rejected
    - _Requirements: 15.1–15.11, 16.1–16.12, 17.1–17.7_

  - [x] 28.4 Write disconnection timeout integration test
    - Verify match ends and winner is declared after the configured 60-second timeout elapses without reconnection
    - _Requirements: 14.6_

- [x] 29. Final checkpoint — full system
  - Ensure all unit, property, and integration tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- All property tests must include the tag comment `// Feature: sea-battle-game, Property N: <property text>` and run a minimum of 100 iterations via fast-check
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at each architectural layer
- The domain package (`packages/domain`) has zero server or client dependencies and can be tested in isolation
- In online mode the server is the authoritative source of truth; the client never mutates game state directly
