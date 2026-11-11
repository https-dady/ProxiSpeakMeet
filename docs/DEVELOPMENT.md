# Developer Setup

## Prerequisites

- Node.js `>=18.17`.
- npm.
- MongoDB (local or Atlas).
- Redis for multi-instance Pub/Sub; optional for single-instance local development.
- Docker Desktop (recommended for local MongoDB/Redis).
- Modern browser with WebRTC, Web Audio and microphone support.

## Install

```bash
git clone <repository-url>
cd ProxiSpeakMeet

# Install root package dependencies if present, then child packages:
npm run install:all
```

The root `install:all` script installs server and client dependencies. The root `build` script also installs child dependencies before running the Vite build.

## Configure

```bash
cp .env.example .env
cp client/.env.example client/.env
```

Set the required values. `server/src/config/index.js` loads `server/.env` first and then root `.env`. The Vite client reads `client/.env`.

Do not commit real `.env` files.

## Start local infrastructure

```bash
docker compose up -d
```

Inspect `docker-compose.yml` for the exact local MongoDB and Redis services/ports. If using Atlas/managed Redis, configure the connection strings instead.

## Development mode

Terminal 1:

```bash
npm run dev:server
```

Terminal 2:

```bash
npm run dev:client
```

Open `http://localhost:5173`; the server defaults to port `4000`.

## Production-style single service

```bash
npm run build
npm start
```

The Express service serves the built client (default `client/dist`) alongside API and Socket.IO from the configured port.

## Root scripts

| Script | What it does |
|---|---|
| `npm run build` | Installs server/client packages and runs client Vite build |
| `npm start` | Starts `server/src/index.js` |
| `npm run install:all` | Installs server and client packages |
| `npm run dev:server` | Runs server's nodemon dev script |
| `npm run dev:client` | Starts Vite |
| `npm run seed` | Runs server seed script |
| `npm run audit` | Runs server spatial audit CLI |
| `npm run loadtest` | Runs server load test |
| `npm test` | Runs server tests, then client tests |

Server package also exposes `build`, `start`, `dev`, `seed`, `audit`, `audit:api`, `loadtest`, `test`. Client package exposes `dev`, `build`, `preview`, `test`.

## Two-browser end-to-end smoke test

1. Start backend, frontend, MongoDB and (if needed) Redis.
2. Open two browser profiles/windows.
3. Register/verify/login two accounts.
4. Join the same public room, or invite both accounts to a private room.
5. Grant microphone access in each browser.
6. Confirm Socket.IO connection and presence roster.
7. Move avatars within earshot and verify peer negotiation/WebRTC.
8. Speak and verify remote audio.
9. Move apart and verify gain fall-off/peer graph changes.
10. Move behind an obstacle and verify occlusion.
11. Mute/unmute and verify the remote participant media badge.
12. Refresh while inside the room and verify room restoration; request microphone again if needed.
13. Leave and verify the other participant receives the leave update.

Use headphones. Two tabs on one machine can share the same physical microphone and may cause feedback; separate devices are preferable for realistic testing.

## Development rules

- Source is JavaScript/JSX (ES modules); do not introduce TypeScript without an explicit decision.
- Preserve REST and Socket.IO contracts.
- Keep authorization on the server.
- Test both room access and the actual media track; a UI badge alone is insufficient.
- Keep secrets out of Vite-exposed variables and source control.
- Add regression tests for session restoration, room rehydration, microphone state, peer graph and spatial audio changes.
