/**
 * WebRTC mesh client (Week 2 + 3).
 *
 * The server decides *who* may talk to *whom* (an edge exists only inside the
 * earshot radius) and *who creates the offer* (lexicographic socket id), so
 * this class never has to negotiate glare: exactly one side of an edge is the
 * offerer. It still handles the three things that break naive implementations:
 *
 *   1. STALE SIGNALS — every edge carries a `generation`; anything older than
 *      the connection we hold is dropped instead of reviving a dead call.
 *   2. ICE RACE — candidates that arrive before the remote description are
 *      queued and replayed, never added to a pc with no remote SDP.
 *   3. DEAD LINKS — a failed connection is restarted with ICE once, then torn
 *      down and left for the server to re-negotiate when the radius changes.
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

    this.connections = new Map(); // peerId -> connection
    this.closed = false;
    this.statsTimer = null;
  }

  get size() {
    return this.connections.size;
  }

  #send(peerId, data) {
    this.socket.emit('peer:signal', { to: peerId, data });
  }

  #createConnection(peer, generation) {
    const previous = this.connections.get(peer.id);
    if (previous) this.#closeConnection(previous, 'replaced');

    const pc = new RTCPeerConnection({ iceServers: this.iceServers, bundlePolicy: 'max-bundle' });
    const connection = {
      id: peer.id,
      generation,
      peer,
      pc,
      pendingCandidates: [],
      hasRemoteDescription: false,
      makingOffer: false,
      ignoreOffer: false,
      polite: false, // the server guarantees a single offerer; polite stays false
      restartingIce: false,
      stats: null,
    };
    this.connections.set(peer.id, connection);

    const stream = this.getLocalStream();
    if (stream) {
      for (const track of stream.getAudioTracks()) pc.addTrack(track, stream);
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) this.#send(peer.id, { type: 'candidate', candidate: event.candidate.toJSON() });
    };

    pc.ontrack = (event) => {
      const [remote] = event.streams;
      this.onTrack?.(peer.id, remote ?? new MediaStream([event.track]), connection);
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      connection.state = state;
      this.onConnectionChange?.(peer.id, state);

      if (state === 'failed' && !connection.restartingIce) {
        connection.restartingIce = true;
        this.#restartIce(connection);
      }
      if (state === 'closed') this.connections.delete(peer.id);
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed' && !connection.restartingIce) {
        connection.restartingIce = true;
        this.#restartIce(connection);
      }
    };

    return connection;
  }

  async #makeOffer(connection) {
    try {
      connection.makingOffer = true;
      await connection.pc.setLocalDescription(await connection.pc.createOffer());
      if (connection.pc.localDescription) {
        this.#send(connection.id, { type: 'offer', sdp: connection.pc.localDescription.sdp });
      }
    } catch (err) {
      this.onError?.(`offer to ${connection.id} failed: ${err.message}`);
    } finally {
      connection.makingOffer = false;
    }
  }

  async #restartIce(connection) {
    try {
      await connection.pc.setLocalDescription(await connection.pc.createOffer({ iceRestart: true }));
      this.#send(connection.id, { type: 'offer', sdp: connection.pc.localDescription.sdp });
    } catch (err) {
      this.onError?.(`ICE restart with ${connection.id} failed: ${err.message}`);
      this.#closeConnection(connection, 'ice-restart-failed');
    }
  }

  async #flushCandidates(connection) {
    const queued = connection.pendingCandidates;
    connection.pendingCandidates = [];
    for (const candidate of queued) {
      try {
        await connection.pc.addIceCandidate(candidate);
      } catch (err) {
        this.onError?.(`late ICE candidate for ${connection.id} rejected: ${err.message}`);
      }
    }
  }

  /** `peer:negotiate` — the server opened (or re-opened) an edge. */
  async handleNegotiate({ peer, generation, initiator, soundFactor }) {
    if (this.closed || !peer) return;
    const existing = this.connections.get(peer.id);

    // Duplicate / stale guards.
    if (existing && existing.generation > generation) return;
    if (existing && existing.generation === generation && existing.pc.connectionState !== 'failed') return;

    const connection = this.#createConnection(peer, generation);
    connection.soundFactor = soundFactor;
    if (initiator) await this.#makeOffer(connection);
  }

  /** `peer:signal` — relayed offer / answer / candidate. */
  async handleSignal({ from, data, generation }) {
    if (this.closed || !from) return;
    let connection = this.connections.get(from);

    // Defensive: an offer always creates the connection even if the negotiate
    // event was lost (for example across a reconnect).
    if (!connection && data.type === 'offer') {
      connection = this.#createConnection({ id: from, name: 'peer', color: '#8899aa' }, generation ?? 0);
      await this.#makeOfferAnswer(connection, data);
      return;
    }
    if (!connection) return;
    if (typeof generation === 'number' && generation < connection.generation) return;

    try {
      if (data.type === 'offer') {
        await this.#makeOfferAnswer(connection, data);
      } else if (data.type === 'answer') {
        if (connection.pc.signalingState !== 'have-local-offer') return; // duplicate answer
        await connection.pc.setRemoteDescription({ type: 'answer', sdp: data.sdp });
        connection.hasRemoteDescription = true;
        await this.#flushCandidates(connection);
        this.#scheduleStats(connection);
      } else if (data.type === 'candidate') {
        if (!data.candidate) return; // end-of-candidates marker
        if (!connection.hasRemoteDescription) {
          connection.pendingCandidates.push(data.candidate);
          return;
        }
        await connection.pc.addIceCandidate(data.candidate);
      }
    } catch (err) {
      this.onError?.(`signal from ${from} (${data.type}) failed: ${err.message}`);
    }
  }

  async #makeOfferAnswer(connection, data) {
    const offerCollision =
      connection.makingOffer || connection.pc.signalingState !== 'stable';
    connection.ignoreOffer = !connection.polite && offerCollision;
    if (connection.ignoreOffer) return;

    await connection.pc.setRemoteDescription({ type: 'offer', sdp: data.sdp });
    connection.hasRemoteDescription = true;
    await this.#flushCandidates(connection);

    await connection.pc.setLocalDescription(await connection.pc.createAnswer());
    if (connection.pc.localDescription) {
      this.#send(connection.id, { type: 'answer', sdp: connection.pc.localDescription.sdp });
    }
  }

  /** `peer:hangup` — the edge died (radius exit, disconnect, duplicate). */
  handleHangup({ peerId }) {
    const connection = this.connections.get(peerId);
    if (!connection) return;
    this.#closeConnection(connection, 'hangup');
  }

  #closeConnection(connection, reason) {
    this.connections.delete(connection.id);
    if (this.statsTimer) {
      clearTimeout(this.statsTimer);
      this.statsTimer = null;
    }
    try {
      connection.pc.onicecandidate = null;
      connection.pc.ontrack = null;
      connection.pc.onconnectionstatechange = null;
      connection.pc.oniceconnectionstatechange = null;
      connection.pc.close();
    } catch {
      /* already closed */
    }
    this.onConnectionChange?.(connection.id, `closed:${reason}`);
  }

  #scheduleStats(connection) {
    if (!this.onStats) return;
    clearTimeout(this.statsTimer);
    const collect = async () => {
      if (!this.connections.has(connection.id)) return;
      try {
        const report = await connection.pc.getStats();
        let inbound = null;
        let outbound = null;
        report.forEach((entry) => {
          if (entry.type === 'inbound-rtp' && entry.kind === 'audio') inbound = entry;
          if (entry.type === 'outbound-rtp' && entry.kind === 'audio') outbound = entry;
        });
        connection.stats = {
          rtt: report.get('candidate-pair')?.currentRoundTripTime ?? 0,
          jitter: inbound?.jitter ?? 0,
          packetsLost: inbound?.packetsLost ?? 0,
          bytesReceived: inbound?.bytesReceived ?? 0,
          kbpsSent: outbound ? Math.round(((outbound.bytesSent ?? 0) * 8) / 1000) : 0,
        };
        this.onStats(connection.id, connection.stats);
      } catch {
        /* stats are best-effort */
      }
      this.statsTimer = setTimeout(collect, 2000);
    };
    this.statsTimer = setTimeout(collect, 2000);
  }

  /** Swap the outgoing track after a device change without renegotiating. */
  async replaceOutgoingTrack(nextStream) {
    const senderTrack = nextStream?.getAudioTracks?.()[0] ?? null;
    for (const connection of this.connections.values()) {
      const sender = connection.pc.getSenders().find((s) => s.track?.kind === 'audio');
      if (sender) await sender.replaceTrack(senderTrack).catch(() => {});
    }
  }

  setMicEnabled(enabled) {
    const stream = this.getLocalStream();
    for (const track of stream?.getAudioTracks?.() ?? []) track.enabled = enabled;
  }

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

  closeAll() {
    this.closed = true;
    for (const connection of [...this.connections.values()]) this.#closeConnection(connection, 'shutdown');
  }
}
export default PeerManager;