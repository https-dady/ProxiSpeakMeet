/**
 * WebRTC mesh client.
 *
 * The server decides which peers may communicate and which peer
 * initiates negotiation.
 *
 * Audio lifecycle:
 * - Reserve an audio transceiver for every peer connection.
 * - Attach the microphone whenever it becomes available.
 * - Replace the outgoing track without creating duplicate senders.
 * - Keep ICE candidates queued until a remote description exists.
 * - Ignore stale connection generations.
 * - Attempt an ICE restart after connection failure.
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
    if (this.closed || !this.socket?.connected) {
      return;
    }

    this.socket.emit('peer:signal', {
      to: peerId,
      data,
    });
  }

  #createConnection(peer, generation) {
    if (this.closed) {
      return null;
    }

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
      audioSender: null,
      state: pc.connectionState,
    };

    this.connections.set(peer.id, connection);

    /*
     * IMPORTANT:
     *
     * Reserve the audio sender even when the microphone is not
     * available yet. Otherwise, replaceOutgoingTrack() cannot find
     * a sender when the microphone is acquired later.
     *
     * The transceiver is created before the initial offer, so the
     * offer includes the audio media section.
     */
    try {
      const transceiver = pc.addTransceiver('audio', {
        direction: 'sendrecv',
      });

      connection.audioSender = transceiver.sender;

      const localStream = this.getLocalStream?.();
      const localTrack =
        localStream?.getAudioTracks?.()[0] ?? null;

      if (localTrack) {
        void connection.audioSender
          .replaceTrack(localTrack)
          .catch((error) => {
            if (this.#isCurrent(connection)) {
              this.onError?.(
                `initial audio track for ${peer.id} failed: ${error.message}`,
              );
            }
          });
      }
    } catch (error) {
      this.onError?.(
        `audio sender setup for ${peer.id} failed: ${error.message}`,
      );
    }

    pc.onicecandidate = (event) => {
      if (!event.candidate || !this.#isCurrent(connection)) {
        return;
      }

      this.#send(peer.id, {
        type: 'candidate',
        candidate: event.candidate.toJSON(),
      });
    };

    pc.ontrack = (event) => {
      if (!this.#isCurrent(connection)) {
        return;
      }

      const remoteStream =
        event.streams?.[0] ??
        new MediaStream([event.track]);

      this.onTrack?.(
        peer.id,
        remoteStream,
        connection,
      );
    };

    pc.onconnectionstatechange = () => {
      if (!this.#isCurrent(connection)) {
        return;
      }

      const state = pc.connectionState;

      connection.state = state;
      this.onConnectionChange?.(peer.id, state);

      if (
        state === 'failed' &&
        !connection.restartingIce
      ) {
        connection.restartingIce = true;
        void this.#restartIce(connection);
      }

      if (state === 'closed') {
        this.#closeConnection(
          connection,
          'connection-closed',
        );
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (!this.#isCurrent(connection)) {
        return;
      }

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
      if (!this.#isCurrent(connection)) {
        return;
      }

      connection.makingOffer = true;

      const offer = await connection.pc.createOffer();

      if (!this.#isCurrent(connection)) {
        return;
      }

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
    } catch (error) {
      if (this.#isCurrent(connection)) {
        this.onError?.(
          `offer to ${connection.id} failed: ${error.message}`,
        );
      }
    } finally {
      connection.makingOffer = false;
    }
  }

  async #restartIce(connection) {
    try {
      if (!this.#isCurrent(connection)) {
        return;
      }

      const offer = await connection.pc.createOffer({
        iceRestart: true,
      });

      if (!this.#isCurrent(connection)) {
        return;
      }

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
    } catch (error) {
      if (!this.#isCurrent(connection)) {
        return;
      }

      this.onError?.(
        `ICE restart with ${connection.id} failed: ${error.message}`,
      );

      this.#closeConnection(
        connection,
        'ice-restart-failed',
      );
    } finally {
      if (this.#isCurrent(connection)) {
        connection.restartingIce = false;
      }
    }
  }

  async #flushCandidates(connection) {
    const queued = connection.pendingCandidates;
    connection.pendingCandidates = [];

    for (const candidate of queued) {
      if (!this.#isCurrent(connection)) {
        return;
      }

      try {
        await connection.pc.addIceCandidate(candidate);
      } catch (error) {
        if (this.#isCurrent(connection)) {
          this.onError?.(
            `late ICE candidate for ${connection.id} rejected: ${error.message}`,
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

  /**
   * Handle a server peer:negotiate event.
   */
  async handleNegotiate({
    peer,
    generation,
    initiator,
    soundFactor,
  }) {
    if (this.closed || !peer?.id) {
      return;
    }

    const nextGeneration = Number(generation) || 0;
    const existing = this.connections.get(peer.id);

    if (
      existing &&
      existing.generation > nextGeneration
    ) {
      return;
    }

    if (
      existing &&
      existing.generation === nextGeneration &&
      existing.pc.connectionState !== 'failed' &&
      existing.pc.connectionState !== 'closed'
    ) {
      /*
       * A repeated negotiation event must not create another
       * connection or duplicate audio sender.
       */
      return;
    }

    const connection = this.#createConnection(
      peer,
      nextGeneration,
    );

    if (!connection) {
      return;
    }

    connection.soundFactor = soundFactor;

    if (initiator) {
      await this.#makeOffer(connection);
    }
  }

  /**
   * Handle a server-relayed peer:signal event.
   */
  async handleSignal({ from, data, generation }) {
    if (
      this.closed ||
      !from ||
      !data?.type
    ) {
      return;
    }

    let connection = this.connections.get(from);

    /*
     * Normally peer:negotiate creates the connection first.
     * Keep this fallback for an offer arriving before that event.
     */
    if (!connection && data.type === 'offer') {
      connection = this.#createConnection(
        {
          id: from,
          name: 'peer',
          color: '#8899aa',
        },
        Number(generation) || 0,
      );

      if (!connection) {
        return;
      }
    }

    if (!connection) {
      return;
    }

    if (
      typeof generation === 'number' &&
      generation < connection.generation
    ) {
      return;
    }

    try {
      if (data.type === 'offer') {
        await this.#makeOfferAnswer(connection, data);
        return;
      }

      if (data.type === 'answer') {
        if (
          connection.pc.signalingState !==
          'have-local-offer'
        ) {
          return;
        }

        await connection.pc.setRemoteDescription({
          type: 'answer',
          sdp: data.sdp,
        });

        if (!this.#isCurrent(connection)) {
          return;
        }

        connection.hasRemoteDescription = true;

        await this.#flushCandidates(connection);
        this.#scheduleStats(connection);

        return;
      }

      if (data.type === 'candidate') {
        if (!data.candidate) {
          return;
        }

        if (!connection.hasRemoteDescription) {
          connection.pendingCandidates.push(
            data.candidate,
          );

          return;
        }

        await connection.pc.addIceCandidate(
          data.candidate,
        );
      }
    } catch (error) {
      if (this.#isCurrent(connection)) {
        this.onError?.(
          `signal from ${from} (${data.type}) failed: ${error.message}`,
        );
      }
    }
  }

  async #makeOfferAnswer(connection, data) {
    if (!this.#isCurrent(connection)) {
      return;
    }

    const pc = connection.pc;

    const offerCollision =
      connection.makingOffer ||
      pc.signalingState !== 'stable';

    connection.ignoreOffer =
      !connection.polite && offerCollision;

    if (connection.ignoreOffer) {
      return;
    }

    /*
     * If a colliding offer is received, rollback the local offer
     * before accepting the remote offer. This is safe only when
     * the current signaling state supports rollback.
     */
    if (
      offerCollision &&
      pc.signalingState === 'have-local-offer'
    ) {
      await pc.setLocalDescription({
        type: 'rollback',
      });

      if (!this.#isCurrent(connection)) {
        return;
      }
    }

    await pc.setRemoteDescription({
      type: 'offer',
      sdp: data.sdp,
    });

    if (!this.#isCurrent(connection)) {
      return;
    }

    connection.hasRemoteDescription = true;

    await this.#flushCandidates(connection);

    if (!this.#isCurrent(connection)) {
      return;
    }

    const answer = await pc.createAnswer();

    if (!this.#isCurrent(connection)) {
      return;
    }

    await pc.setLocalDescription(answer);

    if (
      this.#isCurrent(connection) &&
      pc.localDescription
    ) {
      this.#send(connection.id, {
        type: 'answer',
        sdp: pc.localDescription.sdp,
      });
    }

    this.#scheduleStats(connection);
  }

  /**
   * Handle a server peer:hangup event.
   */
  handleHangup({ peerId }) {
    const connection = this.connections.get(peerId);

    if (!connection) {
      return;
    }

    this.#closeConnection(connection, 'hangup');
  }

  #closeConnection(connection, reason) {
    if (!connection) {
      return;
    }

    const isCurrent =
      this.connections.get(connection.id) === connection;

    if (isCurrent) {
      this.connections.delete(connection.id);
    }

    try {
      connection.pc.onicecandidate = null;
      connection.pc.ontrack = null;
      connection.pc.onconnectionstatechange = null;
      connection.pc.oniceconnectionstatechange = null;

      connection.pc.close();
    } catch {
      // The peer connection may already be closed.
    }

    if (isCurrent) {
      this.onConnectionChange?.(
        connection.id,
        `closed:${reason}`,
      );
    }

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
    if (
      !this.onStats ||
      !this.#isCurrent(connection)
    ) {
      return;
    }

    this.#clearStatsTimer();

    const collect = async () => {
      this.statsTimer = null;

      if (!this.#isCurrent(connection)) {
        return;
      }

      try {
        const report =
          await connection.pc.getStats();

        if (!this.#isCurrent(connection)) {
          return;
        }

        let inbound = null;
        let outbound = null;
        let candidatePair = null;

        report.forEach((entry) => {
          if (
            entry.type === 'inbound-rtp' &&
            (
              entry.kind === 'audio' ||
              entry.mediaType === 'audio'
            )
          ) {
            inbound = entry;
          }

          if (
            entry.type === 'outbound-rtp' &&
            (
              entry.kind === 'audio' ||
              entry.mediaType === 'audio'
            )
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
          bytesSent: outbound?.bytesSent ?? 0,
          kbpsSent: outbound
            ? Math.round(
                ((outbound.bytesSent ?? 0) * 8) / 1000,
              )
            : 0,
        };

        this.onStats(
          connection.id,
          connection.stats,
        );
      } catch {
        // Statistics are best-effort.
      }

      if (this.#isCurrent(connection)) {
        this.statsTimer = setTimeout(
          collect,
          2000,
        );
      }
    };

    this.statsTimer = setTimeout(
      collect,
      2000,
    );
  }

  /**
   * Attach or replace the outgoing microphone track.
   *
   * The sender exists because #createConnection() reserves an
   * audio transceiver even when no microphone is available.
   */
  async replaceOutgoingTrack(nextStream) {
    const nextTrack =
      nextStream?.getAudioTracks?.()[0] ?? null;

    const operations = [];

    for (const connection of this.connections.values()) {
      if (!this.#isCurrent(connection)) {
        continue;
      }

      /*
       * Prefer the reserved sender. Fall back to finding an audio
       * sender for compatibility with existing connections.
       */
      const sender =
        connection.audioSender ??
        connection.pc
          .getSenders()
          .find((item) => item.track?.kind === 'audio');

      if (!sender) {
        this.onError?.(
          `audio sender missing for peer ${connection.id}`,
        );

        continue;
      }

      connection.audioSender = sender;

      operations.push(
        sender
          .replaceTrack(nextTrack)
          .then(() => {
            if (!this.#isCurrent(connection)) {
              return;
            }

            connection.outgoingTrackId =
              nextTrack?.id ?? null;
          })
          .catch((error) => {
            if (this.#isCurrent(connection)) {
              this.onError?.(
                `replacing audio track for ${connection.id} failed: ${error.message}`,
              );
            }
          }),
      );
    }

    await Promise.all(operations);
  }

  /**
   * Enable/disable the local microphone tracks.
   */
  setMicEnabled(enabled) {
    const stream = this.getLocalStream?.();

    for (const track of stream?.getAudioTracks?.() ?? []) {
      track.enabled = Boolean(enabled);
    }
  }

  /**
   * Diagnostic snapshot of active connections.
   */
  snapshot() {
    return [...this.connections.values()].map(
      (connection) => ({
        id: connection.id,
        generation: connection.generation,
        state: connection.pc.connectionState,
        iceState: connection.pc.iceConnectionState,
        signaling: connection.pc.signalingState,
        soundFactor: connection.soundFactor ?? 1,
        hasAudioSender: Boolean(connection.audioSender),
        outgoingTrackId:
          connection.audioSender?.track?.id ?? null,
        outgoingTrackEnabled:
          connection.audioSender?.track?.enabled ?? false,
        stats: connection.stats,
      }),
    );
  }

  /**
   * Close all connections and disable the manager.
   * reset() re-enables it for a subsequent room session.
   */
  closeAll() {
    this.closed = true;
    this.#clearStatsTimer();

    for (const connection of [
      ...this.connections.values(),
    ]) {
      this.#closeConnection(
        connection,
        'shutdown',
      );
    }

    this.connections.clear();
  }

  /**
   * Prepare for another room session.
   */
  reset({ iceServers = this.iceServers } = {}) {
    this.#clearStatsTimer();

    for (const connection of [
      ...this.connections.values(),
    ]) {
      this.#closeConnection(
        connection,
        'replaced',
      );
    }

    this.connections.clear();
    this.iceServers = iceServers;
    this.closed = false;
  }
}

export default PeerManager;