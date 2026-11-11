/**
 * Application state container.
 *
 * worldRef stores frequently changing spatial data without forcing React
 * renders. React state stores the room, connection, roster and UI status.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';

import config from '../config.js';
import { createSocketClient } from '../socket/socketClient.js';
import { SpatialAudioEngine } from '../audio/SpatialAudioEngine.js';
import { PeerManager } from '../webrtc/PeerManager.js';
import { soundFactorBetween } from '../audio/occlusion.js';

const ProxiContext = createContext(null);

const MEETING_INTENT_STORAGE_KEY = 'proxispeak:meeting-session';
const ROOM_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,47}$/;

function readPersistedMeetingIntent() {
  try {
    const raw = localStorage.getItem(MEETING_INTENT_STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const intent = JSON.parse(raw);

    const roomId = String(
      intent?.roomId ?? '',
    )
      .trim()
      .toLowerCase();

    const name = String(
      intent?.name ?? '',
    ).trim();

    const invitedRoom = String(
      new URLSearchParams(
        window.location.search,
      ).get('room') ?? '',
    )
      .trim()
      .toLowerCase();

    /*
     * Restore only when the saved meeting matches the room
     * currently requested by the URL.
     *
     * This prevents an old meeting from reopening when the
     * user visits the dashboard or another unrelated route.
     */
    if (
      !ROOM_ID_PATTERN.test(roomId) ||
      !name ||
      !ROOM_ID_PATTERN.test(invitedRoom) ||
      invitedRoom !== roomId
    ) {
      return null;
    }

    return {
      roomId,
      name: name.slice(0, 24),
      color:
        typeof intent.color === 'string'
          ? intent.color
          : '#4f8cff',
      avatar: [
        'circle',
        'square',
        'triangle',
        'hex',
      ].includes(intent.avatar)
        ? intent.avatar
        : 'circle',
    };
  } catch {
    return null;
  }
}

function persistMeetingIntent(intent) {
  try {
    localStorage.setItem(
      MEETING_INTENT_STORAGE_KEY,
      JSON.stringify({
        roomId: intent.roomId,
        name: intent.name,
        color: intent.color,
        avatar: intent.avatar,
        savedAt: Date.now(),
      }),
    );
  } catch {
    /*
     * Storage can be unavailable in private browsing.
     * The live meeting should still work in that case.
     */
  }
}

function clearPersistedMeetingIntent() {
  try {
    localStorage.removeItem(
      MEETING_INTENT_STORAGE_KEY,
    );
  } catch {
    /*
     * Leaving the live room must still work even if
     * browser storage cleanup fails.
     */
  }
}

const initialState = {
  status: 'idle',
  statusDetail: '',
  session: null,
  room: null,
  selfId: null,
  roster: [],
  clusters: [],
  mic: {
    state: 'idle',
    error: null,
    device: null,
  },
  muted: false,
  masterVolume: 0.9,
  server: {
    instanceId: '',
    scaleMode: '',
    iceServers: [],
  },
  notices: [],
  stats: {
    fps: 0,
    peers: 0,
    edges: 0,
    remote: null,
  },
  sessionIntent: null,
};

function upsertNotice(notices, notice) {
  return [
    {
      id: `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 7)}`,
      at: Date.now(),
      ...notice,
    },
    ...notices,
  ].slice(0, 6);
}

