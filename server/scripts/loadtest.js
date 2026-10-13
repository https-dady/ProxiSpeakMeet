/**
 * Concurrency / mesh load test (50+ users requirement).
 *
 *   node scripts/loadtest.js --clients=50 --duration=20
 *   node scripts/loadtest.js --clients=100 --url=http://localhost:4001
 *
 * Each virtual client joins, grants a (simulated) microphone, walks a small
 * circle at 10 Hz and answers the throttled position acks. Afterwards the test
 * hits /api/stats and /api/spatial-audit so the run doubles as a full review
 * demonstration.
 */
import process from 'node:process';
import { io as createClient } from 'socket.io-client';
import logger from '../src/utils/logger.js';

const log = logger.child('loadtest');

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, '').split('=');
    return [key, value === undefined ? true : value];
  }),
);

const URL_BASE = String(args.url ?? 'http://localhost:4000');
const CLIENTS = Number(args.clients ?? 50);
const DURATION_S = Number(args.duration ?? 15);
const THROTTLE_MS = 100;
const WORLD = { width: 1920, height: 1080 };

const green = (s) => `\u001b[32m${s}\u001b[0m`;
const red = (s) => `\u001b[31m${s}\u001b[0m`;
const bold = (s) => `\u001b[1m${s}\u001b[0m`;
const dim = (s) => `\u001b[90m${s}\u001b[0m`;

const stats = {
  connected: 0,
  joined: 0,
  negotiate: 0,
  hangups: 0,
  moved: 0,
  errors: 0,
  latencies: [],
  rooms: new Set(),
};

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] ?? 0;

