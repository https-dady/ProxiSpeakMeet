# Troubleshooting

## Server fails to start

- Confirm Node version is at least 18.17.
- Run `npm run install:all`.
- Check the first stack trace for the missing package/module.
- Confirm `PORT` is not already occupied.
- Confirm MongoDB is reachable and `MONGO_URI` is valid.
- In production, ensure `JWT_SECRET` exists and has at least 32 characters.

PowerShell port inspection:
```powershell
Get-NetTCPConnection -LocalPort 4000 -State Listen
Get-Process -Id <PID>
```
Inspect the process before stopping it; do not kill all Node processes indiscriminately.

## MongoDB unavailable

- Check URI, DNS, credentials and URL encoding.
- Check Atlas network access allow-list.
- Check database user permissions.
- Confirm the app can create required indexes, including the presence `2dsphere` index.
- Inspect Mongo server-selection timeout logs.

## Redis unavailable

Redis is optional for single-instance mode. If Redis is unavailable, multi-instance Pub/Sub and cross-instance Socket.IO broadcast behavior will not be available. Verify `REDIS_URL`, TLS scheme (`redis://`/`rediss://`), credentials and network access.

## Client cannot reach API/socket

- Check `VITE_SERVER_URL` in `client/.env`.
- Restart Vite after changing client environment values.
- Confirm server port and `CLIENT_URL`.
- Inspect DevTools Network for failed HTTP requests and Socket.IO handshake.
- For production, verify the deployed bundle was built with the intended backend URL.

## Login/session refresh fails

- Confirm login returns an access token.
- Confirm the session-start endpoint is called after login where required.
- Confirm browser stores the refresh cookie (HttpOnly; inspect cookie metadata, not its value).
- Confirm cookie path `/api/auth/session`, Secure/SameSite settings and origin.
- Confirm browser requests include credentials where needed.
- Confirm server `JWT_SECRET` is stable across instances.
- Check whether refresh token has expired/revoked.

## Microphone pending or muted unexpectedly

1. Use HTTPS or `localhost`; microphone capture is blocked on insecure origins.
2. Check browser site permission and operating-system microphone privacy settings.
3. Confirm a microphone device exists and is not busy.
4. Trigger microphone access through the app's user-facing microphone action.
5. Inspect `getUserMedia()` errors: `NotAllowedError`, `NotFoundError`, `NotReadableError`.
6. Confirm a live track exists and `track.enabled` matches intended mute state.
7. Confirm the outgoing WebRTC sender has the expected audio track.
8. Confirm `peer:media-ready` reaches the server.
9. Confirm remote participants receive `peer:media-state`.
10. Confirm the remote audio track is attached to the spatial audio engine.

Do not hide a MUTED badge as a cosmetic fix. Compare local UI state, local track, outgoing sender, socket event, server state and remote roster state to locate the first mismatch.

## WebRTC connected but no sound

- Verify both participants granted microphone permission.
- Verify neither side is muted.
- Check browser output device and system volume.
- Check Web Audio context initialization/resume after a user gesture.
- Check remote `track` event and audio engine attachment.
- Check that peers are within earshot and obstruction factor is not near zero.
- Test across separate networks. This archive configures STUN but no TURN; restrictive NAT/firewall can prevent direct media.

## Room refresh or rejoin problems

- Verify the URL contains the intended `?room=<roomId>`.
- Verify auth session restoration finishes before joining.
- Verify socket authentication and room authorization succeed.
- Check whether active meeting intent uses the current Context implementation or `meetingSessionStorage.js`.
- Ensure reconnect does not create duplicate presence entries.
- Re-request microphone after full refresh; a `MediaStream` cannot be persisted/reused across page reload.

## Spatial sound / through-wall issue

- Verify server room dimensions and client canvas dimensions match.
- Verify obstacle geometry is within room bounds.
- Inspect line-of-sight and obstruction factor.
- Confirm the same room geometry is used by server and client.
- Check `peer:audio-obstruction` updates and local audio gain/filter updates.

## Git branch confusion

```bash
git status --short --branch
git branch --show-current
git fetch origin
git log --oneline --decorate -10
git diff --stat origin/main...origin/tarun
```

Do not use `git reset --hard` until the target commit is known and current work is backed up. Prefer `git revert` for undoing commits already shared with others.
