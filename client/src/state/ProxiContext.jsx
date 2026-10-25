/**
 * Application state container.
 *
 * Two tiers on purpose:
 *
 *   worldRef  — hot data (positions, speaking levels, audio geometry). Written
 *               by socket events and by the render loop, never triggers React.
 *   state     — structural data (connection, roster, room, notices). Changes
 *               are rare, so React re-renders are cheap and the canvas keeps a
 *               steady 60 FPS.
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
  const next = [
    {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      at: Date.now(),
      ...notice,
    },
    ...notices,
  ];

  return next.slice(0, 6);
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
      const { self, room, peers, config: serverConfig } = action.payload;

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
        notices: upsertNotice(state.notices, action.notice),
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
  const [state, dispatch] = useReducer(reducer, initialState);

  // -------------------------------------------------------------------------
  // Hot data references. Updating these does not trigger React renders.
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Boot Socket.IO, spatial audio and WebRTC.
  // -------------------------------------------------------------------------

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
      const peer = worldRef.current.peers.get(peerId);

      if (peer) {
        peer.speaking = speaking;
      }
    };

    const peerManager = new PeerManager({
      socket: client.socket,

      // ICE servers are supplied by the server after joining.
      iceServers: [],

      getLocalStream: () => localStreamRef.current,

      onTrack: (peerId, stream) => {
        audio.attachRemoteStream(peerId, stream);

        const peer = worldRef.current.peers.get(peerId);

        if (peer) {
          peer.connection = 'connected';
        }

        dispatch({
          type: 'roster',
          roster: syncRoster(worldRef.current),
        });
      },

      onConnectionChange: (peerId, stateName) => {
        const world = worldRef.current;
        const peer = world.peers.get(peerId);

        if (peer) {
          peer.connection = stateName;
        }

        if (
          stateName === 'closed:hangup' ||
          stateName === 'closed:replaced'
        ) {
          audio.detachRemoteStream(peerId);
          world.peers.delete(peerId);
          world.edges.delete(peerId);
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

    // -----------------------------------------------------------------------
    // Peer joined.
    // -----------------------------------------------------------------------

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

    // -----------------------------------------------------------------------
    // Peer left.
    // -----------------------------------------------------------------------

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

    // -----------------------------------------------------------------------
    // Peer movement. Keep this handler free of React state updates.
    // -----------------------------------------------------------------------

    client.socket.on('presence:moved', (payload) => {
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
    });

    // -----------------------------------------------------------------------
    // Authoritative presence snapshot.
    //
    // Remove stale peers and connections, but preserve the live peers'
    // existing connection, speaking, audio and occlusion state.
    // -----------------------------------------------------------------------

    client.socket.on('presence:snapshot', (payload = {}) => {
      const world = worldRef.current;

      const snapshotPeers = Array.isArray(payload.peers)
        ? payload.peers
        : [];

      const livePeerIds = new Set(
        snapshotPeers
          .map((peer) => peer?.id)
          .filter(
            (peerId) =>
              typeof peerId === 'string' &&
              peerId !== world.self.id,
          ),
      );

      // A snapshot is authoritative. A peer absent from it is stale.
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

        if (peerManager.connections.has(peerId)) {
          peerManager.handleHangup({
            peerId,
          });
        }
      }

      // Rebuild the roster from the snapshot without resetting live
      // peers' WebRTC state or audio-related values.
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

        const previous = previousPeers.get(snapshotPeer.id);

        const nextPeer = {
          ...previous,
          ...snapshotPeer,

          level: previous?.level ?? 0,
          speaking: previous?.speaking ?? false,
          soundFactor:
            previous?.soundFactor ??
            world.edges.get(snapshotPeer.id)?.soundFactor ??
            1,
          connection: previous?.connection ?? 'pending',
          distancePx: Math.hypot(
            (snapshotPeer.x ?? previous?.x ?? 0) - world.self.x,
            (snapshotPeer.y ?? previous?.y ?? 0) - world.self.y,
          ),
        };

        nextPeers.set(snapshotPeer.id, nextPeer);
      }

      world.peers = nextPeers;

      dispatch({
        type: 'roster',
        roster: syncRoster(world),
      });
    });

    // -----------------------------------------------------------------------
    // Microphone state of a remote peer.
    // -----------------------------------------------------------------------

    client.on('peer:media-state', ({ id, micEnabled }) => {
      const peer = worldRef.current.peers.get(id);

      if (peer) {
        peer.micEnabled = micEnabled;
      }

      dispatch({
        type: 'roster',
        roster: syncRoster(worldRef.current),
      });
    });

    // -----------------------------------------------------------------------
    // WebRTC negotiation.
    // -----------------------------------------------------------------------

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
        peer.soundFactor = payload.soundFactor ?? 1;
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

      world.edges.delete(peerId);
      world.peers.delete(peerId);

      audio.detachRemoteStream(peerId);

      peerManager.handleHangup({
        peerId,
      });

      dispatch({
        type: 'roster',
        roster: syncRoster(world),
      });
    });

    // -----------------------------------------------------------------------
    // Spatial audio obstruction updates.
    // -----------------------------------------------------------------------

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

        audio.setPeerOcclusion(peerId, soundFactor);
      },
    );

    // -----------------------------------------------------------------------
    // Spatial clusters.
    // -----------------------------------------------------------------------

    client.on('presence:clusters', ({ clusters }) => {
      worldRef.current.clusters = clusters;

      dispatch({
        type: 'clusters',
        clusters,
      });
    });

    // -----------------------------------------------------------------------
    // Local spatial audit results.
    // -----------------------------------------------------------------------

    client.on('audit:completed', (payload) => {
      dispatch({
        type: 'notice',
        notice: {
          level: payload.withinBudget ? 'ok' : 'error',
          message:
            `Spatial audit: $near p95 ${payload.p95Ms}ms · ` +
            `${payload.matched} peers in earshot · ` +
            `${
              payload.withinBudget ? 'within' : 'OVER'
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

    // -----------------------------------------------------------------------
    // Remote spatial audit results.
    // -----------------------------------------------------------------------

    client.on('audit:remote', (payload) => {
      dispatch({
        type: 'notice',
        notice: {
          level: payload.ok ? 'ok' : 'warn',
          message:
            `Audit completed on instance ${String(payload.from).slice(0, 12)} · ` +
            `p95 ${payload.p95Ms ?? 'n/a'}ms`,
        },
      });
    });

    dispatch({
      type: 'status',
      status: 'connecting',
    });

    // -----------------------------------------------------------------------
    // Cleanup on provider unmount.
    // -----------------------------------------------------------------------

    return () => {
      clearInterval(heartbeatRef.current);

      peersRef.current?.closeAll();
      audioRef.current?.dispose();

      clientRef.current?.disconnect();

      clientRef.current = null;
      peersRef.current = null;
      audioRef.current = null;
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Socket and audio infrastructure are initialized once per serverUrl.
  }, [serverUrl]);

  // -------------------------------------------------------------------------
  // Helpers.
  // -------------------------------------------------------------------------

  const syncRoster = useCallback((world, overrides = {}) => {
    return [...world.peers.values()].map((peer) => ({
      id: peer.id,
      name: peer.name,
      color: peer.color,
      micEnabled: peer.micEnabled !== false,
      soundFactor: peer.soundFactor ?? 1,
      connection:
        overrides.connection ??
        peer.connection ??
        'pending',
      distancePx: Math.hypot(
        peer.x - world.self.x,
        peer.y - world.self.y,
      ),
      earshotRadiusPx: world.earshotRadiusPx,
      speaking: peer.speaking === true,
    }));
  }, []);

  const rejoinAfterReconnect = useCallback(async () => {
    if (!clientRef.current) {
      return;
    }

    const intent = stateRef.current.sessionIntent;

    if (!intent) {
      return;
    }

    try {
      const ack = await clientRef.current.request(
        'room:join',
        {
          roomId: intent.roomId,
          name: intent.name,
          color: intent.color,
          avatar: intent.avatar,
        },
      );

      applyJoinAck(ack, intent);

      if (localStreamRef.current) {
        clientRef.current.emit('peer:media-ready', {
          micEnabled: !mutedRef.current,
        });
      }

      dispatch({
        type: 'notice',
        notice: {
          level: 'ok',
          message: 'Reconnected — audio mesh re-established',
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
    }
  }, []);

  const startHeartbeat = useCallback((intervalMs) => {
    clearInterval(heartbeatRef.current);

    heartbeatRef.current = setInterval(() => {
      clientRef.current?.emit('presence:heartbeat', {});
    }, Math.max(2000, intervalMs));
  }, []);

  const applyJoinAck = useCallback(
    (ack, intent) => {
      const world = worldRef.current;

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

      world.peers.clear();

      for (const peer of ack.peers ?? []) {
        world.peers.set(peer.id, {
          ...peer,
          level: 0,
          speaking: false,
          soundFactor: 1,
          connection: 'pending',
        });
      }

      // A reconnect may leave old WebRTC connections behind.
      // Only retain connections for peers in the new join acknowledgement.
      for (const peerId of [
        ...peersRef.current.connections.keys(),
      ]) {
        if (!world.peers.has(peerId)) {
          peersRef.current.handleHangup({
            peerId,
          });
        }
      }

      if (ack.config?.iceServers?.length) {
        peersRef.current.iceServers = ack.config.iceServers;
      }

      if (ack.config?.heartbeatIntervalMs) {
        startHeartbeat(ack.config.heartbeatIntervalMs);
      }

      // Mirror server-side spatial occlusion locally.
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

  // Mirrors of React state for long-lived callbacks.
  const stateRef = useRef(state);
  stateRef.current = state;

  const mutedRef = useRef(false);
  mutedRef.current = state.muted;

  // -------------------------------------------------------------------------
  // Microphone access.
  // -------------------------------------------------------------------------

  const requestMicrophone = useCallback(async () => {
    dispatch({
      type: 'mic',
      mic: {
        state: 'requesting',
        error: null,
      },
    });

    if (!navigator.mediaDevices?.getUserMedia) {
      const error = new Error(
        'This browser does not expose navigator.mediaDevices.getUserMedia (a secure context is required).',
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

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
          },
          video: false,
        });

      localStreamRef.current = stream;

      await audioRef.current.setLocalStream(stream);

      const track = stream.getAudioTracks()[0];

      dispatch({
        type: 'mic',
        mic: {
          state: 'ready',
          error: null,
          device: track?.label ?? 'default microphone',
        },
      });

      return stream;
    } catch (err) {
      const message =
        err?.name === 'NotAllowedError'
          ? 'Microphone permission was denied. Allow it in the browser address bar, then press "Try again" — or continue in listen-only mode.'
          : err?.name === 'NotFoundError'
            ? 'No microphone was found on this device.'
            : `Microphone unavailable: ${err?.message ?? err}`;

      dispatch({
        type: 'mic',
        mic: {
          state: 'denied',
          error: message,
        },
      });

      throw Object.assign(new Error(message), {
        cause: err,
      });
    }
  }, []);

  // -------------------------------------------------------------------------
  // Join room.
  // -------------------------------------------------------------------------

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
        `Guest ${Math.floor(Math.random() * 900 + 100)}`;

      const client = clientRef.current;

      const intent = {
        roomId,
        name: displayName,
        color,
        avatar,
      };

      // Unlock the AudioContext from the click gesture.
      await audioRef.current?.init().catch(() => {});

      if (withMic && !localStreamRef.current) {
        try {
          await requestMicrophone();
        } catch {
          // Listen-only mode remains available if microphone access fails.
        }
      }

      try {
        const ack = await client.request(
          'room:join',
          intent,
        );

        applyJoinAck(ack, intent);

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
    [applyJoinAck, requestMicrophone],
  );

  // -------------------------------------------------------------------------
  // Leave room.
  // -------------------------------------------------------------------------

  const leave = useCallback(async () => {
    const client = clientRef.current;

    // Request server-side removal first, but always clean up locally.
    try {
      if (
        client?.connected &&
        stateRef.current.sessionIntent
      ) {
        await client.request('room:leave', {});
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
      peersRef.current?.closeAll();
      audioRef.current?.dispose();

      worldRef.current.peers.clear();
      worldRef.current.edges.clear();
      worldRef.current.obstacles = [];
      worldRef.current.clusters = [];
      worldRef.current.room = null;

      worldRef.current.self = {
        ...worldRef.current.self,
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

  // -------------------------------------------------------------------------
  // Mute and unmute.
  // -------------------------------------------------------------------------

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;

    mutedRef.current = next;

    audioRef.current?.setLocalMuted(next);
    peersRef.current?.setMicEnabled(!next);

    localStreamRef.current
      ?.getAudioTracks()
      .forEach((track) => {
        track.enabled = !next;
      });

    clientRef.current?.emit('peer:media-ready', {
      micEnabled: !next,
    });

    dispatch({
      type: 'muted',
      muted: next,
    });
  }, []);

  // -------------------------------------------------------------------------
  // Master volume.
  // -------------------------------------------------------------------------

  const setVolume = useCallback((volume) => {
    audioRef.current?.setMasterVolume(volume);

    dispatch({
      type: 'volume',
      volume,
    });
  }, []);

  // -------------------------------------------------------------------------
  // Position updates.
  // -------------------------------------------------------------------------

  const sendPosition = useCallback((x, y, angle) => {
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
  }, []);

  // -------------------------------------------------------------------------
  // Spatial audit.
  // -------------------------------------------------------------------------

  const requestAudit = useCallback(async () => {
    const self = worldRef.current.self;

    const params = new URLSearchParams({
      roomId:
        worldRef.current.room?.roomId ??
        config.defaultRoom,
      x: String(Math.round(self.x)),
      y: String(Math.round(self.y)),
      radius: String(worldRef.current.earshotRadiusPx),
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
            ? `Spatial audit PASSED — $near p95 ${report.queries.near.p95Ms}ms, ${report.accuracy.matchedPeers} peers in earshot`
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
  }, []);

  // -------------------------------------------------------------------------
  // Keep audio settings synchronized with React state.
  // -------------------------------------------------------------------------

  useEffect(() => {
    audioRef.current?.setMasterVolume(state.masterVolume);
    audioRef.current?.setLocalMuted(state.muted);
  }, [state.masterVolume, state.muted]);

  // -------------------------------------------------------------------------
  // Context API.
  // -------------------------------------------------------------------------

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