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

import {
  saveActiveMeeting,
  getActiveMeeting,
  clearActiveMeeting,
} from '../utils/meetingSessionStorage.js';

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
      clientRef.current?.emit('presence:heartbeat', {});
    }, Math.max(2000, intervalMs));
  }, []);

  const applyJoinAck = useCallback(
    (ack, intent) => {
      const world = worldRef.current;

      /*
       * Persist only after the server has acknowledged
       * a successful room join.
       */
      saveActiveMeeting(intent);

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
        audioRef.current?.detachRemoteStream(peerId);
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
        startHeartbeat(ack.config.heartbeatIntervalMs);
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
   * Restore a previously active meeting after:
   * - Initial socket connection following page refresh.
   * - Socket.IO reconnection after network interruption.
   *
   * The persisted room must match the room in the URL.
   */
  const rejoinAfterReconnect = useCallback(async () => {
    const client = clientRef.current;

    let intent = stateRef.current.sessionIntent;

    if (!intent) {
      const persistedIntent = getActiveMeeting();

      const urlRoomId = new URLSearchParams(
        window.location.search,
      ).get('room');

      if (
        persistedIntent &&
        urlRoomId &&
        persistedIntent.roomId ===
          urlRoomId.trim().toLowerCase()
      ) {
        intent = persistedIntent;
      }
    }

    if (!client || !intent) {
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

      /*
       * If a microphone stream still exists after reconnecting,
       * ensure the newly negotiated peer connections receive its audio track.
       */
      if (localStreamRef.current) {
        await peersRef.current?.replaceOutgoingTrack(
          localStreamRef.current,
        );

        client.emit('peer:media-ready', {
          micEnabled: !mutedRef.current,
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
      /*
       * Preserve the saved intent after a failed reconnect.
       * A later Socket.IO reconnection can retry the join.
       */
      dispatch({
        type: 'notice',
        notice: {
          level: 'error',
          message: `Rejoin failed: ${err.message}`,
        },
      });
    }
  }, [applyJoinAck]);

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

        /*
         * A WebRTC connection closing is not equivalent to a user leaving
         * the room. Preserve room presence until the server confirms departure.
         */
        if (
          stateName === 'closed:hangup' ||
          stateName === 'closed:replaced'
        ) {
          audio.detachRemoteStream(peerId);
          world.edges.delete(peerId);

          const presentPeer = world.peers.get(peerId);

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

      if (!peer?.id || peer.id === world.self.id) {
        return;
      }

      world.peers.set(peer.id, {
        ...peer,
        level: 0,
        speaking: false,
        soundFactor: 1,
        connection: 'pending',
      });

      dispatch({
        type: 'roster',
        roster: syncRoster(world),
      });
    });

    client.on('peer:left', ({ id }) => {
      const world = worldRef.current;

      if (!id) {
        return;
      }

      audio.detachRemoteStream(id);
      peersRef.current?.closePeer(id);

      world.peers.delete(id);
      world.edges.delete(id);

      dispatch({
        type: 'roster',
        roster: syncRoster(world),
      });
    });

    client.on('presence:moved', (payload) => {
      const world = worldRef.current;

      if (!payload?.id || payload.id === world.self.id) {
        return;
      }

      const peer = world.peers.get(payload.id);

      if (!peer) {
        return;
      }

      Object.assign(peer, {
        x: payload.x,
        y: payload.y,
        angle: payload.angle ?? peer.angle ?? 0,
      });

      peer.soundFactor = soundFactorBetween(
        world.self,
        peer,
        world.obstacles,
      ).soundFactor;

      dispatch({
        type: 'roster',
        roster: syncRoster(world),
      });
    });

    client.on('presence:snapshot', (payload = {}) => {
      const world = worldRef.current;

      const peers = Array.isArray(payload.peers)
        ? payload.peers
        : [];

      const activeIds = new Set(
        peers.map((peer) => peer.id),
      );

      for (const peerId of world.peers.keys()) {
        if (!activeIds.has(peerId)) {
          audio.detachRemoteStream(peerId);
          peersRef.current?.closePeer(peerId);
          world.peers.delete(peerId);
          world.edges.delete(peerId);
        }
      }

      for (const peer of peers) {
        if (!peer?.id || peer.id === world.self.id) {
          continue;
        }

        const previous = world.peers.get(peer.id);

        world.peers.set(peer.id, {
          ...previous,
          ...peer,
          connection: previous?.connection ?? 'pending',
        });
      }

      dispatch({
        type: 'roster',
        roster: syncRoster(world),
      });
    });

    client.on('peer:media-state', ({ id, micEnabled }) => {
      const peer = worldRef.current.peers.get(id);

      if (!peer) {
        return;
      }

      peer.micEnabled = micEnabled;

      dispatch({
        type: 'roster',
        roster: syncRoster(worldRef.current),
      });
    });

    client.on('peer:avatar', (payload) => {
      const peer = worldRef.current.peers.get(payload?.id);

      if (!peer) {
        return;
      }

      peer.avatar = payload.peer.avatar;

      dispatch({
        type: 'roster',
        roster: syncRoster(worldRef.current),
      });
    });

    client.on('presence:clusters', (payload) => {
      dispatch({
        type: 'clusters',
        clusters: payload?.clusters ?? [],
      });
    });

    client.on('presence:edges', (payload) => {
      const world = worldRef.current;

      world.edges.clear();

      for (const edge of payload?.edges ?? []) {
        world.edges.set(edge.peerId, edge);
      }

      dispatch({
        type: 'stats',
        stats: {
          edges: world.edges.size,
        },
      });
    });

    client.on('presence:stats', (payload) => {
      dispatch({
        type: 'stats',
        stats: {
          remote: payload,
        },
      });
    });

    client.on('peer:offer', async (payload) => {
      try {
        await peersRef.current?.handleOffer(payload);
      } catch (err) {
        dispatch({
          type: 'notice',
          notice: {
            level: 'warn',
            message: `Peer offer failed: ${err.message}`,
          },
        });
      }
    });

    client.on('peer:answer', async (payload) => {
      try {
        await peersRef.current?.handleAnswer(payload);
      } catch (err) {
        dispatch({
          type: 'notice',
          notice: {
            level: 'warn',
            message: `Peer answer failed: ${err.message}`,
          },
        });
      }
    });

    client.on('peer:ice-candidate', async (payload) => {
      try {
        await peersRef.current?.handleIceCandidate(payload);
      } catch (err) {
        dispatch({
          type: 'notice',
          notice: {
            level: 'warn',
            message: `ICE candidate failed: ${err.message}`,
          },
        });
      }
    });

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

    return () => {
      clearInterval(heartbeatRef.current);

      peerManager.closeAll();
      audio.dispose();
      client.disconnect();

      clientRef.current = null;
      peersRef.current = null;
      audioRef.current = null;
    };
  }, [serverUrl, rejoinAfterReconnect, syncRoster]);

  const requestMicrophone = useCallback(async () => {
    dispatch({
      type: 'mic',
      mic: {
        state: 'requesting',
        error: null,
      },
    });

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          'Microphone access is not supported by this browser.',
        );
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      const track = stream.getAudioTracks()[0];

      if (!track) {
        stream.getTracks().forEach((item) => item.stop());

        throw new Error(
          'The selected microphone did not provide an audio track.',
        );
      }

      /*
       * Store the stream before updating peer connections.
       */
      localStreamRef.current = stream;

      const muted = mutedRef.current;

      track.enabled = !muted;

      audioRef.current?.setLocalStream(stream);
      audioRef.current?.setLocalMuted(muted);

      /*
       * Attach the microphone to existing WebRTC peer connections.
       * This also handles peers who joined before microphone permission
       * was granted.
       */
      await peersRef.current?.replaceOutgoingTrack(stream);

      /*
       * Publish the actual microphone state to the room server.
       */
      if (
        clientRef.current?.connected &&
        stateRef.current.sessionIntent
      ) {
        clientRef.current.emit('peer:media-ready', {
          micEnabled: !muted,
        });
      }

      dispatch({
        type: 'mic',
        mic: {
          state: 'ready',
          error: null,
          device: track.label || 'default microphone',
        },
      });

      return stream;
    } catch (err) {
      const message =
        err.name === 'NotAllowedError'
          ? 'Microphone permission was denied. Allow microphone access in your browser settings, then try again.'
          : err.name === 'NotFoundError'
            ? 'No microphone was found on this device.'
            : err.message || 'Unable to access microphone.';

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

      await audioRef.current?.init().catch(() => {});

      if (withMic && !localStreamRef.current) {
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
         * Room joining can create or recreate peer connections.
         * Reattach the stream after the join acknowledgement as well.
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
    [applyJoinAck, requestMicrophone],
  );

  const leave = useCallback(async () => {
    const client = clientRef.current;

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
          message: `Server leave confirmation failed: ${err.message}`,
        },
      });
    } finally {
      /*
       * An intentional leave must remove persisted meeting intent.
       */
      clearActiveMeeting();

      const world = worldRef.current;

      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;

      for (const peerId of world.peers.keys()) {
        audioRef.current?.detachRemoteStream(peerId);
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

  const setVolume = useCallback((volume) => {
    const normalizedVolume = Math.max(
      0,
      Math.min(1, Number(volume) || 0),
    );

    dispatch({
      type: 'volume',
      volume: normalizedVolume,
    });
  }, []);

  const sendPosition = useCallback((position) => {
    const client = clientRef.current;

    if (!client?.connected) {
      return;
    }

    const now = performance.now();

    const elapsed =
      now - sendRef.current.lastSentAt;

    const minimumInterval =
      config.network.positionSendIntervalMs;

    sendRef.current.pending = position;

    if (elapsed < minimumInterval) {
      return;
    }

    sendRef.current.lastSentAt = now;

    sendRef.current.send(position);
  }, []);

  const requestAudit = useCallback(async () => {
    const client = clientRef.current;

    if (!client?.connected) {
      throw new Error(
        'Cannot run spatial audit while disconnected.',
      );
    }

    try {
      const report = await client.request(
        'audit:request',
        {},
      );

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
  }, []);

  useEffect(() => {
    audioRef.current?.setMasterVolume(state.masterVolume);
    audioRef.current?.setLocalMuted(state.muted);
  }, [state.masterVolume, state.muted]);

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