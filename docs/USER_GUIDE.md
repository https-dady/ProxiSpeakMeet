# User Guide

## 1. Register an account

1. Open the ProxiSpeakMeet application.
2. Select **Sign up**.
3. Enter a username, email address and password.
4. Submit registration.
5. Retrieve the email verification code from the registered inbox.
6. Open the verification screen and complete email verification.
7. Return to Login if the application does not automatically establish the session.

The User model requires a username (3–50 characters), a valid unique email and a password of at least 8 characters. Passwords are hashed on the server using bcryptjs.

## 2. Sign in and session persistence

1. Open **Login**.
2. Enter the account credentials.
3. The app establishes an authenticated session.
4. On later page loads, the client attempts to restore the session using the refresh-session endpoint.
5. If the refresh session is expired, revoked or unavailable, sign in again.

The access token is used in authenticated API requests. The refresh token is stored by the server in an HttpOnly cookie and rotated by the refresh endpoint; browser JavaScript should not read that cookie.

## 3. Dashboard

After authentication, the application renders the dashboard. The dashboard source loads:
- Current account/profile information from `/api/auth/me`.
- Accessible room catalogue from `/api/rooms`.
- Meeting history from `/api/meetings/history`.

The dashboard includes room discovery, create-meeting flow, meeting history, profile/settings components and actions for entering a room. The exact visible sections can depend on responsive layout and account/server data.

## 4. Create a meeting / room

1. From the dashboard, open the create-meeting flow.
2. Enter the room name and optional description.
3. Choose public or private visibility.
4. For a private room, provide verified account user IDs in the allowed-user input.
5. Submit the form.
6. The server generates the room ID and returns the created room.
7. The UI can proceed to the office using that room ID.

Server-side constraints:
- Room name is validated up to 100 characters by the create route; the Room model field itself has an 80-character maximum. Keep names at 80 characters or fewer to satisfy both layers.
- Description is limited to 500 characters.
- Visibility must be `public` or `private`.
- At most 100 allowed user IDs can be supplied.
- Invitees must exist and have verified email.
- Public rooms cannot have a private allowed-user list.
- Private rooms require an owner.

## 5. Join a room

The source supports room discovery and free-text room IDs in the join experience.

1. Choose a room from the room catalogue or enter a room ID.
2. Confirm the display name.
3. Choose avatar shape and avatar colour.
4. Choose whether to request microphone access.
5. Join the room.
6. If the room is private, the server checks the authenticated account's room access; a valid room ID alone is not sufficient.

Room IDs are normalized to lowercase and validated against the pattern: first character alphanumeric, followed by up to 47 letters, digits, underscores or hyphens.

## 6. Invite someone

Inside the virtual office, use **Copy Invite**. The app creates a URL with the current room ID in the `room` query parameter. Send that link to the intended participant.

An invite link identifies a room; it is not a bypass for private-room authorization. Private-room access still requires the account to be the owner or an allowed invitee.

## 7. Navigate the virtual office

The office contains:
- A 2D floor/world canvas.
- An avatar representing the current participant.
- Other participant avatars.
- Furniture/obstacles and named office areas.
- A people/nearby panel.
- Connection/audio status.
- Room information and invite action.
- Spatial audit panel.
- Office Floor, People, Audio and Settings navigation.

Movement supports keyboard controls and click-to-move behavior through the canvas/hooks. The server validates submitted position updates and the client renders the world.

## 8. Audio and microphone

- The browser must grant microphone permission before the app can capture audio.
- Use the microphone control to mute/unmute.
- Use the master-volume slider to adjust local playback.
- The audio engine applies distance attenuation, stereo direction and obstacle/occlusion effects.
- If the user joins without microphone access, they can be listen-only if the join flow permits it.

A page refresh destroys the old browser `MediaStream`. The app cannot silently reuse a microphone stream from before refresh; a new permission/user action may be required. A WebRTC connection status does not prove that the microphone is transmitting.

## 9. Nearby people

The peer list displays room participants and connection/spatial information. Participants can be present in the room but outside the active peer-connection radius. A participant being listed does not guarantee they are currently audible.

## 10. Meeting history

Meeting history is account-specific. The server returns paginated records with room name/ID, role, status, start/end timestamps, duration and participant count at join. Supported statuses are `active`, `completed` and `abandoned`.

## 11. Leave the office

Use **Leave meeting** in the office status bar. The app should send the room-leave event, close relevant peer connections, clear room UI state and return to the authenticated dashboard.

## 12. Privacy and good practice

- Grant microphone permission only when you intend to use voice.
- Use mute when you do not want to transmit.
- Remember that browser/OS microphone indicators can remain active while a capture track exists, even if the app has muted the track.
- Do not share passwords, OTPs, access tokens or refresh cookies.
- Do not assume a room invite link grants access to a private room.