function reducer(state, action) {
  switch (action.type) {
    case 'status':
      return {
        ...state,
        status: action.status,
        statusDetail: action.detail ?? '',
      };

    case 'joined': {
      const {
        self,
        room,
        peers,
        config: serverConfig,
      } = action.payload;

      return {
        ...state,
        status: 'online',
        selfId: self.id,
        room,
        sessionIntent: action.intent,
        server: {
          instanceId: serverConfig?.instanceId ?? '',
          scaleMode: serverConfig?.scaleMode ?? '',
          earshotRadiusPx:
            serverConfig?.earshotRadiusPx ??
            config.audio.earshotRadiusPx,
          iceServers: serverConfig?.iceServers ?? [],
          heartbeatIntervalMs:
            serverConfig?.heartbeatIntervalMs ??
            config.network.heartbeatMs,
        },
        roster: peers.map((peer) => ({
          id: peer.id,
          name: peer.name,
          color: peer.color,
          micEnabled: peer.micEnabled !== false,
          connection: 'pending',
        })),
      };
    }

    case 'roster':
      return {
        ...state,
        roster: action.roster,
      };

    case 'clusters':
      return {
        ...state,
        clusters: action.clusters,
      };

    case 'mic':
      return {
        ...state,
        mic: {
          ...state.mic,
          ...action.mic,
        },
      };

    case 'muted':
      return {
        ...state,
        muted: action.muted,
      };

    case 'volume':
      return {
        ...state,
        masterVolume: action.volume,
      };

    case 'server':
      return {
        ...state,
        server: {
          ...state.server,
          ...action.server,
        },
      };

    case 'notice':
      return {
        ...state,
        notices: upsertNotice(
          state.notices,
          action.notice,
        ),
      };

    case 'dismissNotice':
      return {
        ...state,
        notices: state.notices.filter(
          (notice) => notice.id !== action.id,
        ),
      };

    case 'stats':
      return {
        ...state,
        stats: {
          ...state.stats,
          ...action.stats,
        },
      };

    case 'reset':
      return {
        ...initialState,
        sessionIntent: action.clearIntent
          ? null
          : state.sessionIntent,
      };

    default:
      return state;
  }
}

