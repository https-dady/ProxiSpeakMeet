# HTTP API Reference

## Conventions

- Local API base: `http://localhost:4000`.
- Production base: the configured backend origin.
- Protected routes require `Authorization: Bearer <access-token>`.
- JSON request body limit in Express is 64 KB.
- Error responses commonly include `{ "ok": false, "error": "..." }`; some auth/session handlers return a slightly different shape. Clients should handle non-2xx responses and not assume every route has identical envelopes.

## Authentication — `/api/auth`

| Method | Path | Authentication | Purpose |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Register account and initiate email verification |
| `POST` | `/api/auth/verify-email` | Public | Verify email using OTP |
| `POST` | `/api/auth/resend-verification` | Public | Resend verification OTP subject to cooldown |
| `POST` | `/api/auth/login` | Public | Authenticate credentials and issue access token |
| `GET` | `/api/auth/me` | Access JWT | Return current authenticated user |
| `POST` | `/api/auth/forgot-password` | Public | Start password reset |
| `POST` | `/api/auth/verify-reset-otp` | Public | Verify password reset OTP |
| `POST` | `/api/auth/reset-password` | Public | Complete password reset |

Registration body fields observed from the auth implementation: `username`, `email`, `password`. The user schema requires username 3–50 characters, valid unique email and password minimum 8 characters. OTPs are six digits and expiry/cooldown are environment-configurable. Consult `server/src/routes/auth.js` for exact per-handler response shapes and validation messages.

## Refresh sessions — `/api/auth/session`

| Method | Path | Authentication | Purpose |
|---|---|---|---|
| `POST` | `/api/auth/session/start` | Access JWT | Create persistent refresh session and set HttpOnly refresh cookie |
| `POST` | `/api/auth/session/refresh` | Refresh cookie | Rotate refresh token and issue a new access JWT |
| `POST` | `/api/auth/session/logout` | Refresh cookie if present | Revoke refresh session and clear cookie |

The cookie name in the current route implementation is `proxispeak_refresh`; cookie path is `/api/auth/session`. Cookie attributes vary between development and production. The refresh token is not intended to be read by browser JavaScript.

## Rooms

The room catalogue route is mounted from `server/src/app.js` and the room creation router. The room list handler is defined in `server/src/routes/room.js` and mounted as part of the room API.

| Method | Path | Authentication | Purpose |
|---|---|---|---|
| `GET` | `/api/rooms` | Access JWT | List rooms accessible to the account, with live user counts |
| `POST` | `/api/rooms` | Access JWT | Create an owned public/private room |
| `POST` | `/api/rooms/access/:roomId/members/:userId` | Access JWT; private-room owner | Invite a verified account |
| `DELETE` | `/api/rooms/access/:roomId/members/:userId` | Access JWT; private-room owner | Revoke access and disconnect active room sessions |

Create-room request fields:

```json
{
  "name": "Design Team",
  "description": "Private team workspace",
  "visibility": "private",
  "allowedUsers": ["<verified MongoDB user ObjectId>"]
}
```

`visibility` defaults to `public`. Public rooms cannot include `allowedUsers`. Private rooms require an owner. Invitees must be verified accounts. The maximum allowed-user list size is 100. The route accepts names up to 100 characters but the Mongoose Room model caps the name at 80; use 80 or fewer characters.

Room access invite/revoke paths are relative to `/api/rooms/access`, yielding the full paths shown above.

## Meeting history

| Method | Path | Authentication | Purpose |
|---|---|---|---|
| `GET` | `/api/meetings/history` | Access JWT | Return current user's meeting history |

Query parameters:
- `page`: positive integer, default `1`.
- `limit`: positive integer, default `20`, capped at `100`.
- `status`: optional `active`, `completed` or `abandoned`.

Response data includes `meetings` and pagination metadata (`page`, `limit`, `total`, `totalPages`, `hasNextPage`, `hasPreviousPage`).

## Office blueprint

The app mounts office blueprint import functionality under the room API. The client service is `client/src/services/officeBlueprintApi.js`; server-side implementation is in `server/src/services/officeBlueprintController.js`, `officeBlueprintImportService.js` and `officeBlueprintService.js`. Verify the exact import route, body schema and response from `server/src/app.js` and controller before building an external integration; do not assume a blueprint JSON schema from the UI.

## Health, stats and spatial audit

| Method | Path | Authentication | Purpose |
|---|---|---|---|
| `GET` | `/health` | Public | Basic liveness |
| `GET` | `/api/health` | Public | Detailed health and infrastructure status |
| `GET` | `/api/stats` | Public | Runtime/room/presence/peer statistics |
| `GET` | `/api/spatial-audit` | Route-specific | Run spatial audit |
| `POST` | `/api/spatial-audit` | Route-specific | Run spatial audit |
| `GET` | `/api/spatial-audit/history` | Public in current mount | Read stored audit history |

Audit query/body parameters are implemented in `server/src/app.js`. The CLI counterpart is `server/scripts/spatial-audit.js`. Use the route handler as the exact schema source before writing a third-party client.

## HTTP error handling

Handle at least:
- `400`: invalid input.
- `401`: missing/invalid authentication or refresh session.
- `403`: authenticated but forbidden.
- `404`: resource unavailable/not found (private-room access may be deliberately hidden).
- `429`: rate limit.
- `5xx`: server/infrastructure failure.

## Contract maintenance

This reference is a source-derived route index. It is not a generated OpenAPI schema. When request/response fields change, update route tests and this document together.
