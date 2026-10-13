import test from 'node:test';
import assert from 'node:assert/strict';
import { PeerGraph } from '../src/services/peerGraph.js';
import logger from '../src/utils/logger.js';

const log = logger.child('test');

function harness({ earshotPx = 100, isReady = () => true, soundFactor = () => 1 } = {}) {
  const events = [];
  const graph = new PeerGraph({
    earshotPx,
    isReady,
    resolveSoundFactor: soundFactor,
    logger: log,
    emit: (to, event, payload) => events.push({ to, event, payload }),
  });
  return { graph, events };
}

const user = (id, x, y, extra = {}) => ({
  id,
  x,
  y,
  roomId: 'lobby',
  name: id,
  color: '#fff',
  angle: 0,
  micEnabled: true,
  ready: true,
  ...extra,
});

const negotiates = (events, to) => events.filter((e) => e.event === 'peer:negotiate' && e.to === to);
const hangups = (events, to) => events.filter((e) => e.event === 'peer:hangup' && e.to === to);

test('an edge only exists inside the earshot radius', () => {
  const { graph, events } = harness();
  graph.reconcile([user('a', 100, 100), user('b', 150, 100)]); // 50px apart
  assert.equal(graph.hasEdge('a', 'b'), true);
  assert.equal(negotiates(events, 'a').length, 1);
  assert.equal(negotiates(events, 'b').length, 1);

  graph.reconcile([user('a', 100, 100), user('b', 400, 100)]); // 300px apart
  assert.equal(graph.hasEdge('a', 'b'), false);
  assert.equal(hangups(events, 'a').length, 1);
});

test('exactly one side is the initiator (no WebRTC glare)', () => {
  const { graph, events } = harness();
  graph.reconcile([user('a', 100, 100), user('b', 120, 100)]);
  const a = negotiates(events, 'a')[0].payload;
  const b = negotiates(events, 'b')[0].payload;
  assert.notEqual(a.initiator, b.initiator);
  assert.equal(a.initiator, 'a' < 'b');
  assert.equal(a.generation, b.generation, 'both sides share one generation');
});

test('reconciling repeatedly never duplicates a live edge', () => {
  const { graph, events } = harness();
  const members = [user('a', 100, 100), user('b', 120, 100)];
  for (let i = 0; i < 10; i += 1) graph.reconcile(members);
  assert.equal(graph.size, 1);
  assert.equal(negotiates(events, 'a').length, 1, 'negotiation happens once');
});

test('leaving and re-entering the radius increments the generation', () => {
  const { graph, events } = harness();
  graph.reconcile([user('a', 100, 100), user('b', 120, 100)]);
  const first = negotiates(events, 'a')[0].payload.generation;

  graph.reconcile([user('a', 100, 100), user('b', 400, 100)]);
  graph.reconcile([user('a', 100, 100), user('b', 120, 100)]);

  const second = negotiates(events, 'a')[1].payload.generation;
  assert.ok(second > first, `generation must advance: ${first} -> ${second}`);
  assert.equal(graph.hasEdge('a', 'b'), true);
});

test('users that have not granted the microphone are never connected', () => {
  const ready = new Set(['a']);
  const { graph, events } = harness({ isReady: (u) => ready.has(u.id) });
  graph.reconcile([user('a', 100, 100), user('b', 110, 100)]);
  assert.equal(graph.size, 0);

  ready.add('b');
  graph.reconcile([user('a', 100, 100), user('b', 110, 100)]);
  assert.equal(graph.size, 1);
  assert.equal(negotiates(events, 'a').length, 1);
});

test('users in different rooms never share an edge', () => {
  const { graph } = harness();
  graph.reconcile([user('a', 100, 100), user('b', 105, 105, { roomId: 'studio' })]);
  assert.equal(graph.size, 0);
});

test('reconcileMember reacts to a single avatar walking in and out', () => {
  const { graph, events } = harness();
  const a = user('a', 500, 500);
  graph.reconcile([a]);
  assert.equal(graph.size, 0);

  const b = user('b', 560, 500);
  graph.reconcileMember(b, [a, b]);
  assert.equal(graph.hasEdge('a', 'b'), true);

  b.x = 900;
  graph.reconcileMember(b, [a, b]);
  assert.equal(graph.hasEdge('a', 'b'), false);
  assert.equal(hangups(events, 'a').length, 1);
});

test('removeUser tears down every edge of a disconnecting peer', () => {
  const { graph, events } = harness();
  graph.reconcile([user('a', 100, 100), user('b', 110, 100), user('c', 115, 100)]);
  // All three stand next to each other, so the triangle is fully connected.
  assert.equal(graph.size, 3);

  graph.removeUser('b', 'disconnect');
  assert.equal(graph.hasEdge('a', 'b'), false);
  assert.equal(graph.hasEdge('b', 'c'), false);
  assert.equal(graph.hasEdge('a', 'c'), true, 'a and c stay connected');
  assert.equal(hangups(events, 'a').length, 1);
});

test('occlusion factors are attached to the edge and refreshed on movement', () => {
  let factor = 1;
  const { graph, events } = harness({ soundFactor: () => factor });
  graph.reconcile([user('a', 100, 100), user('b', 110, 100)]);
  assert.equal(graph.edge('a', 'b').soundFactor, 1);

  factor = 0.1;
  graph.refreshSoundFactors([user('a', 100, 100), user('b', 110, 100)]);
  assert.equal(graph.edge('a', 'b').soundFactor, 0.1);
  const update = events.filter((e) => e.event === 'peer:audio-obstruction' && e.to === 'a')[0];
  assert.equal(update.payload.soundFactor, 0.1);
});

test('a negotiation that never completes is swept so it can be retried', () => {
  let clock = 0;
  const graph = new PeerGraph({
    earshotPx: 100,
    logger: log,
    now: () => clock,
    emit: () => {},
  });
  graph.reconcile([user('a', 100, 100), user('b', 110, 100)]);
  assert.equal(graph.size, 1);

  clock += 20000;
  graph.sweep({ pendingTimeoutMs: 15000 });
  assert.equal(graph.size, 0);
});

test('50 users in tight clusters produce a bounded mesh, not N^2', () => {
  const { graph } = harness();
  const members = [];
  for (let i = 0; i < 50; i += 1) {
    // 5 conversation circles of 10 people; members of a circle are 20px apart.
    const cluster = Math.floor(i / 10);
    const angle = (i % 10) * 0.35;
    members.push(user(`u${i}`, 300 + cluster * 300 + Math.cos(angle) * 30, 300 + Math.sin(angle) * 30));
  }
  graph.reconcile(members);
  // 5 clusters x C(10,2)=45 edges = 225, never 1225 (the full mesh).
  assert.equal(graph.size, 5 * 45);
  assert.ok(graph.size < (50 * 49) / 2);
});