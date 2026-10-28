/**
 * WebRTC mesh client (Week 2 + 3).
 *
 * The server decides who may talk to whom and who creates the offer.
 *
 * Safety:
 * 1. STALE SIGNALS — older connection generations are ignored.
 * 2. ICE RACE — candidates are queued until the remote description exists.
 * 3. DEAD LINKS — failed connections attempt an ICE restart.
 *
 * Lifecycle:
 * - handleNegotiate() creates connections for eligible peers.
 * - handleHangup() closes an individual peer connection.
 * - closeAll() closes all connections and disables this manager.
 * - reset() prepares the manager for a subsequent room session.
 */

export class PeerManager {
  constructor({
    socket,
    iceServers = [{ urls: 'stun:stun.l.google.com:19302' }],
    getLocalStream,
    onTrack,
    onConnectionChange,
    onStats,
    onError,
  }) {
    this.socket = socket;
    this.iceServers = iceServers;
    this.getLocalStream = getLocalStream;
    this.onTrack = onTrack;
    this.onConnectionChange = onConnectionChange;
    this.onStats = onStats;
    this.onError = onError;

    this.connections = new Map();
    this.closed = false;
    this.statsTimer = null;
  }

  get size() {
    return this.connections.size;
  }

  #send(peerId, data) {
    if (this.closed || !this.socket?.connected) return;