export function ProxiProvider({
  children,
  serverUrl = config.serverUrl,
}) {
  const [state, dispatch] = useReducer(
    reducer,
    initialState,
  );

  const worldRef = useRef({
    self: {
      id: null,
      x: 0,
      y: 0,
      angle: 0,
      color: '#4f8cff',
      name: 'You',
      authority: null,
    },
    peers: new Map(),
    obstacles: [],
    clusters: [],
    edges: new Map(),
    earshotRadiusPx: config.audio.earshotRadiusPx,
  });

  const inputRef = useRef({
    keys: new Set(),
    moveTarget: null,
    facing: 0,
  });

  const sendRef = useRef({
    send: () => {},
    lastSentAt: 0,
    pending: null,
  });

  const clientRef = useRef(null);
  const audioRef = useRef(null);
  const peersRef = useRef(null);
  const localStreamRef = useRef(null);
  const heartbeatRef = useRef(null);

  /*
   * The meeting intent survives provider unmounts caused by
   * page refreshes. It is restored only when the URL contains
   * the same room ID.
   */
  const sessionIntentRef = useRef(
    readPersistedMeetingIntent(),
  );

  /*
   * Prevent multiple room:join requests if Socket.IO emits
   * more than one online notification during reconnection.
   */
  const rejoiningRef = useRef(false);

  const stateRef = useRef(state);
  stateRef.current = state;

  const mutedRef = useRef(state.muted);
  mutedRef.current = state.muted;

  const syncRoster = useCallback((world) => {
    return [...world.peers.values()].map((peer) => ({
      id: peer.id,
      name: peer.name,
      color: peer.color,
      micEnabled: peer.micEnabled !== false,
      soundFactor: peer.soundFactor ?? 1,
      connection: peer.connection ?? 'pending',
      distancePx: Math.hypot(
        (peer.x ?? 0) - world.self.x,
        (peer.y ?? 0) - world.self.y,
      ),
      earshotRadiusPx: world.earshotRadiusPx,
      speaking: peer.speaking === true,
    }));
  }, []);

  const startHeartbeat = useCallback((intervalMs) => {
    clearInterval(heartbeatRef.current);

    heartbeatRef.current = setInterval(() => {
      clientRef.current?.emit(
        'presence:heartbeat',
        {},
      );
    }, Math.max(2000, intervalMs));
  }, []);

  const applyJoinAck = useCallback(
    (ack, intent) => {
      const world = worldRef.current;

      sessionIntentRef.current = intent;

      world.self = {
        ...world.self,
        id: ack.self.id,
        name: ack.self.name,
        color: ack.self.color,
        x: ack.self.x,
        y: ack.self.y,
        angle: ack.self.angle ?? 0,
        authority: {
          x: ack.self.x,
          y: ack.self.y,
        },
      };

      world.obstacles = ack.room?.obstacles ?? [];
      world.room = ack.room;

      world.earshotRadiusPx =
        ack.config?.earshotRadiusPx ??
        config.audio.earshotRadiusPx;

      for (const peerId of world.peers.keys()) {
        audioRef.current?.detachRemoteStream(
          peerId,
        );
      }

      peersRef.current?.reset({
        iceServers:
          ack.config?.iceServers ??
          stateRef.current.server?.iceServers ??
          [],
      });

      world.peers.clear();
      world.edges.clear();

      for (const peer of ack.peers ?? []) {
        world.peers.set(peer.id, {
          ...peer,
          level: 0,
          speaking: false,
          soundFactor: 1,
          connection: 'pending',
        });
      }

      if (ack.config?.heartbeatIntervalMs) {
        startHeartbeat(
          ack.config.heartbeatIntervalMs,
        );
      }

      for (const peer of world.peers.values()) {
        peer.soundFactor = soundFactorBetween(
          world.self,
          peer,
          world.obstacles,
        ).soundFactor;
      }

      dispatch({
        type: 'joined',
        payload: ack,
        intent,
      });

      dispatch({
        type: 'roster',
        roster: syncRoster(world),
      });
    },
    [syncRoster, startHeartbeat],
  );

  /*
   * Rejoin the existing room after the socket reconnects.
   *
   * The same function handles:
   * - ordinary Socket.IO reconnections;
   * - a browser refresh while a meeting URL is active.
   *
   * The server remains authoritative: the room:join
   * acknowledgement determines whether the meeting can
   * actually be restored.
   */
  const rejoinAfterReconnect = useCallback(
    async () => {
      const client = clientRef.current;

      const intent =
        sessionIntentRef.current ??
        stateRef.current.sessionIntent;

      if (
        !client ||
        !intent ||
        rejoiningRef.current
      ) {
        return;
      }

      rejoiningRef.current = true;

      try {
        const ack = await client.request(
          'room:join',
          {
            roomId: intent.roomId,
            name: intent.name,
            color: intent.color,
            avatar: intent.avatar,
          },
        );

        applyJoinAck(ack, intent);

        /*
         * If the microphone stream still exists after a
         * normal socket reconnection, attach it to the
         * newly negotiated peer connections.
         *
         * A full browser refresh destroys the old stream.
         * In that case the user rejoins in listen-only mode.
         */
        if (localStreamRef.current) {
          await peersRef.current?.replaceOutgoingTrack(
            localStreamRef.current,
          );

          client.emit('peer:media-ready', {
            micEnabled: !mutedRef.current,
          });
        } else {
          // A browser refresh destroys the previous MediaStream.
          // Do not leave the UI in the initial `idle`/pending state:
          // the restored room is explicitly listen-only until the
          // user grants microphone access again through the UI.
          dispatch({
            type: 'mic',
            mic: {
              state: 'listen-only',
              error: null,
              device: null,
            },
          });

          client.emit('peer:media-ready', {
            micEnabled: false,
          });
        }

        dispatch({
          type: 'notice',
          notice: {
            level: 'ok',
            message: 'Reconnected to the office.',
          },
        });
      } catch (err) {
        dispatch({
          type: 'notice',
          notice: {
            level: 'error',
            message: `Rejoin failed: ${err.message}`,
          },
        });
      } finally {
        rejoiningRef.current = false;
      }
    },
    [applyJoinAck],
  );

  useEffect(() => {
    const client = createSocketClient({
      url: serverUrl,
    });

    clientRef.current = client;

    const audio = new SpatialAudioEngine({
      earshotRadiusPx: config.audio.earshotRadiusPx,
      fullVolumePx: config.audio.fullVolumeRadiusPx,
      updateIntervalMs: config.audio.updateIntervalMs,
      speakingThreshold: config.audio.speakingThreshold,
      maxVoices: config.audio.maxVoices,
    });

    audioRef.current = audio;

    audio.onSpeakingChange = (peerId, speaking) => {
      const peer = worldRef.current.peers.get(
        peerId,
      );

      if (peer) {
        peer.speaking = speaking;
      }
    };

    const peerManager = new PeerManager({
      socket: client.socket,
      iceServers: [],
      getLocalStream: () => localStreamRef.current,

      onTrack: (peerId, stream) => {
        audio.attachRemoteStream(
          peerId,
          stream,
        );

        const peer = worldRef.current.peers.get(
          peerId,
        );

        if (peer) {
          peer.connection = 'connected';
        }

        dispatch({
          type: 'roster',
          roster: syncRoster(worldRef.current),
        });
      },

      onConnectionChange: (
        peerId,
        stateName,
      ) => {
        const world = worldRef.current;
        const peer = world.peers.get(peerId);

        if (peer) {
          peer.connection = stateName;
        }

        /*
         * A WebRTC connection closing is not equivalent
         * to a user leaving the room. Preserve room presence
         * until the server confirms departure.
         */
        if (
          stateName === 'closed:hangup' ||
          stateName === 'closed:replaced'
        ) {
          audio.detachRemoteStream(peerId);
          world.edges.delete(peerId);

          const presentPeer = world.peers.get(
            peerId,
          );

          if (presentPeer) {
            presentPeer.connection = 'out-of-range';
            presentPeer.speaking = false;
          }
        }

        dispatch({
          type: 'roster',
          roster: syncRoster(world),
        });
      },

      onError: (message) => {
        dispatch({
          type: 'notice',
          notice: {
            level: 'warn',
            message,
          },
        });
      },
    });

    peersRef.current = peerManager;

    client.onStatus((status, detail) => {
      dispatch({
        type: 'status',
        status,
        detail: detail ?? '',
      });

      if (status === 'online') {
        void rejoinAfterReconnect();
      }
    });

    client.on('system:hello', (payload) => {
      dispatch({
        type: 'server',
        server: {
          instanceId: payload.instanceId,
          scaleMode: payload.scaleMode,
        },
      });
    });

    client.on('system:error', (payload) => {
      dispatch({
        type: 'notice',
        notice: {
          level: 'error',
          message: payload?.message ?? 'Server error',
        },
      });
    });

    client.on('peer:joined', ({ peer }) => {
      const world = worldRef.current;

      world.peers.set(peer.id, {
        ...peer,
        level: 0,
        speaking: false,
        soundFactor: 1,
        connection: 'pending',
        distancePx: Infinity,
      });

      dispatch({
        type: 'roster',
        roster: syncRoster(world),
      });

      dispatch({
        type: 'notice',
        notice: {
          level: 'info',
          message: `${peer.name} joined the office`,
        },
      });
    });

    client.on('peer:left', ({ id, reason }) => {
      const world = worldRef.current;
      const peer = world.peers.get(id);

      world.peers.delete(id);
      world.edges.delete(id);
      audio.detachRemoteStream(id);

      if (peerManager.connections.has(id)) {
        peerManager.handleHangup({
          peerId: id,
        });
      }

      dispatch({
        type: 'roster',
        roster: syncRoster(world),
      });

      if (peer) {
        dispatch({
          type: 'notice',
          notice: {
            level: 'info',
            message: `${peer.name} left (${reason})`,
          },
        });
      }
    });

    client.socket.on(
      'presence:moved',
      (payload) => {
        const world = worldRef.current;
        const peer = world.peers.get(payload.id);

        if (!peer) {
          return;
        }

        peer.x = payload.x;
        peer.y = payload.y;
        peer.angle = payload.angle;

        peer.distancePx = Math.hypot(
          payload.x - world.self.x,
          payload.y - world.self.y,
        );
      },
    );

    client.socket.on(
      'presence:snapshot',
      (payload = {}) => {
        const world = worldRef.current;

        const snapshotPeers = Array.isArray(
          payload.peers,
        )
          ? payload.peers
          : [];

        const livePeerIds = new Set(
          snapshotPeers
            .map((peer) => peer?.id)
            .filter(
              (id) =>
                typeof id === 'string' &&
                id !== world.self.id,
            ),
        );

        const knownPeerIds = new Set([
          ...world.peers.keys(),
          ...(peerManager.connections?.keys?.() ?? []),
          ...world.edges.keys(),
        ]);

        for (const peerId of knownPeerIds) {
          if (livePeerIds.has(peerId)) {
            continue;
          }

          world.peers.delete(peerId);
          world.edges.delete(peerId);
          audio.detachRemoteStream(peerId);

          if (
            peerManager.connections.has(peerId)
          ) {
            peerManager.handleHangup({
              peerId,
            });
          }
        }

        const previousPeers = world.peers;
        const nextPeers = new Map();

        for (const snapshotPeer of snapshotPeers) {
          if (
            !snapshotPeer ||
            typeof snapshotPeer.id !== 'string' ||
            snapshotPeer.id === world.self.id
          ) {
            continue;
          }

          const previous = previousPeers.get(
            snapshotPeer.id,
          );

          nextPeers.set(snapshotPeer.id, {
            ...previous,
            ...snapshotPeer,
            level: previous?.level ?? 0,
            speaking: previous?.speaking ?? false,
            soundFactor:
              previous?.soundFactor ?? 1,
            connection:
              previous?.connection ?? 'pending',
            distancePx: Math.hypot(
              (snapshotPeer.x ?? previous?.x ?? 0) -
                world.self.x,
              (snapshotPeer.y ?? previous?.y ?? 0) -
                world.self.y,
            ),
          });
        }

        world.peers = nextPeers;

        dispatch({
          type: 'roster',
          roster: syncRoster(world),
        });
      },
    );

    client.on(
      'peer:media-state',
      ({ id, micEnabled }) => {
        const peer = worldRef.current.peers.get(
          id,
        );

        if (peer) {
          peer.micEnabled = micEnabled;
        }

        dispatch({
          type: 'roster',
          roster: syncRoster(worldRef.current),
        });
      },
    );

    client.on('peer:negotiate', (payload) => {
      const world = worldRef.current;
      const peerId = payload.peer.id;
      const peer = world.peers.get(peerId);

      if (peer) {
        peer.x = payload.peer.x;
        peer.y = payload.peer.y;
        peer.name = payload.peer.name;
        peer.color = payload.peer.color;
        peer.avatar = payload.peer.avatar;
        peer.soundFactor =
          payload.soundFactor ?? 1;
      } else {
        world.peers.set(peerId, {
          ...payload.peer,
          soundFactor: payload.soundFactor ?? 1,
          level: 0,
          speaking: false,
          connection: 'pending',
        });
      }

      world.edges.set(peerId, {
        generation: payload.generation,
        soundFactor: payload.soundFactor ?? 1,
      });

      audio.setPeerOcclusion(
        peerId,
        payload.soundFactor ?? 1,
      );

      dispatch({
        type: 'roster',
        roster: syncRoster(world),
      });

      void peerManager.handleNegotiate(payload);
    });

    client.on('peer:signal', (payload) => {
      void peerManager.handleSignal(payload);
    });

    client.on('peer:hangup', ({ peerId }) => {
      const world = worldRef.current;
      const peer = world.peers.get(peerId);

      world.edges.delete(peerId);
      audio.detachRemoteStream(peerId);

      if (peer) {
        peer.connection = 'out-of-range';
        peer.speaking = false;
      }

      peerManager.handleHangup({
        peerId,
      });

      dispatch({
        type: 'roster',
        roster: syncRoster(world),
      });
    });

    client.on(
      'peer:audio-obstruction',
      ({ peerId, soundFactor }) => {
        const world = worldRef.current;
        const edge = world.edges.get(peerId);

        if (edge) {
          edge.soundFactor = soundFactor;
        }

        const peer = world.peers.get(peerId);

        if (peer) {
          peer.soundFactor = soundFactor;
        }

        audio.setPeerOcclusion(
          peerId,
          soundFactor,
        );
      },
    );

    client.on(
      'presence:clusters',
      ({ clusters }) => {
        worldRef.current.clusters = clusters;

        dispatch({
          type: 'clusters',
          clusters,
        });
      },
    );

    client.on('audit:completed', (payload) => {
      dispatch({
        type: 'notice',
        notice: {
          level: payload.withinBudget
            ? 'ok'
            : 'error',
          message:
            `Spatial audit: $near p95 ${payload.p95Ms}ms · ` +
            `${payload.matched} peers in earshot · ` +
            `${
              payload.withinBudget
                ? 'within'
                : 'OVER'
            } the ${config.audit.budgetMs}ms budget`,
        },
      });

      dispatch({
        type: 'stats',
        stats: {
          audit: payload,
        },
      });
    });

    client.on('audit:remote', (payload) => {
      dispatch({
        type: 'notice',
        notice: {
          level: payload.ok ? 'ok' : 'warn',
          message:
            `Audit completed on instance ${String(
              payload.from,
            ).slice(0, 12)} · ` +
            `p95 ${payload.p95Ms ?? 'n/a'}ms`,
        },
      });
    });

    dispatch({
      type: 'status',
      status: 'connecting',
    });

       return () => {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;

      // Stop microphone capture before releasing the provider.
      const localStream = localStreamRef.current;

      if (localStream) {
        localStream.getTracks().forEach((track) => {
          track.stop();
        });

        localStreamRef.current = null;
      }

      // Release WebRTC connections and remote audio resources.
      peerManager.closeAll();
      audio.dispose();

      // Disconnect the Socket.IO client.
      client.disconnect();

      clientRef.current = null;
      peersRef.current = null;
      audioRef.current = null;

      rejoiningRef.current = false;
    };
  }, [
    serverUrl,
    rejoinAfterReconnect,
    syncRoster,
  ]);

  const requestMicrophone = useCallback(
    async () => {
      dispatch({
        type: 'mic',
        mic: {
          state: 'requesting',
          error: null,
        },
      });

      if (!navigator.mediaDevices?.getUserMedia) {
        const error = new Error(
          'Microphone access requires a supported browser and secure context (HTTPS or localhost).',
        );

        dispatch({
          type: 'mic',
          mic: {
            state: 'denied',
            error: error.message,
          },
        });

        throw error;
      }

      let stream = null;

      try {
        stream =
          await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              channelCount: 1,
            },
            video: false,
          });

        const audioTracks = stream.getAudioTracks();

        if (audioTracks.length === 0) {
          throw new Error(
            'The selected microphone did not provide an audio track.',
          );
        }

        const track = audioTracks[0];

        track.enabled = !mutedRef.current;

        localStreamRef.current = stream;

        const audio = audioRef.current;

        if (!audio) {
          throw new Error(
            'The audio engine is not initialized. Please try again.',
          );
        }

        await audio.init();
        await audio.setLocalStream(stream);

        /*
         * Attach the microphone to existing WebRTC peer
         * connections. PeerManager reserves an audio sender
         * when creating each connection.
         */
        await peersRef.current?.replaceOutgoingTrack(
          stream,
        );

        if (
          clientRef.current?.connected &&
          stateRef.current.sessionIntent
        ) {
          clientRef.current.emit(
            'peer:media-ready',
            {
              micEnabled: !mutedRef.current,
            },
          );
        }

        dispatch({
          type: 'mic',
          mic: {
            state: 'ready',
            error: null,
            device:
              track.label || 'default microphone',
          },
        });

        return stream;
      } catch (err) {
        if (stream) {
          for (const track of stream.getTracks()) {
            track.stop();
          }
        }

        if (localStreamRef.current === stream) {
          localStreamRef.current = null;
        }

        const message =
          err?.name === 'NotAllowedError'
            ? 'Microphone permission was denied. Allow microphone access in your browser settings, then try again.'
            : err?.name === 'NotFoundError'
              ? 'No microphone was found on this device.'
              : `Microphone unavailable: ${
                  err?.message ?? String(err)
                }`;

        dispatch({
          type: 'mic',
          mic: {
            state: 'denied',
            error: message,
          },
        });

        throw Object.assign(
          new Error(message),
          {
            cause: err,
          },
        );
      }
    },
    [],
  );

  const join = useCallback(
    async ({
      roomId = config.defaultRoom,
      name,
      color = '#4f8cff',
      avatar = 'circle',
      withMic = true,
    }) => {
      const displayName =
        (name || '').trim() ||
        `Guest ${Math.floor(
          Math.random() * 900 + 100,
        )}`;

      const client = clientRef.current;

      if (!client) {
        throw new Error(
          'The server connection is not initialized.',
        );
      }

      const intent = {
        roomId,
        name: displayName,
        color,
        avatar,
      };

      await audioRef.current
        ?.init()
        .catch(() => {});

      if (
        withMic &&
        !localStreamRef.current
      ) {
        try {
          await requestMicrophone();
        } catch {
          // Joining in listen-only mode is allowed.
        }
      }

      try {
        const ack = await client.request(
          'room:join',
          intent,
        );

        applyJoinAck(ack, intent);

        /*
         * Save only after the server confirms the join.
         * A failed join must not become a restorable session.
         */
        persistMeetingIntent(intent);

        /*
         * Room joining can create or recreate peer
         * connections. Reattach the stream after the
         * join acknowledgement as well.
         */
        if (localStreamRef.current) {
          await peersRef.current?.replaceOutgoingTrack(
            localStreamRef.current,
          );
        }

        client.emit('peer:media-ready', {
          micEnabled:
            Boolean(localStreamRef.current) &&
            !mutedRef.current,
        });

        worldRef.current.self.name = displayName;

        dispatch({
          type: 'mic',
          mic: {
            state: localStreamRef.current
              ? stateRef.current.mic.state
              : 'listen-only',
          },
        });

        return ack;
      } catch (err) {
        dispatch({
          type: 'notice',
          notice: {
            level: 'error',
            message: `Could not join: ${err.message}`,
          },
        });

        throw err;
      }
    },
    [
      applyJoinAck,
      requestMicrophone,
    ],
  );

  const leave = useCallback(async () => {
    const client = clientRef.current;

    try {
      if (
        client?.connected &&
        stateRef.current.sessionIntent
      ) {
        await client.request(
          'room:leave',
          {},
        );
      }
    } catch (err) {
      dispatch({
        type: 'notice',
        notice: {
          level: 'warn',
          message:
            `Server leave confirmation failed: ${err.message}`,
        },
      });
    } finally {
      const world = worldRef.current;

      /*
       * Explicit leave is different from a refresh.
       * Clear the saved intent so the next visit does not
       * silently re-enter this meeting.
       */
      sessionIntentRef.current = null;
      clearPersistedMeetingIntent();

      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;

      for (const peerId of world.peers.keys()) {
        audioRef.current?.detachRemoteStream(
          peerId,
        );
      }

      peersRef.current?.reset({
        iceServers:
          stateRef.current.server?.iceServers ?? [],
      });

      world.peers.clear();
      world.edges.clear();
      world.obstacles = [];
      world.clusters = [];
      world.room = null;

      world.self = {
        ...world.self,
        id: null,
        x: 0,
        y: 0,
        angle: 0,
        authority: null,
      };

      dispatch({
        type: 'reset',
        clearIntent: true,
      });

      dispatch({
        type: 'status',
        status: 'idle',
      });
    }
  }, []);

  const toggleMute = useCallback(async () => {
  const next = !mutedRef.current;

  // Unmuting without a live microphone requires
  // a fresh browser permission request.
  if (next === false) {
    const existingTrack = localStreamRef.current
      ?.getAudioTracks()
      .find((track) => track.readyState === 'live');

    if (!existingTrack) {
      mutedRef.current = false;

      try {
        await requestMicrophone();
      } catch (error) {
        mutedRef.current = true;

        dispatch({
          type: 'muted',
          muted: true,
        });

        dispatch({
          type: 'notice',
          notice: {
            level: 'error',
            message: error.message,
          },
        });

        return;
      }
    }
  }

  const stream = localStreamRef.current;

  const liveTrack = stream
    ?.getAudioTracks()
    .find((track) => track.readyState === 'live');

  const actualMicEnabled =
    next === false && Boolean(liveTrack);

  mutedRef.current = !actualMicEnabled;

  liveTrack && (liveTrack.enabled = actualMicEnabled);

  audioRef.current?.setLocalMuted(!actualMicEnabled);

  peersRef.current?.setMicEnabled(actualMicEnabled);

  clientRef.current?.emit('peer:media-ready', {
    micEnabled: actualMicEnabled,
  });

  dispatch({
    type: 'muted',
    muted: !actualMicEnabled,
  });
}, [requestMicrophone]);

  const setVolume = useCallback((volume) => {
    audioRef.current?.setMasterVolume(volume);

    dispatch({
      type: 'volume',
      volume,
    });
  }, []);

  const sendPosition = useCallback(
    (x, y, angle) => {
      const now = performance.now();

      if (
        now - sendRef.current.lastSentAt <
        config.network.positionThrottleMs
      ) {
        return;
      }

      sendRef.current.lastSentAt = now;

      clientRef.current?.socket.emit(
        'position:update',
        {
          x,
          y,
          angle,
        },
        (ack) => {
          if (!ack?.ok) {
            return;
          }

          const self = worldRef.current.self;

          if (typeof ack.x === 'number') {
            self.authority = {
              x: ack.x,
              y: ack.y,
            };
          }
        },
      );
    },
    [],
  );

  const requestAudit = useCallback(
    async () => {
      const self = worldRef.current.self;

      const params = new URLSearchParams({
        roomId:
          worldRef.current.room?.roomId ??
          config.defaultRoom,
        x: String(Math.round(self.x)),
        y: String(Math.round(self.y)),
        radius: String(
          worldRef.current.earshotRadiusPx,
        ),
        samples: '25',
      });

      try {
        const response = await fetch(
          `${config.serverUrl}/api/spatial-audit?${params}`,
        );

        const report = await response.json();

        dispatch({
          type: 'stats',
          stats: {
            audit: report,
          },
        });

        dispatch({
          type: 'notice',
          notice: {
            level: report.ok ? 'ok' : 'error',
            message: report.ok
              ? `Spatial audit PASSED — p95 ${report.queries.near.p95Ms}ms, ${report.accuracy.matchedPeers} peers in earshot`
              : `Spatial audit FAILED — p95 ${report.queries.near.p95Ms}ms`,
          },
        });

        return report;
      } catch (err) {
        dispatch({
          type: 'notice',
          notice: {
            level: 'error',
            message: `Audit request failed: ${err.message}`,
          },
        });

        throw err;
      }
    },
    [],
  );

  useEffect(() => {
    audioRef.current?.setMasterVolume(
      state.masterVolume,
    );

    audioRef.current?.setLocalMuted(
      state.muted,
    );
  }, [
    state.masterVolume,
    state.muted,
  ]);

  const value = useMemo(
    () => ({
      state,
      dispatch,
      worldRef,
      inputRef,
      sendPosition,
      sendRef,
      join,
      leave,
      toggleMute,
      setVolume,
      requestMicrophone,
      requestAudit,
      audioRef,
      peersRef,
      clientRef,
      syncRoster,
    }),
    [
      state,
      sendPosition,
      join,
      leave,
      toggleMute,
      setVolume,
      requestMicrophone,
      requestAudit,
      syncRoster,
    ],
  );

  return (
    <ProxiContext.Provider value={value}>
      {children}
    </ProxiContext.Provider>
  );
}

export function useProxi() {
  const context = useContext(ProxiContext);

  if (!context) {
    throw new Error(
      'useProxi must be used inside <ProxiProvider>',
    );
  }

  return context;
}

export default ProxiContext;