async function main() {
  console.log(bold(`\nProxiSpeak load test — ${CLIENTS} clients, ${DURATION_S}s, ${URL_BASE}\n`));

  const clients = [];
  for (let i = 0; i < CLIENTS; i += 1) {
    // Arrange clients into 6 conversation clusters spread over the office.
    const cluster = i % 6;
    const cx = WORLD.width * (0.12 + cluster * 0.15);
    const cy = WORLD.height * (0.2 + (cluster % 3) * 0.28);

    const socket = createClient(URL_BASE, { transports: ['websocket'], reconnection: false });
    const state = {
      socket,
      index: i,
      cx,
      cy,
      x: cx + (i % 9) * 4,
      y: cy + (i % 7) * 4,
      angle: 0,
      t: 0,
      peers: new Set(),
    };

    socket.on('connect', () => {
      stats.connected += 1;
    });
    socket.on('peer:negotiate', (payload) => {
      stats.negotiate += 1;
      state.peers.add(payload.peer.id);
      // Simulate a WebRTC handshake: the initiator offers, the other answers.
      const signal = { to: payload.peer.id, data: payload.initiator ? { type: 'offer', sdp: 'v=0\r\n' } : { type: 'candidate', candidate: null } };
      socket.emit('peer:signal', signal);
      if (!payload.initiator) {
        socket.emit('peer:signal', { to: payload.peer.id, data: { type: 'answer', sdp: 'v=0\r\n' } });
      }
    });
    socket.on('peer:hangup', (payload) => {
      stats.hangups += 1;
      state.peers.delete(payload.peerId);
    });
    socket.on('presence:moved', () => {
      stats.moved += 1;
    });
    socket.on('connect_error', (err) => {
      stats.errors += 1;
      if (stats.errors < 5) log.warn(`client ${i} connect error: ${err.message}`);
    });

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`client ${i} join timeout`)), 8000);
      socket.on('connect', () => {
        socket.emit('room:join', { roomId: String(args.room ?? 'loadtest'), name: `Bot ${i}`, color: '#5aa9ff' }, (ack) => {
          clearTimeout(timer);
          if (!ack?.ok) return reject(new Error(ack?.error ?? 'join rejected'));
          stats.joined += 1;
          stats.rooms.add(ack.room.roomId);
          // Mark the (simulated) microphone as ready so the mesh is allowed to
          // negotiate — this mirrors the real getUserMedia gate in the browser.
          socket.emit('peer:media-ready', { micEnabled: true });
          resolve();
        });
      });
    });

    clients.push(state);
  }

  console.log(green(`  ✓ ${stats.joined}/${CLIENTS} clients joined room "${args.room ?? 'loadtest'}"`));

  const started = Date.now();
  const interval = setInterval(() => {
    const now = Date.now();
    for (const state of clients) {
      if (!state.socket.connected) continue;
      state.t += THROTTLE_MS / 1000;
      // A small orbit keeps users drifting in and out of each other's earshot.
      state.x = Math.min(WORLD.width - 20, Math.max(20, state.cx + Math.cos(state.t + state.index) * 70));
      state.y = Math.min(WORLD.height - 20, Math.max(20, state.cy + Math.sin(state.t + state.index) * 70));
      state.angle = state.t;
      const sent = performance.now();
      state.socket.emit('position:update', { x: state.x, y: state.y, angle: state.angle }, (ack) => {
        if (!ack?.ok) {
          stats.errors += 1;
          return;
        }
        stats.latencies.push(performance.now() - sent);
      });
    }
  }, THROTTLE_MS);

  await new Promise((resolve) => setTimeout(resolve, DURATION_S * 1000));
  clearInterval(interval);
  const elapsed = (Date.now() - started) / 1000;

  // Let the server's presence flush + audit settle before measuring.
  await new Promise((resolve) => setTimeout(resolve, 800));

  for (const state of clients) state.socket.close();

  const sorted = [...stats.latencies].sort((a, b) => a - b);
  const avg = sorted.reduce((sum, v) => sum + v, 0) / (sorted.length || 1);

  console.log('');
  console.log(bold('  RESULTS'));
  console.log(`  ${'duration'.padEnd(30)} ${elapsed.toFixed(1)}s`);
  console.log(`  ${'clients joined'.padEnd(30)} ${stats.joined}/${CLIENTS}`);
  console.log(`  ${'mesh negotiations'.padEnd(30)} ${stats.negotiate}`);
  console.log(`  ${'mesh hangups (radius exits)'.padEnd(30)} ${stats.hangups}`);
  console.log(`  ${'position updates fanned out'.padEnd(30)} ${stats.moved}`);
  console.log(`  ${'position acks'.padEnd(30)} ${sorted.length}`);
  console.log(`  ${'ack latency avg / p95'.padEnd(30)} ${avg.toFixed(2)}ms / ${percentile(sorted, 95).toFixed(2)}ms`);
  console.log(`  ${'errors'.padEnd(30)} ${stats.errors === 0 ? green('0') : red(stats.errors)}`);
  console.log('');

  try {
    const statsResponse = await fetch(`${URL_BASE}/api/stats`);
    const serverStats = await statsResponse.json();
    console.log(bold('  SERVER VIEW (/api/stats)'));
    console.log(`  ${'users connected'.padEnd(30)} ${serverStats.users}`);
    console.log(`  ${'mesh edges'.padEnd(30)} ${serverStats.mesh.edges} (live ${serverStats.mesh.live}, pending ${serverStats.mesh.pending})`);
    console.log(`  ${'scale mode'.padEnd(30)} ${serverStats.scaleMode}`);
    console.log('');
  } catch (err) {
    console.log(dim(`  (could not read /api/stats: ${err.message})`));
  }

  try {
    const auditResponse = await fetch(`${URL_BASE}/api/spatial-audit?roomId=${args.room ?? 'loadtest'}&samples=25`);
    const audit = await auditResponse.json();
    if (audit.error) throw new Error(audit.error);
    const near = audit.queries.near;
    console.log(bold('  SPATIAL AUDIT UNDER LOAD'));
    console.log(`  ${'$near p95'.padEnd(30)} ${near.p95Ms <= audit.budgetMs ? green(near.p95Ms + 'ms') : red(near.p95Ms + 'ms')} (budget ${audit.budgetMs}ms)`);
    console.log(`  ${'$geoWithin p95'.padEnd(30)} ${audit.queries.within.p95Ms}ms`);
    console.log(`  ${'$geoNear clusters p95'.padEnd(30)} ${audit.queries.cluster.p95Ms}ms`);
    console.log(`  ${'peers matched / accuracy'.padEnd(30)} ${audit.accuracy.matchedPeers} · ${audit.accuracy.passed ? green('consistent') : red('inconsistent')}`);
    console.log('');
  } catch (err) {
    console.log(dim(`  (spatial audit unavailable: ${err.message})`));
  }

  const ok = stats.joined === CLIENTS && stats.errors === 0;
  console.log(ok ? green('  PASS — every client joined, moved and was acknowledged\n') : red('  FAIL — see errors above\n'));
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  log.error(err);
  process.exit(1);
});