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
  return [
    {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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
      const { self, room, peers, config: serverConfig } =
        action.payload;

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
        roster: (peers ?? []).map((peer) => ({
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

  const stateRef = useRef(state);
  stateRef.current = state;

  const mutedRef = useRef(state.muted);
  mutedRef.current = state.muted;

  // ---------------------------------------------------------------------------
  // Roster projection
  // ---------------------------------------------------------------------------

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

  const publishRoster = useCallback(() => {
    dispatch({
      type: 'roster',
      roster: syncRoster(worldRef.current),
    });
  }, [syncRoster]);

  // ---------------------------------------------------------------------------
  // Heartbeat
  // ---------------------------------------------------------------------------

  const startHeartbeat = useCallback((intervalMs) => {
    clearInterval(heartbeatRef.current);

    heartbeatRef.current = setInterval(() => {
      clientRef.current?.emit('presence:heartbeat', {});
    }, Math.max(2000, intervalMs));
  }, []);

  // ---------------------------------------------------------------------------
  // Join acknowledgement handling
  // ---------------------------------------------------------------------------

  const applyJoinAck = useCallback(
    (ack, intent) => {
      if (!ack?.self?.id || !ack?.room) {
        throw new Error('The server returned an invalid room join response.');
      }

      const world = worldRef.current;
      const manager = peersRef.current;
      const audio = audioRef.current;

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

      world.room = ack.room;
      world.obstacles = ack.room.obstacles ?? [];
      world.earshotRadiusPx =
        ack.config?.earshotRadiusPx ??
        config.audio.earshotRadiusPx;

      const incomingPeers = new Map();

      for (const peer of ack.peers ?? []) {
        if (!peer?.id || peer.id === world.self.id) {
          continue;
        }

        const previous = world.peers.get(peer.id);

        incomingPeers.set(peer.id, {
          ...previous,
          ...peer,
          level: previous?.level ?? 0,
          speaking: previous?.speaking ?? false,
          soundFactor: previous?.soundFactor ?? 1,
          connection:
            previous?.connection ?? 'pending',
        });
      }

      // Close only connections that do not belong to the new room roster.
      // Do not close the PeerManager itself; it must remain reusable.
      if (manager) {
        for (const peerId of [...manager.connections.keys()]) {
          if (!incomingPeers.has(peerId)) {
            manager.handleHangup({ peerId });
            audio?.detachRemoteStream(peerId);
          }
        }
      }

      for (const peerId of [...world.edges.keys()]) {
        if (!incomingPeers.has(peerId)) {
          world.edges.delete(peerId);
          audio?.detachRemoteStream(peerId);
        }
      }

      world.peers = incomingPeers;

      if (ack.config?.iceServers?.length && manager) {
        manager.iceServers = ack.config.iceServers;
      }

      if (ack.config?.heartbeatIntervalMs) {
        startHeartbeat(ack.config.heartbeatIntervalMs);
      } else {
        startHeartbeat(config.network.heartbeatMs);
      }

      // Keep client-side occlusion consistent with room geometry.
      for (const peer of world.peers.values()) {
        peer.soundFactor = soundFactorBetween(
          world.self,
          peer,
          world.obstacles,
        ).soundFactor;

        audio?.setPeerOcclusion(
          peer.id,
          peer.soundFactor,
        );
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
    [startHeartbeat, syncRoster],
  );

  // ---------------------------------------------------------------------------
  // Reconnection
  // ---------------------------------------------------------------------------

  const rejoinAfterReconnect = useCallback(async () => {
    const client = clientRef.current;
    const intent = stateRef.current.sessionIntent;

    if (!client?.connected || !intent) {
      return;
    }

    try {
      const ack = await client.request('room:join', {
        roomId: intent.roomId,
        name: intent.name,
        color: intent.color,
        avatar: intent.avatar,
      });

      applyJoinAck(ack, intent);

      const stream = localStreamRef.current;
      const hasUsableMicrophone = Boolean(
        stream?.getAudioTracks?.().some(
          (track) => track.readyState === 'live',
        ),
      );

      if (hasUsableMicrophone) {
        stream.getAudioTracks().forEach((track) => {
          track.enabled = !mutedRef.current;
        });

        peersRef.current?.setMicEnabled(!mutedRef.current);

        client.emit('peer:media-ready', {
          micEnabled: !mutedRef.current,
        });
      } else {
        client.emit('peer:media-ready', {
          micEnabled: false,
        });
      }

      client.emit('presence:request-sync', {
        roomId: intent.roomId,
      });

      dispatch({
        type: 'notice',
        notice: {
          level: 'ok',
          message: 'Reconnected to the office.',
        },
      });
    } catch (error) {
      dispatch({
        type: 'notice',
        notice: {
          level: 'error',
          message: `Rejoin failed: ${error.message}`,
        },
      });
    }
  }, [applyJoinAck]);

  // ---------------------------------------------------------------------------
  // Socket, spatial audio and WebRTC initialization
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let disposed = false;

    const client = createSocketClient({ url: serverUrl });
    clientRef.current = client;

    const audio = new SpatialAudioEngine({
      // These names match SpatialAudioEngine's actual options.
      earshotPx: config.audio.earshotRadiusPx,
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

    const manager = new PeerManager({
      socket: client.socket,
      iceServers: [],
      getLocalStream: () => localStreamRef.current,

      onTrack(peerId, stream) {
        if (disposed) {
          return;
        }

        audio.attachRemoteStream(peerId, stream);

        const peer = worldRef.current.peers.get(peerId);

        if (peer) {
          peer.connection = 'connected';
        }

        publishRoster();
      },

      onConnectionChange(peerId, connectionState) {
        if (disposed) {
          return;
        }

        const world = worldRef.current;
        const peer = world.peers.get(peerId);

        if (peer) {
          peer.connection = connectionState;
        }

        if (
          connectionState === 'closed:hangup' ||
          connectionState === 'closed:replaced' ||
          connectionState === 'closed:shutdown'
        ) {
          audio.detachRemoteStream(peerId);
          world.edges.delete(peerId);
          world.peers.delete(peerId);
        }

        publishRoster();
      },

      onError(message) {
        if (disposed) {
          return;
        }

        dispatch({
          type: 'notice',
          notice: {
            level: 'warn',
            message,
          },
        });
      },
    });

    peersRef.current = manager;

    client.onStatus((status, detail) => {
      if (disposed) {
        return;
      }

      dispatch({
        type: 'status',
        status,
        detail: detail ?? '',
      });

      if (status === 'online') {
        void rejoinAfterReconnect();
      }
    });

    client.on('system:hello', (payload = {}) => {
      dispatch({
        type: 'server',
        server: {
          instanceId: payload.instanceId ?? '',
          scaleMode: payload.scaleMode ?? '',
        },
      });
    });

    client.on('system:error', (payload = {}) => {
      dispatch({
        type: 'notice',
        notice: {
          level: 'error',
          message: payload.message ?? 'Server error',
        },
      });
    });

    // Peer joined.
    client.on('peer:joined', ({ peer } = {}) => {
      if (!peer?.id || peer.id === worldRef.current.self.id) {
        return;
      }

      const world = worldRef.current;
      const previous = world.peers.get(peer.id);

      world.peers.set(peer.id, {
        ...previous,
        ...peer,
        level: previous?.level ?? 0,
        speaking: previous?.speaking ?? false,
        soundFactor: previous?.soundFactor ?? 1,
        connection: previous?.connection ?? 'pending',
      });

      publishRoster();

      dispatch({
        type: 'notice',
        notice: {
          level: 'info',
          message: `${peer.name} joined the office`,
        },
      });
    });

    // Peer left.
    client.on('peer:left', ({ id, reason } = {}) => {
      if (!id) {
        return;
      }

      const world = worldRef.current;
      const peer = world.peers.get(id);

      world.peers.delete(id);
      world.edges.delete(id);
      audio.detachRemoteStream(id);

      if (manager.connections.has(id)) {
        manager.handleHangup({ peerId: id });
      }

      publishRoster();

      if (peer) {
        dispatch({
          type: 'notice',
          notice: {
            level: 'info',
            message: `${peer.name} left${reason ? ` (${reason})` : ''}`,
          },
        });
      }
    });

    // Movement updates are hot-path data: avoid React renders here.
    client.socket.on('presence:moved', (payload = {}) => {
      if (!payload.id) {
        return;
      }

      const world = worldRef.current;
      const peer = world.peers.get(payload.id);

      if (!peer) {
        return;
      }

      if (Number.isFinite(payload.x)) {
        peer.x = payload.x;
      }

      if (Number.isFinite(payload.y)) {
        peer.y = payload.y;
      }

      if (Number.isFinite(payload.angle)) {
        peer.angle = payload.angle;
      }

      peer.distancePx = Math.hypot(
        peer.x - world.self.x,
        peer.y - world.self.y,
      );
    });

    // Authoritative roster reconciliation.
    client.socket.on(
      'presence:snapshot',
      (payload = {}) => {
        if (disposed) {
          return;
        }

        const world = worldRef.current;

        // Do not apply another room's snapshot.
        if (
          payload.roomId &&
          world.room?.roomId &&
          payload.roomId !== world.room.roomId
        ) {
          return;
        }

        if (!Array.isArray(payload.peers)) {
          return;
        }

        const snapshots = payload.peers.filter(
          (peer) =>
            peer &&
            typeof peer.id === 'string' &&
            peer.id !== world.self.id,
        );

        const livePeerIds = new Set(
          snapshots.map((peer) => peer.id),
        );

        const knownPeerIds = new Set([
          ...world.peers.keys(),
          ...manager.connections.keys(),
          ...world.edges.keys(),
        ]);

        for (const peerId of knownPeerIds) {
          if (livePeerIds.has(peerId)) {
            continue;
          }

          world.peers.delete(peerId);
          world.edges.delete(peerId);
          audio.detachRemoteStream(peerId);

          if (manager.connections.has(peerId)) {
            manager.handleHangup({ peerId });
          }
        }

        const nextPeers = new Map();

        for (const snapshotPeer of snapshots) {
          const previous = world.peers.get(snapshotPeer.id);

          const peer = {
            ...previous,
            ...snapshotPeer,
            level: previous?.level ?? 0,
            speaking: previous?.speaking ?? false,
            soundFactor:
              previous?.soundFactor ??
              world.edges.get(snapshotPeer.id)?.soundFactor ??
              1,
            connection:
              previous?.connection ?? 'pending',
          };

          peer.distancePx = Math.hypot(
            (peer.x ?? 0) - world.self.x,
            (peer.y ?? 0) - world.self.y,
          );

          nextPeers.set(peer.id, peer);
        }

        world.peers = nextPeers;

        dispatch({
          type: 'roster',
          roster: syncRoster(world),
        });
      },
    );

    // Remote microphone state.
    client.on(
      'peer:media-state',
      ({ id, micEnabled } = {}) => {
        const peer = worldRef.current.peers.get(id);

        if (peer) {
          peer.micEnabled = micEnabled;
          publishRoster();
        }
      },
    );

    // Server-authorized WebRTC negotiation.
    client.on('peer:negotiate', (payload) => {
      if (!payload?.peer?.id) {
        return;
      }

      const world = worldRef.current;
      const peerId = payload.peer.id;
      const previous = world.peers.get(peerId);

      world.peers.set(peerId, {
        ...previous,
        ...payload.peer,
        level: previous?.level ?? 0,
        speaking: previous?.speaking ?? false,
        soundFactor: payload.soundFactor ?? 1,
        connection: previous?.connection ?? 'pending',
      });

      world.edges.set(peerId, {
        generation: payload.generation,
        soundFactor: payload.soundFactor ?? 1,
      });

      audio.setPeerOcclusion(
        peerId,
        payload.soundFactor ?? 1,
      );

      publishRoster();
      void manager.handleNegotiate(payload);
    });

    client.on('peer:signal', (payload) => {
      void manager.handleSignal(payload);
    });

    client.on('peer:hangup', ({ peerId } = {}) => {
      if (!peerId) {
        return;
      }

      const world = worldRef.current;

      world.edges.delete(peerId);
      audio.detachRemoteStream(peerId);

      if (manager.connections.has(peerId)) {
        manager.handleHangup({ peerId });
      }

      // Keep the peer in the room roster. A hangup can mean that the peer
      // moved out of earshot, not that the peer left the room.
      const peer = world.peers.get(peerId);

      if (peer) {
        peer.connection = 'pending';
      }

      publishRoster();
    });

    // Spatial audio occlusion updates.
    client.on(
      'peer:audio-obstruction',
      ({ peerId, soundFactor } = {}) => {
        if (!peerId || !Number.isFinite(soundFactor)) {
          return;
        }

        const world = worldRef.current;
        const edge = world.edges.get(peerId);
        const peer = world.peers.get(peerId);

        if (edge) {
          edge.soundFactor = soundFactor;
        }

        if (peer) {
          peer.soundFactor = soundFactor;
        }

        audio.setPeerOcclusion(peerId, soundFactor);
      },
    );

    client.on('presence:clusters', ({ clusters } = {}) => {
      if (!Array.isArray(clusters)) {
        return;
      }

      worldRef.current.clusters = clusters;

      dispatch({
        type: 'clusters',
        clusters,
      });
    });

    client.on('audit:completed', (payload = {}) => {
      dispatch({
        type: 'notice',
        notice: {
          level: payload.withinBudget ? 'ok' : 'error',
          message:
            `Spatial audit: p95 ${payload.p95Ms ?? 'n/a'}ms · ` +
            `${payload.matched ?? 0} peers in earshot · ` +
            `${payload.withinBudget ? 'within' : 'over'} budget`,
        },
      });

      dispatch({
        type: 'stats',
        stats: {
          audit: payload,
        },
      });
    });

    client.on('audit:remote', (payload = {}) => {
      dispatch({
        type: 'notice',
        notice: {
          level: payload.ok ? 'ok' : 'warn',
          message:
            `Remote audit · p95 ${payload.p95Ms ?? 'n/a'}ms`,
        },
      });
    });

    dispatch({
      type: 'status',
      status: 'connecting',
    });

    return () => {
      disposed = true;

      clearInterval(heartbeatRef.current);

      // This is provider teardown, so permanently close this manager.
      manager.closeAll();
      audio.dispose();
      client.disconnect();

      if (clientRef.current === client) {
        clientRef.current = null;
      }

      if (peersRef.current === manager) {
        peersRef.current = null;
      }

      if (audioRef.current === audio) {
        audioRef.current = null;
      }
    };
  }, [
    serverUrl,
    applyJoinAck,
    publishRoster,
    rejoinAfterReconnect,
    syncRoster,
    startHeartbeat,
  ]);

  // ---------------------------------------------------------------------------
  // Microphone
  // ---------------------------------------------------------------------------

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
        'Microphone access requires a supported browser and secure context.',
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
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
        video: false,
      });

      localStreamRef.current = stream;

      await audioRef.current?.setLocalStream(stream);

      stream.getAudioTracks().forEach((track) => {
        track.enabled = !mutedRef.current;
      });

      const track = stream.getAudioTracks()[0];

      dispatch({
        type: 'mic',
        mic: {
          state: 'ready',
          error: null,
          device: track?.label ?? 'Default microphone',
        },
      });

      return stream;
    } catch (error) {
      const message =
        error?.name === 'NotAllowedError'
          ? 'Microphone permission was denied. Allow access in your browser settings or continue in listen-only mode.'
          : error?.name === 'NotFoundError'
            ? 'No microphone was found on this device.'
            : `Microphone unavailable: ${error?.message ?? error}`;

      dispatch({
        type: 'mic',
        mic: {
          state: 'denied',
          error: message,
        },
      });

      throw Object.assign(new Error(message), {
        cause: error,
      });
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Join room
  // ---------------------------------------------------------------------------

  const join = useCallback(
    async ({
      roomId = config.defaultRoom,
      name,
      color = '#4f8cff',
      avatar = 'circle',
      withMic = true,
    }) => {
      const client = clientRef.current;

      if (!client?.connected) {
        throw new Error('The server connection is not ready. Try again.');
      }

      const displayName =
        (name || '').trim() ||
        `Guest ${Math.floor(Math.random() * 900 + 100)}`;

      const intent = {
        roomId,
        name: displayName,
        color,
        avatar,
      };

      // Resume Web Audio in the user gesture before connecting streams.
      await audioRef.current?.init().catch(() => {});

      if (withMic) {
        const existingTracks =
          localStreamRef.current?.getAudioTracks?.() ?? [];

        const hasLiveTrack = existingTracks.some(
          (track) => track.readyState === 'live',
        );

        if (!hasLiveTrack) {
          try {
            await requestMicrophone();
          } catch {
            // Listen-only joining is supported.
          }
        }
      }

      try {
        const ack = await client.request('room:join', intent);

        applyJoinAck(ack, intent);

        const stream = localStreamRef.current;
        const micAvailable = Boolean(
          stream?.getAudioTracks?.().some(
            (track) => track.readyState === 'live',
          ),
        );

        stream?.getAudioTracks().forEach((track) => {
          track.enabled = micAvailable && !mutedRef.current;
        });

        peersRef.current?.setMicEnabled(
          micAvailable && !mutedRef.current,
        );

        client.emit('peer:media-ready', {
          micEnabled: micAvailable && !mutedRef.current,
        });

        client.emit('presence:request-sync', { roomId });

        dispatch({
          type: 'mic',
          mic: {
            state: micAvailable
              ? 'ready'
              : 'listen-only',
          },
        });

        return ack;
      } catch (error) {
        dispatch({
          type: 'notice',
          notice: {
            level: 'error',
            message: `Could not join: ${error.message}`,
          },
        });

        throw error;
      }
    },
    [applyJoinAck, requestMicrophone],
  );

  // ---------------------------------------------------------------------------
  // Leave room
  // ---------------------------------------------------------------------------

  const leave = useCallback(async () => {
    const client = clientRef.current;
    const manager = peersRef.current;
    const audio = audioRef.current;

    try {
      if (
        client?.connected &&
        stateRef.current.sessionIntent
      ) {
        await client.request('room:leave', {});
      }
    } catch (error) {
      dispatch({
        type: 'notice',
        notice: {
          level: 'warn',
          message: `Server leave confirmation failed: ${error.message}`,
        },
      });
    } finally {
      // Do not call manager.closeAll() here. That permanently closes the
      // PeerManager and prevents a later join from negotiating new peers.
      if (manager) {
        for (const peerId of [...manager.connections.keys()]) {
          manager.handleHangup({ peerId });
        }
      }

      for (const peerId of [...worldRef.current.peers.keys()]) {
        audio?.detachRemoteStream(peerId);
      }

      // Disable the microphone while outside the office. Retain the stream
      // and AudioContext so a subsequent join can reuse them safely.
      localStreamRef.current
        ?.getAudioTracks()
        .forEach((track) => {
          track.enabled = false;
        });

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

      clearInterval(heartbeatRef.current);

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

  // ---------------------------------------------------------------------------
  // Mute
  // ---------------------------------------------------------------------------

  const toggleMute = useCallback(() => {
    const nextMuted = !mutedRef.current;
    mutedRef.current = nextMuted;

    audioRef.current?.setLocalMuted(nextMuted);

    localStreamRef.current
      ?.getAudioTracks()
      .forEach((track) => {
        track.enabled = !nextMuted;
      });

    peersRef.current?.setMicEnabled(!nextMuted);

    if (stateRef.current.sessionIntent) {
      clientRef.current?.emit('peer:media-ready', {
        micEnabled:
          Boolean(
            localStreamRef.current
              ?.getAudioTracks()
              .some((track) => track.readyState === 'live'),
          ) && !nextMuted,
      });
    }

    dispatch({
      type: 'muted',
      muted: nextMuted,
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Volume
  // ---------------------------------------------------------------------------

  const setVolume = useCallback((volume) => {
    const normalizedVolume = Math.max(
      0,
      Math.min(1, Number(volume) || 0),
    );

    audioRef.current?.setMasterVolume(normalizedVolume);

    dispatch({
      type: 'volume',
      volume: normalizedVolume,
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Position updates
  // ---------------------------------------------------------------------------

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
      { x, y, angle },
      (ack) => {
        if (!ack?.ok) {
          return;
        }

        if (
          Number.isFinite(ack.x) &&
          Number.isFinite(ack.y)
        ) {
          worldRef.current.self.authority = {
            x: ack.x,
            y: ack.y,
          };
        }
      },
    );
  }, []);

  // ---------------------------------------------------------------------------
  // Spatial audit
  // ---------------------------------------------------------------------------

  const requestAudit = useCallback(async () => {
    const world = worldRef.current;
    const self = world.self;

    const params = new URLSearchParams({
      roomId: world.room?.roomId ?? config.defaultRoom,
      x: String(Math.round(self.x)),
      y: String(Math.round(self.y)),
      radius: String(world.earshotRadiusPx),
      samples: '25',
    });

    try {
      const response = await fetch(
        `${serverUrl}/api/spatial-audit?${params}`,
      );

      const report = await response.json();

      if (!response.ok) {
        throw new Error(
          report.message ??
          report.error ??
          `Audit request failed with HTTP ${response.status}`,
        );
      }

      dispatch({
        type: 'stats',
        stats: {
          audit: report,
        },
      });

      const p95 =
        report.queries?.near?.p95Ms ??
        report.p95Ms ??
        'n/a';

      const matched =
        report.accuracy?.matchedPeers ??
        report.matched ??
        0;

      dispatch({
        type: 'notice',
        notice: {
          level: report.ok ? 'ok' : 'error',
          message: report.ok
            ? `Spatial audit passed — p95 ${p95}ms, ${matched} peers in earshot`
            : `Spatial audit failed — p95 ${p95}ms`,
        },
      });

      return report;
    } catch (error) {
      dispatch({
        type: 'notice',
        notice: {
          level: 'error',
          message: `Audit request failed: ${error.message}`,
        },
      });

      throw error;
    }
  }, [serverUrl]);

  // ---------------------------------------------------------------------------
  // Keep audio settings synchronized with React state
  // ---------------------------------------------------------------------------

  useEffect(() => {
    audioRef.current?.setMasterVolume(state.masterVolume);
    audioRef.current?.setLocalMuted(state.muted);
  }, [state.masterVolume, state.muted]);

  // ---------------------------------------------------------------------------
  // Context value
  // ---------------------------------------------------------------------------

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