    this.socket.emit('peer:signal', {
      to: peerId,
      data,
    });
  }

  #createConnection(peer, generation) {
    if (this.closed) return null;

    const previous = this.connections.get(peer.id);

    if (previous) {
      this.#closeConnection(previous, 'replaced');
    }

    const pc = new RTCPeerConnection({
      iceServers: this.iceServers,
      bundlePolicy: 'max-bundle',
    });

    const connection = {
      id: peer.id,
      generation,
      peer,
      pc,
      pendingCandidates: [],
      hasRemoteDescription: false,
      makingOffer: false,
      ignoreOffer: false,
      polite: false,
      restartingIce: false,
      stats: null,
    };

    this.connections.set(peer.id, connection);

    const stream = this.getLocalStream();

    if (stream) {
      for (const track of stream.getAudioTracks()) {
        pc.addTrack(track, stream);
      }
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.#send(peer.id, {
          type: 'candidate',
          candidate: event.candidate.toJSON(),
        });
      }
    };

    pc.ontrack = (event) => {
      const [remote] = event.streams;

      this.onTrack?.(
        peer.id,
        remote ?? new MediaStream([event.track]),
        connection,
      );
    };

    pc.onconnectionstatechange = () => {
      if (this.connections.get(peer.id) !== connection) return;

      const state = pc.connectionState;

      connection.state = state;
      this.onConnectionChange?.(peer.id, state);

      if (state === 'failed' && !connection.restartingIce) {
        connection.restartingIce = true;
        void this.#restartIce(connection);
      }

      if (state === 'closed') {
        this.#closeConnection(connection, 'connection-closed');
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (this.connections.get(peer.id) !== connection) return;

      if (
        pc.iceConnectionState === 'failed' &&
        !connection.restartingIce
      ) {
        connection.restartingIce = true;
        void this.#restartIce(connection);
      }
    };

    return connection;
  }

  async #makeOffer(connection) {
    try {
      if (!this.#isCurrent(connection)) return;

      connection.makingOffer = true;

      const offer = await connection.pc.createOffer();

      if (!this.#isCurrent(connection)) return;

      await connection.pc.setLocalDescription(offer);

      if (
        this.#isCurrent(connection) &&
        connection.pc.localDescription
      ) {
        this.#send(connection.id, {
          type: 'offer',
          sdp: connection.pc.localDescription.sdp,
        });
      }
    } catch (err) {
      if (this.#isCurrent(connection)) {
        this.onError?.(
          `offer to ${connection.id} failed: ${err.message}`,
        );
      }
    } finally {
      connection.makingOffer = false;
    }
  }

  async #restartIce(connection) {
    try {
      if (!this.#isCurrent(connection)) return;

      const offer = await connection.pc.createOffer({
        iceRestart: true,
      });

      if (!this.#isCurrent(connection)) return;

      await connection.pc.setLocalDescription(offer);

      if (
        this.#isCurrent(connection) &&
        connection.pc.localDescription
      ) {
        this.#send(connection.id, {
          type: 'offer',
          sdp: connection.pc.localDescription.sdp,
        });
      }
    } catch (err) {
      if (!this.#isCurrent(connection)) return;

      this.onError?.(
        `ICE restart with ${connection.id} failed: ${err.message}`,
      );

      this.#closeConnection(connection, 'ice-restart-failed');
    }
  }

  async #flushCandidates(connection) {
    const queued = connection.pendingCandidates;
    connection.pendingCandidates = [];

    for (const candidate of queued) {
      if (!this.#isCurrent(connection)) return;

      try {
        await connection.pc.addIceCandidate(candidate);
      } catch (err) {
        if (this.#isCurrent(connection)) {
          this.onError?.(
            `late ICE candidate for ${connection.id} rejected: ${err.message}`,
          );
        }
      }
    }
  }

  #isCurrent(connection) {
    return (
      !this.closed &&
      this.connections.get(connection.id) === connection
    );
  }

  /** `peer:negotiate` — the server opened or reopened an edge. */
  async handleNegotiate({
    peer,
    generation,
    initiator,
    soundFactor,
  }) {
    if (this.closed || !peer?.id) return;

    const existing = this.connections.get(peer.id);

    if (existing && existing.generation > generation) return;

    if (
      existing &&
      existing.generation === generation &&
      existing.pc.connectionState !== 'failed'
    ) {
      return;
    }

    const connection = this.#createConnection(peer, generation);

    if (!connection) return;

    connection.soundFactor = soundFactor;

    if (initiator) {
      await this.#makeOffer(connection);
    }
  }

  /** `peer:signal` — relayed offer, answer or ICE candidate. */
  async handleSignal({ from, data, generation }) {
    if (this.closed || !from || !data?.type) return;

    let connection = this.connections.get(from);

    if (!connection && data.type === 'offer') {
      connection = this.#createConnection(
        {
          id: from,
          name: 'peer',
          color: '#8899aa',
        },
        generation ?? 0,
      );

      if (!connection) return;

      await this.#makeOfferAnswer(connection, data);
      return;
    }

    if (!connection) return;

    if (
      typeof generation === 'number' &&
      generation < connection.generation
    ) {
      return;
    }

    try {
      if (data.type === 'offer') {
        await this.#makeOfferAnswer(connection, data);
      } else if (data.type === 'answer') {
        if (
          connection.pc.signalingState !== 'have-local-offer'
        ) {
          return;
        }

        await connection.pc.setRemoteDescription({
          type: 'answer',
          sdp: data.sdp,
        });

        if (!this.#isCurrent(connection)) return;

        connection.hasRemoteDescription = true;

        await this.#flushCandidates(connection);
        this.#scheduleStats(connection);
      } else if (data.type === 'candidate') {
        if (!data.candidate) return;

        if (!connection.hasRemoteDescription) {
          connection.pendingCandidates.push(data.candidate);
          return;
        }

        await connection.pc.addIceCandidate(data.candidate);
      }
    } catch (err) {
      if (this.#isCurrent(connection)) {
        this.onError?.(
          `signal from ${from} (${data.type}) failed: ${err.message}`,
        );
      }
    }
  }

  async #makeOfferAnswer(connection, data) {
    if (!this.#isCurrent(connection)) return;

    const offerCollision =
      connection.makingOffer ||
      connection.pc.signalingState !== 'stable';

    connection.ignoreOffer =
      !connection.polite && offerCollision;

    if (connection.ignoreOffer) return;

    await connection.pc.setRemoteDescription({
      type: 'offer',
      sdp: data.sdp,
    });

    if (!this.#isCurrent(connection)) return;

    connection.hasRemoteDescription = true;

    await this.#flushCandidates(connection);

    if (!this.#isCurrent(connection)) return;

    const answer = await connection.pc.createAnswer();

    if (!this.#isCurrent(connection)) return;

    await connection.pc.setLocalDescription(answer);

    if (
      this.#isCurrent(connection) &&
      connection.pc.localDescription
    ) {
      this.#send(connection.id, {
        type: 'answer',
        sdp: connection.pc.localDescription.sdp,
      });
    }
  }

  /** `peer:hangup` — close an individual connection. */
  handleHangup({ peerId }) {
    const connection = this.connections.get(peerId);

    if (!connection) return;

    this.#closeConnection(connection, 'hangup');
  }

  #closeConnection(connection, reason) {
    if (!connection) return;

    if (this.connections.get(connection.id) === connection) {
      this.connections.delete(connection.id);
    }

    try {
      connection.pc.onicecandidate = null;
      connection.pc.ontrack = null;
      connection.pc.onconnectionstatechange = null;
      connection.pc.oniceconnectionstatechange = null;
      connection.pc.close();
    } catch {
      // The connection may already be closed.
    }

    this.onConnectionChange?.(
      connection.id,
      `closed:${reason}`,
    );

    if (this.connections.size === 0) {
      this.#clearStatsTimer();
    }
  }

  #clearStatsTimer() {
    if (this.statsTimer) {
      clearTimeout(this.statsTimer);
      this.statsTimer = null;
    }
  }

  #scheduleStats(connection) {
    if (!this.onStats || !this.#isCurrent(connection)) return;

    this.#clearStatsTimer();

    const collect = async () => {
      this.statsTimer = null;

      if (!this.#isCurrent(connection)) return;

      try {
        const report = await connection.pc.getStats();

        if (!this.#isCurrent(connection)) return;

        let inbound = null;
        let outbound = null;
        let candidatePair = null;

        report.forEach((entry) => {
          if (
            entry.type === 'inbound-rtp' &&
            (entry.kind === 'audio' || entry.mediaType === 'audio')
          ) {
            inbound = entry;
          }

          if (
            entry.type === 'outbound-rtp' &&
            (entry.kind === 'audio' || entry.mediaType === 'audio')
          ) {
            outbound = entry;
          }

          if (
            entry.type === 'candidate-pair' &&
            entry.state === 'succeeded' &&
            entry.nominated
          ) {
            candidatePair = entry;
          }
        });

        connection.stats = {
          rtt: candidatePair?.currentRoundTripTime ?? 0,
          jitter: inbound?.jitter ?? 0,
          packetsLost: inbound?.packetsLost ?? 0,
          bytesReceived: inbound?.bytesReceived ?? 0,
          kbpsSent: outbound
            ? Math.round(
                ((outbound.bytesSent ?? 0) * 8) / 1000,
              )
            : 0,
        };

        this.onStats(connection.id, connection.stats);
      } catch {
        // Statistics are best-effort.
      }

      if (this.#isCurrent(connection)) {
        this.statsTimer = setTimeout(collect, 2000);
      }
    };

    this.statsTimer = setTimeout(collect, 2000);
  }

  /** Swap the outgoing audio track after a device change. */
  async replaceOutgoingTrack(nextStream) {
    const senderTrack =
      nextStream?.getAudioTracks?.()[0] ?? null;

    for (const connection of this.connections.values()) {
      if (!this.#isCurrent(connection)) continue;

      const sender = connection.pc
        .getSenders()
        .find((item) => item.track?.kind === 'audio');

      if (sender) {
        await sender.replaceTrack(senderTrack).catch(() => {});
      }
    }
  }

  /** Enable or disable local microphone tracks. */
  setMicEnabled(enabled) {
    const stream = this.getLocalStream();

    for (const track of stream?.getAudioTracks?.() ?? []) {
      track.enabled = enabled;
    }
  }

  /** Return a diagnostic snapshot of active peer connections. */
  snapshot() {
    return [...this.connections.values()].map((connection) => ({
      id: connection.id,
      generation: connection.generation,
      state: connection.pc.connectionState,
      iceState: connection.pc.iceConnectionState,
      signaling: connection.pc.signalingState,
      soundFactor: connection.soundFactor ?? 1,
      stats: connection.stats,
    }));
  }

  /**
   * Close all peer connections and disable this manager.
   * Call reset() to reuse it for another room session.
   */
  closeAll() {
    this.closed = true;
    this.#clearStatsTimer();

    for (const connection of [...this.connections.values()]) {
      this.#closeConnection(connection, 'shutdown');
    }

    this.connections.clear();
  }

  /**
   * Prepare the manager for another room session.
   *
   * Socket listeners and callbacks are preserved; old peer connections
   * are discarded, and new negotiations can create fresh connections.
   */
  reset({ iceServers = this.iceServers } = {}) {
    this.#clearStatsTimer();

    for (const connection of [...this.connections.values()]) {
      this.#closeConnection(connection, 'replaced');
    }

    this.connections.clear();
    this.iceServers = iceServers;
    this.closed = false;
  }
}

export default PeerManager;