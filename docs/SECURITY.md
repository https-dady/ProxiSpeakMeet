# Security and Privacy

## Authentication

- Access JWTs are signed with the configured `JWT_SECRET`.
- Production requires an explicit secret; configured secrets must be at least 32 characters.
- User passwords are hashed with bcryptjs (cost factor 12).
- Refresh sessions are persisted as token hashes, rotated on refresh and revocable on logout.
- Refresh token is delivered through an HttpOnly cookie named `proxispeak_refresh`.
- Do not expose refresh-token values to browser JavaScript.

## Email OTP

- Email verification and password reset use OTP hashes and expiry timestamps.
- OTP TTL and resend cooldown are configurable.
- Brevo API key and sender credentials belong only in server environment configuration.
- Do not log OTP values or include them in screenshots/issues.

## Room authorization

- Room creation requires an authenticated account.
- Private rooms require an owner.
- Invitees must be verified accounts.
- Only the private-room owner can add/remove invitees.
- Revocation persists access change before active socket termination.
- A room ID/invite URL is not a substitute for server authorization.

## Socket.IO and signaling

- Socket authentication middleware is installed before connection handlers.
- Room membership is checked for room-scoped operations.
- Payloads are validated and rate-limited.
- WebRTC signaling is authorized against active peer edges.
- Never trust client-provided peer IDs, room membership or avatar coordinates without server validation.

## Secrets

Never commit:
- Root/server/client `.env` files containing credentials.
- MongoDB or Redis connection strings with passwords.
- `JWT_SECRET`.
- Brevo API keys.
- Access/refresh tokens, cookies or OTPs.
- Production database exports.

Only `VITE_` values are intended for the browser bundle; never place secrets in them.

## Microphone privacy

- Request microphone permission in response to a clear user action.
- Display accurate muted/listen-only/permission-denied status.
- Stop local media tracks when leaving the meeting or disposing the media provider.
- Do not store microphone streams or claim permission is preserved across reload.
- A browser capture indicator may be active while the track exists even if app mute is enabled.

## Pre-release security checklist

- [ ] JWT secret and cookie settings are correct for production.
- [ ] Refresh token rotation and revocation are tested.
- [ ] OTP expiry and resend throttling are tested.
- [ ] Private-room access checks are server-side.
- [ ] Socket membership and signaling authorization are tested.
- [ ] CORS origins are explicit.
- [ ] Rate limits and payload validation are active.
- [ ] No secrets are in Git history or client build output.
- [ ] Microphone permission and mute state are accurate.
- [ ] Data retention and account deletion policies are documented for production.
