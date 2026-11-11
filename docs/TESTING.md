# Testing and Release Acceptance

## Commands

From repository root:

```bash
npm test
npm run build
npm run seed
npm run audit
npm run loadtest
```

Server package commands:
```bash
npm --prefix server test
npm --prefix server run build
npm --prefix server run seed
npm --prefix server run audit
npm --prefix server run audit:api
npm --prefix server run loadtest
```

Client package commands:
```bash
npm --prefix client test
npm --prefix client run build
npm --prefix client run preview
```

`npm test` runs server tests first and client tests second. `npm run build` installs server/client dependencies and runs the Vite production build.

## Test files present in this archive

### Client
- `client/test/spatialAudio.test.js`

### Server
- `server/test/geo.test.js`
- `server/test/http.integration.test.js`
- `server/test/obstacles.test.js`
- `server/test/peerGraph.test.js`
- `server/test/rooms.integration.test.js`
- `server/test/signal-authorization.test.js`
- `server/test/socket-membership.test.js`
- `server/test/socket.integration.test.js`
- `server/test/validation.test.js`

The existence of these test files is not evidence that they pass. Run them against the exact commit and retain the output in the release record.

## Acceptance checklist

### Account/session
- [ ] Registration validates username, email and password.
- [ ] Unverified accounts cannot use protected app functionality.
- [ ] Email verification OTP expires and resend cooldown works.
- [ ] Login rejects incorrect credentials.
- [ ] `/api/auth/me` returns the authenticated user.
- [ ] Dashboard refresh restores a valid session using refresh cookie rotation.
- [ ] Logout revokes refresh session and clears cookie.

### Rooms and access
- [ ] Room catalogue only returns rooms accessible to the account.
- [ ] Public room can be joined by authenticated eligible users.
- [ ] Private room is visible/joinable only by owner/invitees.
- [ ] Non-owner cannot invite or revoke members.
- [ ] Revoking an invitee terminates their active room connection.
- [ ] Invalid room ID and invalid geometry are rejected.
- [ ] Invite URL identifies room but does not bypass private access checks.

### Presence and movement
- [ ] Join acknowledgement includes self, room, peers and runtime config.
- [ ] Presence snapshots reconcile correctly after reconnect.
- [ ] Position updates remain within room bounds.
- [ ] Movement speed and event-rate limits are enforced.
- [ ] Stale sessions are swept.
- [ ] Room leave removes participant from presence and peer graph.

### Microphone and WebRTC
- [ ] Browser microphone permission is requested only from a user action.
- [ ] Denied/unavailable microphone produces accurate UI state.
- [ ] Microphone-ready state requires a live audio track.
- [ ] Mute disables local track and updates remote media state.
- [ ] Unmute obtains/uses a live track and updates remote media state.
- [ ] WebRTC negotiation succeeds for peers within the proximity graph.
- [ ] Actual audio is audible, not merely marked connected.
- [ ] Leaving range/room closes audio and peer resources.
- [ ] Full refresh restores room membership only if the app/session path supports it; microphone must be reacquired after refresh.

### Spatial audio
- [ ] Near peers are louder than far peers.
- [ ] Gain approaches silence at configured earshot boundary.
- [ ] Direction maps to stereo pan.
- [ ] Obstacles attenuate/muffle sound as designed.
- [ ] No audio remains after peer/room teardown.

### Operations
- [ ] `/health` and `/api/health` behave correctly.
- [ ] MongoDB geospatial indexes are present.
- [ ] Redis multi-instance mode is tested if enabled.
- [ ] Spatial audit persists and reports latency.
- [ ] Load test results meet the team's defined thresholds.
- [ ] Shutdown closes sockets, flushes presence and closes DB/Redis.

## Release evidence

For each release, record commit SHA, Node/npm versions, test command output, build output, environment names (not secret values), deployment URL and manual two-browser test results.
