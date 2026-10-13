/**
 * WebRTC mesh routing (Week 3).
 *
 * The graph is undirected and completely rebuilt from live geometry: an edge
 * exists if and only if both avatars sit inside each other's earshot circle
 * *and* they are in the same room. Every reconcile is a diff, which gives us
 * three properties for free:
 *
 *   - no duplicate connections: an existing edge is never renegotiated
 *   - no stale connections: leaving the radius removes the edge immediately
 *   - bounded mesh size: with a 100 px radius a 50+ user office never becomes
 *     an N^2 blob, it becomes a handful of small conversations
 *
 * Each edge carries a monotonically increasing `generation`; clients discard
 * signalling messages from an older generation, so a late ICE candidate from a
 * connection that was already torn down can never resurrect it.
 */

const edgeKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export class PeerGraph {
  #edges = new Map();
  #earshotPx;
  #emit;
  #resolveSoundFactor;
  #isReady;
  #log;
  #now;
  #generation = 0;

  constructor({ earshotPx, emit = () => {}, resolveSoundFactor = () => 1, isReady = () => true, logger, now = () => Date.now() }) {
    this.#earshotPx = earshotPx;
    this.#emit = emit;
    this.#resolveSoundFactor = resolveSoundFactor;
    this.#isReady = isReady;
    this.#log = logger;
    this.#now = now;
  }

  get size() {
    return this.#edges.size;
  }

  /** Bound after the Socket.io server exists (see sockets/index.js). */
  setEmitter(fn) {
    this.#emit = typeof fn === 'function' ? fn : () => {};
  }

  /** Exposed for diagnostics / the audit endpoint. */
  snapshot() {
    return [...this.#edges.values()].map((edge) => ({ ...edge }));
  }

  edge(a, b) {
    return this.#edges.get(edgeKey(a, b));
  }

  hasEdge(a, b) {
    return this.#edges.has(edgeKey(a, b));
  }

  /** Ids of every peer currently connected to `id` (same room + in earshot). */
  neighborsOf(id) {
    const out = [];
    for (const edge of this.#edges.values()) {
      if (edge.a === id) out.push(edge.b);
      else if (edge.b === id) out.push(edge.a);
    }
    return out;
  }

  #nextGeneration() {
    this.#generation += 1;
    return this.#generation;
  }

  /**
   * Recompute the desired edges for one room and emit the difference.
   * @param {Array<{id:string,x:number,y:number,name:string,color:string,roomId:string,micEnabled:boolean}>} members
   * @returns {{added:Array, removed:Array}}
   */
  reconcile(members) {
    const rooms = new Map();
    for (const member of members) {
      if (!rooms.has(member.roomId)) rooms.set(member.roomId, []);
      rooms.get(member.roomId).push(member);
    }

    const byId = new Map(members.map((m) => [m.id, m]));

    const desired = new Set();
    for (const [, room] of rooms) {
      for (let i = 0; i < room.length; i += 1) {
        for (let j = i + 1; j < room.length; j += 1) {
          const a = room[i];
          const b = room[j];
          if (!this.#isReady(a) || !this.#isReady(b)) continue; // wait for the mic
          if (Math.hypot(b.x - a.x, b.y - a.y) > this.#earshotPx) continue;
          desired.add(edgeKey(a.id, b.id));
        }
      }
    }

    const added = [];
    const removed = [];

    for (const key of desired) {
      if (this.#edges.has(key)) continue; // duplicate guard: never renegotiate a live edge
      const [aId, bId] = key.split('|');
      const a = byId.get(aId);
      const b = byId.get(bId);
      if (!a || !b) continue;
      added.push(this.#openEdge(a, b));
    }

    for (const edge of [...this.#edges.values()]) {
      if (desired.has(edge.key)) continue;
      this.#edges.delete(edge.key);
      removed.push(edge);
      this.#tearDown(edge, 'out-of-range');
    }

    if (added.length || removed.length) {
      this.#log.debug(
        `reconcile +${added.length}/-${removed.length} edges=${this.#edges.size} users=${members.length}`,
      );
    }
    return { added, removed };
  }

  #openEdge(a, b) {
    const edge = {
      key: edgeKey(a.id, b.id),
      a: a.id,
      b: b.id,
      roomId: a.roomId,
      generation: this.#nextGeneration(),
      state: 'pending',
      soundFactor: this.#resolveSoundFactor(a, b),
      createdAt: this.#now(),
      lastActivity: this.#now(),
    };
    this.#edges.set(edge.key, edge);

    // Both sides learn about the edge; exactly one of them (lexicographic
    // order) creates the offer, which removes WebRTC "glare" entirely.
    const payload = (self, other) => ({
      peer: wire(other),
      self: wire(self),
      generation: edge.generation,
      initiator: self.id < other.id,
      soundFactor: edge.soundFactor,
      earshotPx: this.#earshotPx,
    });
    this.#emit(a.id, 'peer:negotiate', payload(a, b));
    this.#emit(b.id, 'peer:negotiate', payload(b, a));
    return edge;
  }

  /**
   * Targeted diff for a single user: called on every movement update so an
   * avatar that walks into somebody's earshot connects immediately instead of
   * waiting for the next full reconcile tick.
   */
  reconcileMember(user, members) {
    if (!this.#isReady(user)) return { added: [], removed: [] };
    const added = [];
    const removed = [];

    for (const other of members) {
      if (other.id === user.id || other.roomId !== user.roomId) continue;
      const key = edgeKey(user.id, other.id);
      const inRange = Math.hypot(other.x - user.x, other.y - user.y) <= this.#earshotPx;
      const exists = this.#edges.has(key);
      const bothReady = this.#isReady(other);

      if (inRange && bothReady && !exists) {
        added.push(this.#openEdge(user, other));
      } else if ((!inRange || !bothReady) && exists) {
        const edge = this.#edges.get(key);
        this.#edges.delete(key);
        removed.push(edge);
        this.#tearDown(edge, !bothReady ? 'peer-not-ready' : 'out-of-range');
      }
    }

    if (added.length || removed.length) {
      this.#log.debug(`reconcileMember ${user.id} +${added.length}/-${removed.length} edges=${this.#edges.size}`);
    }
    return { added, removed };
  }

  /** Force-drop every edge touching a user (disconnect / room switch). */
  removeUser(id, reason = 'disconnect') {
    const removed = [];
    for (const edge of [...this.#edges.values()]) {
      if (edge.a !== id && edge.b !== id) continue;
      this.#edges.delete(edge.key);
      removed.push(edge);
      this.#tearDown(edge, reason);
    }
    return removed;
  }

  #tearDown(edge, reason) {
    const payload = { peerId: edge.a === edge.b ? null : null, generation: edge.generation, reason };
    this.#emit(edge.a, 'peer:hangup', { peerId: edge.b, generation: edge.generation, reason });
    this.#emit(edge.b, 'peer:hangup', { peerId: edge.a, generation: edge.generation, reason });
    return payload;
  }

  /** Refresh the occlusion factor of the edges touching a user after a move. */
  refreshSoundFactors(members) {
    const byId = new Map(members.map((m) => [m.id, m]));
    for (const edge of this.#edges.values()) {
      const a = byId.get(edge.a);
      const b = byId.get(edge.b);
      if (!a || !b) continue;
      const soundFactor = this.#resolveSoundFactor(a, b);
      if (Math.abs(soundFactor - edge.soundFactor) > 0.01) {
        edge.soundFactor = soundFactor;
        this.#emit(edge.a, 'peer:audio-obstruction', { peerId: edge.b, soundFactor, generation: edge.generation });
        this.#emit(edge.b, 'peer:audio-obstruction', { peerId: edge.a, soundFactor, generation: edge.generation });
      }
    }
  }

  /** Called by the signaling relay so we can tell live edges from dead ones. */
  noteSignal(a, b) {
    const edge = this.edge(a, b);
    if (!edge) return null;
    edge.lastActivity = this.#now();
    return edge;
  }

  markLive(a, b) {
    const edge = this.edge(a, b);
    if (edge) {
      edge.state = 'live';
      edge.lastActivity = this.#now();
    }
    return edge;
  }

  /** Drop edges whose negotiation never completed, so they can be retried. */
  sweep({ pendingTimeoutMs = 15000 } = {}) {
    const now = this.#now();
    const dropped = [];
    for (const edge of [...this.#edges.values()]) {
      if (edge.state === 'pending' && now - edge.createdAt > pendingTimeoutMs) {
        this.#edges.delete(edge.key);
        dropped.push(edge);
        this.#emit(edge.a, 'peer:hangup', { peerId: edge.b, generation: edge.generation, reason: 'negotiation-timeout' });
        this.#emit(edge.b, 'peer:hangup', { peerId: edge.a, generation: edge.generation, reason: 'negotiation-timeout' });
      }
    }
    return dropped;
  }

  /** Aggregate mesh statistics (used by /api/health and the load test). */
  stats() {
    let pending = 0;
    let live = 0;
    for (const edge of this.#edges.values()) {
      if (edge.state === 'live') live += 1;
      else pending += 1;
    }
    return { edges: this.#edges.size, pending, live, generation: this.#generation };
  }
}

const wire = (user) => ({
  id: user.id,
  name: user.name,
  color: user.color,
  avatar: user.avatar ?? 'circle',
  x: user.x,
  y: user.y,
  angle: user.angle ?? 0,
  micEnabled: user.micEnabled !== false,
});

export default PeerGraph;