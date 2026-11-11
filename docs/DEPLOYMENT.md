# Deployment and Operations

## Intended topology

The source supports one Node.js web service that can serve:
- Built React application (`client/dist` by default).
- REST API under `/api`.
- Socket.IO endpoint.
- Health endpoint `/health`.

This single-origin arrangement simplifies CORS and cookie configuration. Separate frontend/backend deployment is possible only when the client build points at the correct API origin and server CORS/cookie settings allow it.

## Production prerequisites

- Node.js version supported by package engines (`>=18.17`; use a current maintained LTS).
- MongoDB Atlas or managed MongoDB, with restricted network access.
- Strong `JWT_SECRET` of at least 32 characters.
- `NODE_ENV=production`.
- `MONGO_URI` explicitly set.
- `CLIENT_URL` set to the exact browser origin(s).
- Brevo API key and verified sender if email OTP is enabled.
- Redis if running multiple server instances.
- HTTPS for browser microphone capture.
- TURN service planning for reliable media across restrictive NAT/firewall networks.

## Render Blueprint notes

The repository includes `render.yaml` with:
- One Node web service.
- Build command `npm run build`.
- Start command `npm start`.
- Health check path `/health`.
- Environment variables for production, MongoDB, Redis and client origin.

**Important:** The checked-in Blueprint branch is `arena/0db06934-proxispeak-geospatial-proximit`. Verify/update this branch to the intended Git branch before deploying the Blueprint. Do not assume it points to `main` or `tarun`.

## Deployment checklist

1. Confirm the exact commit/branch to deploy.
2. Review `render.yaml` and service name/region/plan.
3. Set `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL`, `BREVO_*` and optional `REDIS_URL` in provider settings.
4. Ensure MongoDB network access permits the service.
5. Ensure production client URL matches the allowed CORS origin.
6. Run the build and deploy.
7. Inspect build and runtime logs.
8. Verify `/health` and `/api/health`.
9. Test registration, email verification, login, refresh and logout.
10. Test public and private room access.
11. Test two-browser microphone/WebRTC and spatial audio.
12. Test refresh inside a room and leave/rejoin lifecycle.

## Single instance and Redis

Without `REDIS_URL`, the server operates in single-instance mode. With Redis, the Redis bus and Socket.IO Redis adapter support cross-instance broadcasts. Multi-instance deployments must share MongoDB and Redis and use consistent auth/configuration values. Verify cross-instance room events and socket transport behavior.

## Health checks

```bash
curl -i https://<deployment-host>/health
curl -i https://<deployment-host>/api/health
curl -i https://<deployment-host>/api/stats
```

`/health` is the configured Render health check. `/api/health` gives more detailed service status; inspect the handler for the exact fields returned.

## Rollback

1. Identify the last known-good deployment/commit.
2. Use provider deployment history or a Git revert.
3. Avoid force-pushing shared branches as a production rollback strategy.
4. Check schema compatibility if database model changes were included.
5. Re-run health, authentication, room access and two-peer audio checks.
