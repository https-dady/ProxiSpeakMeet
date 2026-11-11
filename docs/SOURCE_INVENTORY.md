# Source Inventory

This inventory maps the actual files present in the uploaded ZIP. It is intended to help a developer find the implementation before editing.

## Client

### App and configuration
- `client/src/main.jsx` — client entry point.
- `client/src/App.jsx` — application shell, auth routes, session boundary, dashboard and office rendering.
- `client/src/config.js` — server URL, default room, movement/network/audio/UI defaults.
- `client/vite.config.js` — Vite and Tailwind integration.
- `client/index.html` — browser document.

### Components
- `components/Login.jsx`, `Signup.jsx`, `VerifyEmail.jsx`, `ForgotPassword.jsx`, `ResetPassword.jsx`, `Auth.jsx` — account screens.
- `components/Dashboard.jsx` — dashboard orchestration.
- `components/dashboard/DashboardLayout.jsx` — dashboard shell.
- `DashboardSidebar.jsx`, `DashboardMobileNav.jsx`, `DashboardTopbar.jsx` — navigation.
- `DashboardHero.jsx`, `DashboardStats.jsx`, `DashboardActions.jsx` — dashboard overview/actions.
- `DashboardRooms.jsx` — room discovery.
- `DashboardHistory.jsx` — meeting history.
- `DashboardProfile.jsx`, `DashboardSettings.jsx` — profile and preferences.
- `components/CreateMeetingModal.jsx` — create-room/meeting UI.
- `components/MicGate.jsx` — join/profile/microphone gate and room catalogue entry.
- `components/OfficeEntry.jsx` — invite URL office entry flow.
- `components/OfficeLayout.jsx`, `OfficeSidebar.jsx` — office layout/navigation.
- `components/PeerList.jsx` — nearby participant list.
- `components/StatusBar.jsx` — live status and leave control.
- `components/AuditPanel.jsx` — spatial audit controls/results.
- `components/OfficeBlueprintImport.jsx` — blueprint import UI.
- `components/RoomManager.jsx` — room catalogue/create/join management surface.
- `components/Notices.jsx` — notifications.
- `components/SoundLegend.jsx` — spatial audio legend.

### Client engines and hooks
- `state/ProxiContext.jsx` — central live-room state and orchestration.
- `socket/socketClient.js` — Socket.IO client wrapper.
- `webrtc/PeerManager.js` — peer connection/signaling lifecycle.
- `audio/SpatialAudioEngine.js` — Web Audio spatial engine.
- `audio/spatialMath.js` — distance/gain/pan math.
- `audio/occlusion.js` — wall/obstacle attenuation.
- `canvas/WorldCanvas.jsx` — interactive office canvas.
- `canvas/draw.js` — world drawing.
- `canvas/officeLayout.js` — office geometry/layout.
- `canvas/physics.js` — movement/collision logic.
- `hooks/useAnimationFrame.js` — animation loop.
- `hooks/useAuthSession.js` — auth session lifecycle.
- `hooks/useKeyboardMovement.js` — keyboard controls.
- `hooks/usePointerToWorld.js` — pointer-to-world mapping.
- `hooks/useUiTick.js` — periodic UI refresh.
- `services/officeBlueprintApi.js` — blueprint API client.
- `utils/meetingSessionStorage.js` — validated active meeting intent storage.
- `styles.css`, `styles/brand-compat.css`, `styles/motion.css`, `styles/responsive-overrides.css`, `tailwind.css` — visual system and responsive styling.

## Server

### Runtime and configuration
- `server/src/index.js` — startup/shutdown orchestration.
- `server/src/app.js` — Express app and route mounting.
- `server/src/config/index.js` — env loading/validation.
- `server/src/runtime.js` — background presence/peer/cluster jobs.
- `server/src/db/mongo.js` — Mongo connection/indexes.
- `server/src/db/redis.js` — Redis bus/adapter.

### Routes and middleware
- `middleware/auth.js` — JWT HTTP authentication.
- `middleware/authorizeRoomAccess.js` — room access authorization.
- `routes/auth.js` — registration, email verification, login, password reset and current user.
- `routes/authSession.js` — refresh-session start/refresh/logout.
- `routes/meetingHistory.js` — meeting history endpoint.
- `routes/room.js` — room listing/read routes.
- `routes/roomCreation.js` — room creation.
- `routes/roomAccess.js` — private-room invite/revoke.
- `sockets/authentication.js` — Socket.IO auth middleware.
- `sockets/index.js` — room/presence/media/signaling event handlers.
- `sockets/membership.js`, `roomAuthorization.js`, `signalingAuthorization.js`, `roomRevocation.js`, `validation.js` — socket access, validation and revocation helpers.

### Services and models
- `services/index.js` — service composition.
- `services/roomService.js` — room persistence/cache/geometry access.
- `services/presenceStore.js` — in-memory presence and persistence.
- `services/geospatialService.js` — geospatial queries and coordinate mapping.
- `services/peerGraph.js` — proximity peer-edge lifecycle.
- `services/obstacleService.js` — obstacle/occlusion geometry.
- `services/auditService.js` — spatial query audit.
- `services/meetingHistoryService.js` — meeting lifecycle/history.
- `services/authSessionService.js` — refresh session lifecycle.
- `services/emailService.js` — Brevo email delivery.
- `services/officeBlueprintController.js`, `officeBlueprintImportService.js`, `officeBlueprintService.js` — blueprint import/validation.
- `models/User.js`, `AuthSession.js`, `Room.js`, `UserPresence.js`, `MeetingHistory.js`, `SpatialAudit.js` — MongoDB schemas.

### Scripts and tests
- `server/scripts/seed.js` — seed data.
- `server/scripts/spatial-audit.js` — audit CLI.
- `server/scripts/loadtest.js` — load generator.
- `server/test/*.test.js` — geometry, HTTP, obstacles, peer graph, rooms, signaling, socket membership/integration and validation tests.
- `client/test/spatialAudio.test.js` — spatial audio tests.

## Areas to inspect before making changes

- Authentication/session behavior: `useAuthSession.js`, `App.jsx`, `auth.js`, `authSession.js`, `authSessionService.js`.
- Room authorization: `authorizeRoomAccess.js`, `room.js`, `roomCreation.js`, `roomAccess.js`, `roomAuthorization.js`, `membership.js`.
- Refresh/rejoin: `App.jsx`, `ProxiContext.jsx`, `meetingSessionStorage.js`, socket authentication and join handlers.
- Microphone/mute: `ProxiContext.jsx`, `PeerManager.js`, `SpatialAudioEngine.js`, `PeerList.jsx`, `StatusBar.jsx`.
- Through-wall/spatial audio: `occlusion.js`, `spatialMath.js`, `SpatialAudioEngine.js`, `obstacleService.js`, `peerGraph.js`, `geospatialService.js`.
- Office blueprint: `officeBlueprintApi.js`, `OfficeBlueprintImport.jsx`, blueprint server services and room model validation.
