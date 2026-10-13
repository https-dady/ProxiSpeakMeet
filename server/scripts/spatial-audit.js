/**
 * Spatial Audit CLI — the demonstrable proof for the mid-project review.
 *
 *   npm run audit                                   (talks to MongoDB directly)
 *   npm run audit -- --users=50                     (seed 50 avatars first)
 *   npm run audit -- --url http://localhost:4000    (goes through the running server)
 *   npm run audit -- --room=studio --x=400 --y=300 --radius=100 --samples=50
 *
 * Exit code 0 = every query inside the budget, 1 = budget or accuracy failure.
 */
import process from 'node:process';
import { connectMongo, disconnectMongo } from '../src/db/mongo.js';
import { createServices } from '../src/services/index.js';
import UserPresence from '../src/models/UserPresence.js';
import { buildDefaultRoom } from '../src/services/roomService.js';
import logger from '../src/utils/logger.js';
import config from '../src/config/index.js';

const log = logger.child('audit');

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, '').split('=');
    return [key, value === undefined ? true : value];
  }),
);

const green = (s) => `\u001b[32m${s}\u001b[0m`;
const red = (s) => `\u001b[31m${s}\u001b[0m`;
const bold = (s) => `\u001b[1m${s}\u001b[0m`;
const dim = (s) => `\u001b[90m${s}\u001b[0m`;

function printReport(report) {
  const { queries, accuracy, index } = report;
  const line = (label, value) => console.log(`  ${label.padEnd(34)} ${value}`);

  console.log('');
  console.log(bold(`Spatial Audit — room "${report.roomId}"`));
  console.log(dim(`probe (${report.probe.x}, ${report.probe.y}) radius ${report.probe.radiusPx}px = ${accuracy.radiusMeters}m · budget ${report.budgetMs}ms · ${queries.near.samples} samples`));
  console.log('');
  console.log(bold('  TIMINGS'));
  for (const [name, stats] of Object.entries(queries)) {
    const ok = stats.p95Ms <= report.budgetMs;
    line(
      `$${name === 'near' ? 'near' : name === 'within' ? 'geoWithin' : 'geoNear'} (${name})`.padEnd(34),
      `min ${String(stats.minMs).padStart(7)}ms  avg ${String(stats.avgMs).padStart(7)}ms  ${ok ? green(`p95 ${String(stats.p95Ms).padStart(7)}ms`) : red(`p95 ${String(stats.p95Ms).padStart(7)}ms`)}  max ${String(stats.maxMs).padStart(7)}ms`,
    );
  }
  console.log('');
  console.log(bold('  ACCURACY'));
  line('$near matches', `${accuracy.matchedPeers}`);
  line('$geoWithin count', `${accuracy.matchedWithin}`);
  line('operators agree', accuracy.operatorsAgree ? green('yes') : red('no'));
  line('false positives outside radius', accuracy.falsePositives === 0 ? green('0') : red(accuracy.falsePositives));
  line('max distance drift vs. pixel math', `${accuracy.maxDistanceDriftPx} px`);

  if (index) {
    console.log('');
    console.log(bold('  QUERY PLAN'));
    line('winning stage', index.stage ?? 'n/a');
    line('index used', index.indexName ?? 'n/a');
    line('totalKeysExamined', String(index.totalKeysExamined ?? 'n/a'));
    line('totalDocsExamined', String(index.totalDocsExamined ?? 'n/a'));
    line('index actually used', index.indexed ? green('yes') : red('no'));
  }

  if (report.clusters) {
    console.log('');
    console.log(bold('  PROXIMITY CLUSTERS ($geoNear)'));
    line('participants', String(report.clusters.participants));
    line('clusters', String(report.clusters.count));
    line('largest conversation', String(report.clusters.largest));
    for (const cluster of report.clusters.preview) {
      console.log(dim(`    · size ${cluster.size} @ (${cluster.centroid.x}, ${cluster.centroid.y}) — ${cluster.members.join(', ')}`));
    }
  }

  console.log('');
  console.log(
    report.ok
      ? green(`  PASS  — every spatial query stayed under the ${report.budgetMs}ms budget\n`)
      : red(`  FAIL  — budget ${report.budgetMs}ms exceeded or accuracy check failed\n`),
  );
}

async function runViaHttp(url) {
  const endpoint = new URL('/api/spatial-audit', url);
  endpoint.searchParams.set('roomId', String(args.room ?? 'lobby'));
  endpoint.searchParams.set('x', String(args.x ?? config.world.width / 2));
  endpoint.searchParams.set('y', String(args.y ?? config.world.height / 2));
  endpoint.searchParams.set('radius', String(args.radius ?? config.world.earshotRadiusPx));
  endpoint.searchParams.set('samples', String(args.samples ?? 25));

  console.log(dim(`GET ${endpoint}`));
  const response = await fetch(endpoint);
  const report = await response.json();
  if (report.error) {
    console.log(red(`  server error: ${report.error}`));
    process.exit(1);
  }
  printReport(report);
  process.exit(report.ok ? 0 : 1);
}

async function runDirect() {
  await connectMongo();
  await UserPresence.createIndexes();

  if (Number(args.users ?? 0) > 0) {
    const roomId = String(args.room ?? 'lobby');
    const count = Number(args.users);
    const room = buildDefaultRoom(roomId);
    const services = createServices();
    const transform = services.transform;
    const operations = [];
    for (let i = 0; i < count; i += 1) {
      const cx = room.width * (0.25 + (i % 4) * 0.18);
      const cy = room.height * (0.3 + ((i % 4) * 37) % 40 / 100);
      const x = Math.round(Math.min(Math.max(cx + Math.sin(i * 12.9898) * 60, 0), room.width));
      const y = Math.round(Math.min(Math.max(cy + Math.cos(i * 78.233) * 60, 0), room.height));
      operations.push({
        updateOne: {
          filter: { sessionId: `audit-${roomId}-${i}`, roomId },
          update: {
            $set: {
              sessionId: `audit-${roomId}-${i}`,
              instanceId: 'audit',
              roomId,
              name: `Audit ${i}`,
              color: '#888888',
              avatar: 'circle',
              x,
              y,
              angle: 0,
              location: transform.point(x, y),
              lastSeen: new Date(),
            },
          },
          upsert: true,
        },
      });
    }
    await UserPresence.bulkWrite(operations, { ordered: false });
    log.info(`seeded ${count} synthetic avatars into "${roomId}"`);
  }

  const services = createServices({ logger });
  const roomId = String(args.room ?? 'lobby');
  const room = await services.getRoom(roomId);

  const report = await services.audit.run({
    roomId,
    x: Number(args.x ?? room.width / 2),
    y: Number(args.y ?? room.height / 2),
    radiusPx: Number(args.radius ?? config.world.earshotRadiusPx),
    samples: Number(args.samples ?? config.limits.auditSamples),
    source: 'cli',
    instanceId: 'cli',
    persist: true,
  });

  printReport(report);
  await disconnectMongo();
  process.exit(report.ok ? 0 : 1);
}

if (args.url) {
  runViaHttp(String(args.url)).catch((err) => {
    log.error(err);
    process.exit(1);
  });
} else {
  runDirect().catch(async (err) => {
    log.error(err);
    await disconnectMongo().catch(() => {});
    process.exit(1);
  });
}