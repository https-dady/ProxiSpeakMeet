# Configuration Reference

Configuration is centralized in `server/src/config/index.js`. It loads `server/.env` first, then repository-root `.env`. The client reads `client/.env` through Vite and only exposes `VITE_` variables to browser code.

## Root/server environment variables

| Variable | Default in source | Meaning / notes |
|---|---|---|
| `NODE_ENV` | `development` | Allowed: `development`, `test`, `production` |
| `PORT` | `4000` | HTTP + Socket.IO port; range 1–65535 |
| `HOST` | `0.0.0.0` | Bind host |
| `MONGO_URI` | local Mongo URI in development | Explicitly required in production |
| `MONGO_TIMEOUT_MS` | `8000` | Mongo server selection timeout; minimum 500 |
| `JWT_SECRET` | no fallback | Explicitly required in production; if supplied must be at least 32 chars |
| `JWT_EXPIRES_IN` | `24h` | Access-token expiry passed to JWT |
| `CLIENT_URL` | empty list | Comma-separated allowed browser origins |
| `CLIENT_DIST` | auto/default in app | Optional built-client directory |
| `REDIS_URL` | empty | Empty selects single-instance mode |
| `REDIS_PREFIX` | `proxispeak:` | Redis key prefix |
| `STUN_URL` | `stun:stun.l.google.com:19302` | ICE STUN server; no TURN variable in this snapshot |
| `INSTANCE_ID` | generated per process | Runtime instance identity |
| `LOG_LEVEL` | `info` | Allowed: `error`, `warn`, `info`, `debug` |

## Email/OTP variables

| Variable | Default | Meaning |
|---|---:|---|
| `BREVO_API_KEY` | empty | Brevo server-side API credential |
| `BREVO_SENDER_EMAIL` | empty | Verified sender address |
| `BREVO_SENDER_NAME` | `ProxiSpeak Meet` | Sender display name |
| `EMAIL_VERIFICATION_OTP_TTL_MINUTES` | `10` | Range 1–30 |
| `PASSWORD_RESET_OTP_TTL_MINUTES` | `10` | Range 1–30 |
| `OTP_RESEND_COOLDOWN_SECONDS` | `60` | Range 15–600 |

Email credentials must remain on the server. The app cannot send real email until Brevo API and sender settings are configured.

## World and spatial variables

| Variable | Default | Meaning |
|---|---:|---|
| `WORLD_WIDTH` | `1920` | World width in pixels; minimum 200 |
| `WORLD_HEIGHT` | `1080` | World height in pixels; minimum 200 |
| `WORLD_CENTER_LAT` | `37.7749` | Geographic projection center latitude |
| `WORLD_CENTER_LON` | `-122.4194` | Geographic projection center longitude |
| `PIXELS_PER_METER` | `10` | Pixel/metre scale |
| `EARSHT_RADIUS_PX` | `100` | Earshot radius; spelling is intentional in current source |
| `CLUSTER_GAP_PX` | `100` | Proximity cluster gap |
| `MAX_SPEED_PX_PER_SEC` | `900` | Server movement speed bound |
| `SPATIAL_QUERY_MODE` | `hybrid` | Allowed: `hybrid`, `mongo` |
| `SPATIAL_AUDIT_BUDGET_MS` | `20` | Spatial audit latency budget |
| `CLUSTER_REFRESH_MS` | `2000` | Cluster refresh interval; minimum 100 |
| `PRESENCE_FLUSH_MS` | `500` | Presence persistence interval; minimum 50 |

## Presence and event limits

| Variable | Default | Meaning |
|---|---:|---|
| `POSITION_THROTTLE_MS` | `100` | Position update throttle; minimum 16 |
| `HEARTBEAT_INTERVAL_MS` | `10000` | Presence heartbeat; minimum 1000 |
| `PEER_STALE_MS` | `30000` | Stale peer threshold; minimum 2000 |
| `PEER_SWEEP_MS` | `5000` | Stale peer sweep interval; minimum 500 |
| `PEER_RECONCILE_MS` | `500` | Peer graph reconciliation interval; minimum 50 |
| `LIMIT_POSITION_EPS` | `30` | Position events/sec limit |
| `LIMIT_SIGNAL_EPS` | `60` | Signaling events/sec limit |
| `LIMIT_AUDIT_SAMPLES` | `25` | Audit sample limit; range 1–200 |
| `LIMIT_USERS_PER_ROOM` | `200` | Room capacity; minimum 2 |

## Client variables

| Variable | Example/default | Meaning |
|---|---|---|
| `VITE_SERVER_URL` | `http://localhost:4000` | API and Socket.IO backend origin |
| `VITE_DEFAULT_ROOM` | `lobby` | Default room fallback |

The client source also contains a production fallback URL. Set `VITE_SERVER_URL` deliberately at build time when deploying a separate frontend/backend topology.

## Local example

Root `.env`:

```dotenv
NODE_ENV=development
PORT=4000
HOST=0.0.0.0
MONGO_URI=mongodb://127.0.0.1:27017/proxispeak
JWT_SECRET=replace-with-a-random-secret-at-least-32-characters
CLIENT_URL=http://localhost:5173
REDIS_URL=redis://127.0.0.1:6379
STUN_URL=stun:stun.l.google.com:19302
BREVO_API_KEY=
BREVO_SENDER_EMAIL=
BREVO_SENDER_NAME=ProxiSpeak Meet
```

`client/.env`:

```dotenv
VITE_SERVER_URL=http://localhost:4000
```

Never use the sample JWT secret in production. Never put database passwords, JWT secrets, Brevo keys or tokens in `client/.env`.
