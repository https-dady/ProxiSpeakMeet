import test from 'node:test';
import assert from 'node:assert/strict';
import { segmentIntersectsRect, occlusionBetween, resolveCollision } from '../src/services/obstacleService.js';

const rect = { id: 'wall', x: 100, y: 100, w: 50, h: 50, blocksAudio: true, attenuation: 0.1 };

test('a segment that misses the rectangle never blocks', () => {
  assert.equal(segmentIntersectsRect(0, 0, 10, 10, rect), false);
  assert.equal(segmentIntersectsRect(200, 0, 210, 10, rect), false);
});

test('a segment that crosses the rectangle blocks', () => {
  assert.equal(segmentIntersectsRect(50, 125, 200, 125, rect), true);
  assert.equal(segmentIntersectsRect(125, 0, 125, 200, rect), true);
});

test('touching the edge counts as blocked (closed rectangles)', () => {
  assert.equal(segmentIntersectsRect(0, 100, 100, 100, rect), true);
});

test('a degenerate segment inside the rectangle blocks', () => {
  assert.equal(segmentIntersectsRect(120, 120, 120, 120, rect), true);
  assert.equal(segmentIntersectsRect(5, 5, 5, 5, rect), false);
});

test('open line of sight is full volume', () => {
  const result = occlusionBetween({ x: 50, y: 50 }, { x: 200, y: 50 }, [rect]);
  assert.equal(result.soundFactor, 1);
  assert.equal(result.blocks, 0);
});

test('one concrete wall leaves 10% of the voice', () => {
  const result = occlusionBetween({ x: 50, y: 125 }, { x: 200, y: 125 }, [rect]);
  assert.equal(result.blocks, 1);
  assert.ok(Math.abs(result.soundFactor - 0.1) < 1e-9, `got ${result.soundFactor}`);
  assert.deepEqual(result.obstacles, ['wall']);
});

test('two walls multiply to a full mute', () => {
  const second = { ...rect, id: 'wall-2', x: 300, y: 100 };
  const result = occlusionBetween({ x: 50, y: 125 }, { x: 400, y: 125 }, [rect, second]);
  assert.equal(result.blocks, 2);
  assert.ok(result.soundFactor < 0.02, `got ${result.soundFactor}`);
});

test('obstacles flagged blocksAudio=false are ignored', () => {
  const screen = { ...rect, blocksAudio: false, attenuation: 0 };
  const result = occlusionBetween({ x: 50, y: 125 }, { x: 200, y: 125 }, [screen]);
  assert.equal(result.soundFactor, 1);
});

test('movement slides along furniture instead of stopping dead', () => {
  const solids = [{ id: 'desk', x: 100, y: 100, w: 100, h: 100 }];
  // Walk straight into the left face of the desk.
  const stopped = resolveCollision(95, 150, 14, solids);
  assert.equal(stopped.x, 86, 'avatar is pushed out to the left edge');
  assert.ok(stopped.y > 0 && stopped.y < 1000);
  assert.equal(stopped.hit, true);

  // Free space is untouched.
  const free = resolveCollision(400, 400, 14, solids);
  assert.deepEqual({ x: free.x, y: free.y }, { x: 400, y: 400 });
  assert.equal(free.hit, false);
});