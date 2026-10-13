/**
 * Spatial Audit (Mid-Project Review).
 *
 * Proves three things, with numbers:
 *   1. ACCURACY - every row returned by $near really is inside the radius, the
 *      distances MongoDB reports match plain Euclidean pixel maths, and $near
 *      and $geoWithin agree on the population size.
 *   2. INDEX USE - the winning plan is a geo/IXSCAN stage on location_2dsphere,
 *      not a collection scan.
 *   3. SPEED - min / avg / p95 / max over N samples, checked against a 20 ms
 *      budget (the hard requirement for the mid-project review).
 */
import { performance } from 'node:perf_hooks';
import SpatialAudit from '../models/SpatialAudit.js';

const hr = () => performance.now();

const percentile = (sorted, p) => {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
};

const summarise = (samples) => {
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  return {
    samples: sorted.length,
    minMs: round(sorted[0] ?? 0),
    avgMs: round(sum / (sorted.length || 1)),
    p95Ms: round(percentile(sorted, 95)),
    maxMs: round(sorted[sorted.length - 1] ?? 0),
  };
};

const round = (n) => Math.round(n * 1000) / 1000;

export class AuditService {
  #geo;
  #log;
  #budgetMs;
  #transform;

  constructor({ geospatial, transform, budgetMs, logger }) {
    this.#geo = geospatial;
    this.#transform = transform;
    this.#budgetMs = budgetMs;
    this.#log = logger;
  }

  /**
   * @param {{roomId:string,x:number,y:number,radiusPx:number,samples?:number,
   *          includeClusters?:boolean,includeExplain?:boolean,persist?:boolean,
   *          source?:'http'|'cli'|'scheduler',instanceId?:string,audit?:boolean}} options
   */
  async run({
    roomId,
    x,
    y,
    radiusPx,
    samples = 25,
    includeClusters = true,
    includeExplain = true,
    persist = true,
    source = 'http',
    instanceId = '',
    audit = true,
    clusterGapPx,
  }) {
    const startedAt = hr();
    const nearSamples = [];
    const withinSamples = [];
    const clusterSamples = [];
    let lastPeers = [];
    let lastNearCount = 0;
    let lastWithinCount = 0;
    let clusters = null;
    let clusterParticipants = 0;
    let explain = null;

    for (let i = 0; i < samples; i += 1) {
      const t0 = hr();
      const peers = await this.#geo.findPeersInRadius({ roomId, x, y, radiusPx });
      nearSamples.push(hr() - t0);
      lastPeers = peers;
      lastNearCount = peers.length;

      const t1 = hr();
      const within = await this.#geo.countWithinRadius({ roomId, x, y, radiusPx });
      withinSamples.push(hr() - t1);
      lastWithinCount = within;

      if (includeClusters && i === 0) {
        const t2 = hr();
        const result = await this.#geo.buildClusters({
          roomId,
          x,
          y,
          clusterGapPx: clusterGapPx ?? radiusPx,
        });
        clusterSamples.push(hr() - t2);
        clusters = result.clusters;
        clusterParticipants = result.participants;
      }
    }

    if (includeExplain) {
      explain = await this.#geo.explainNear({ roomId, x, y, radiusPx }).catch((err) => ({
        error: err.message,
        stage: 'UNKNOWN',
        indexed: false,
      }));
    }

    const near = summarise(nearSamples);
    const within = summarise(withinSamples);
    const clusterStats = summarise(clusterSamples);

    // --- accuracy -------------------------------------------------------
    const radiusInMeters = this.#transform.maxDistanceMeters(radiusPx);
    const falsePositives = lastPeers.filter((peer) => peer.distancePx > radiusPx + 0.5).length;
    let maxDistanceDriftPx = 0;
    for (const peer of lastPeers) {
      if (typeof peer.distanceMeters !== 'number') continue;
      maxDistanceDriftPx = Math.max(
        maxDistanceDriftPx,
        Math.abs(this.#transform.metersToPixels(peer.distanceMeters) - peer.distancePx),
      );
    }

    const accuracy = {
      matchedPeers: lastNearCount,
      matchedWithin: lastWithinCount,
      operatorsAgree: lastNearCount === lastWithinCount,
      falsePositives,
      // Sub-pixel agreement between MongoDB's spherical distance and our maths.
      maxDistanceDriftPx: round(maxDistanceDriftPx),
      radiusPx,
      radiusMeters: round(radiusInMeters),
      passed: lastNearCount === lastWithinCount && falsePositives === 0 && maxDistanceDriftPx < 1,
    };

    const withinBudget = near.p95Ms <= this.#budgetMs && within.p95Ms <= this.#budgetMs && clusterStats.p95Ms <= this.#budgetMs;
    const passed = accuracy.passed && withinBudget && (!explain || explain.indexed !== false);

    const report = {
      ok: passed,
      roomId,
      probe: { x, y, radiusPx },
      budgetMs: this.#budgetMs,
      withinBudget,
      accuracy,
      queries: { near, within, cluster: clusterStats },
      clusters: clusters
        ? {
            participants: clusterParticipants,
            count: clusters.length,
            largest: clusters[0]?.size ?? 0,
            preview: clusters.slice(0, 5).map((cluster) => ({
              id: cluster.id,
              size: cluster.size,
              centroid: cluster.centroid,
              members: cluster.members.map((m) => m.name),
            })),
          }
        : null,
      index: explain,
      totalMs: round(hr() - startedAt),
      source,
      instanceId,
      at: new Date().toISOString(),
    };

    if (persist) {
      const worst = Math.max(near.p95Ms, within.p95Ms, clusterStats.p95Ms);
      await SpatialAudit.create({
        roomId,
        source,
        trigger: 'near+within+cluster',
        budgetMs: this.#budgetMs,
        minMs: near.minMs,
        avgMs: near.avgMs,
        p95Ms: worst,
        maxMs: near.maxMs,
        matched: lastNearCount,
        indexUsed: explain?.indexName ?? '',
        withinBudget,
        details: { accuracy, queries: report.queries },
        instanceId,
      }).catch((err) => this.#log.warn('could not persist audit record:', err.message));
    }

    if (audit) {
      const level = passed ? 'info' : 'warn';
      this.#log[level](
        `[spatial-audit] ${roomId} near p95=${near.p95Ms}ms within p95=${within.p95Ms}ms ` +
          `matches=${lastNearCount} index=${explain?.indexName ?? 'n/a'}/${explain?.stage ?? 'n/a'} ` +
          `budget=${this.#budgetMs}ms -> ${passed ? 'PASS' : 'FAIL'}`,
      );
    }

    return report;
  }

  /** Historical p95 trend, so the review can show the budget is respected over time. */
  async history(roomId, limit = 20) {
    const rows = await SpatialAudit.find({ roomId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    const worst = rows.reduce((max, row) => Math.max(max, row.p95Ms ?? 0), 0);
    return {
      runs: rows.length,
      worstP95Ms: round(worst),
      budgetMs: this.#budgetMs,
      ok: worst <= this.#budgetMs,
      history: rows.map((row) => ({
        at: row.createdAt,
        p95Ms: row.p95Ms,
        matched: row.matched,
        indexUsed: row.indexUsed,
        withinBudget: row.withinBudget,
      })),
    };
  }
}

const withinStats = (within) => within;

export { withinStats };
export default AuditService;