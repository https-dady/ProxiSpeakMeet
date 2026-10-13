/**
 * Geospatial Engine (Week 1 + 2).
 *
 * Every avatar is stored as a GeoJSON point inside a 2dsphere index, so the
 * three primitives the spatial rules need are answered by MongoDB itself:
 *
 *   $near        -> "who is in earshot, closest first"   (signaling radius)
 *   $geoWithin   -> "how many avatars are inside a circle" (cluster sizing)
 *   $geoNear     -> aggregation variant that adds a distanceField for clustering
 *
 * Queries go through the raw driver collection (`UserPresence.collection`)
 * because `$near` must sit directly on the indexed path and lean() avoids
 * document hydration on a hot, high-frequency code path.
 */
import UserPresence from '../models/UserPresence.js';
import { distancePx } from '../utils/geo.js';

const PROJECTION = { sessionId: 1, name: 1, color: 1, avatar: 1, x: 1, y: 1, angle: 1, micEnabled: 1, location: 1 };

export class GeospatialService {
  #transform;
  #log;

  constructor({ transform, logger }) {
    this.#transform = transform;
    this.#log = logger;
  }

  get collection() {
    return UserPresence.collection;
  }

  #nearFilter({ roomId, sessionId, x, y, radiusPx }) {
    return {
      roomId,
      ...(sessionId ? { sessionId: { $ne: sessionId } } : {}),
      location: {
        $near: {
          $geometry: this.#transform.point(x, y),
          $maxDistance: this.#transform.maxDistanceMeters(radiusPx),
        },
      },
    };
  }

  /**
   * $near: peers inside `radiusPx`, ordered nearest-first (index order).
   * @returns {Promise<Array<{sessionId:string,x:number,y:number,distanceMeters:number,distancePx:number}>>}
   */
  async findPeersInRadius({ roomId, sessionId, x, y, radiusPx, limit = 64 }) {
    const docs = await this.collection
      .find(this.#nearFilter({ roomId, sessionId, x, y, radiusPx }))
      .project(PROJECTION)
      .limit(limit)
      .toArray();

    return docs.map((doc) => ({
      sessionId: doc.sessionId,
      name: doc.name,
      color: doc.color,
      avatar: doc.avatar,
      x: doc.x,
      y: doc.y,
      angle: doc.angle,
      micEnabled: doc.micEnabled !== false,
      distanceMeters: doc.distanceMeters ?? null,
      distancePx: distancePx(x, y, doc.x, doc.y),
    }));
  }

  /** $geoWithin: cheap count of everyone inside the earshot circle. */
  async countWithinRadius({ roomId, x, y, radiusPx }) {
    return this.collection.countDocuments({
      roomId,
      location: { $geoWithin: this.#transform.centerSphere(x, y, radiusPx) },
    });
  }

  /** $geoWithin with the caller's own session excluded. */
  async countNeighborsExcluding({ roomId, sessionId, x, y, radiusPx }) {
    return this.collection.countDocuments({
      roomId,
      sessionId: { $ne: sessionId },
      location: { $geoWithin: this.#transform.centerSphere(x, y, radiusPx) },
    });
  }

  /**
   * $geoNear aggregation + single-linkage clustering.
   *
   * $geoNear gives us every avatar in the room with a distance to the probe
   * point; we then group avatars whose *own* distance to each other is under
   * `clusterGapPx`, which is what "these three people are having a
   * conversation" actually means.
   *
   * @returns {Promise<{clusters:Array, participants:number}>}
   */
  async buildClusters({ roomId, x, y, clusterGapPx, limit = 500 }) {
    const rows = await this.collection
      .aggregate([
        {
          $geoNear: {
            near: this.#transform.point(x, y),
            distanceField: 'distanceMeters',
            spherical: true,
            key: 'location',
            query: { roomId },
          },
        },
        { $limit: limit },
        { $project: { _id: 0, sessionId: 1, x: 1, y: 1, name: 1, color: 1, distanceMeters: 1 } },
      ])
      .toArray();

    const points = rows.map((row) => ({ ...row, distancePx: distancePx(x, y, row.x, row.y) }));

    const parent = new Map(points.map((p) => [p.sessionId, p.sessionId]));
    const find = (id) => {
      let root = id;
      while (parent.get(root) !== root) root = parent.get(root);
      let node = id;
      while (parent.get(node) !== root) {
        const next = parent.get(node);
        parent.set(node, root);
        node = next;
      }
      return root;
    };
    const union = (a, b) => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent.set(rb, ra);
    };

    // O(n^2) inside a single room is bounded and tiny (<= limit^2 comparisons).
    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        if (distancePx(points[i].x, points[i].y, points[j].x, points[j].y) <= clusterGapPx) {
          union(points[i].sessionId, points[j].sessionId);
        }
      }
    }

    const groups = new Map();
    for (const point of points) {
      const root = find(point.sessionId);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root).push(point);
    }

    const clusters = [...groups.entries()].map(([root, members]) => {
      const cx = members.reduce((sum, m) => sum + m.x, 0) / members.length;
      const cy = members.reduce((sum, m) => sum + m.y, 0) / members.length;
      return {
        id: root,
        size: members.length,
        centroid: { x: Math.round(cx), y: Math.round(cy) },
        meanDistanceMeters: members.reduce((sum, m) => sum + m.distanceMeters, 0) / members.length,
        members: members.map((m) => ({ sessionId: m.sessionId, name: m.name, color: m.color, x: m.x, y: m.y })),
      };
    });

    clusters.sort((a, b) => b.size - a.size);
    return { clusters, participants: points.length };
  }

  /**
   * Proves the 2dsphere index is actually serving the query (IXSCAN / geo
   * stage) rather than a collection scan.
   */
  async explainNear({ roomId, x, y, radiusPx }) {
    const explain = await this.collection
      .find(this.#nearFilter({ roomId, x, y, radiusPx }))
      .explain('executionStats');

    const stages = explain.queryPlanner?.winningPlan?.inputStage ?? null;
    const stageName = stages?.stage ?? (stages?.queryPlan?.inputStage?.stage ?? 'UNKNOWN');
    const indexName = stages?.indexName ?? stages?.inputStage?.indexName ?? explain.queryPlanner?.winningPlan?.inputStage?.indexName ?? '';
    const stats = explain.executionStats ?? {};

    return {
      stage: stageName,
      indexName: indexName || 'location_2dsphere',
      totalDocsExamined: stats.totalDocsExamined ?? 0,
      totalKeysExamined: stats.totalKeysExamined ?? 0,
      nReturned: stats.nReturned ?? 0,
      executionTimeMillis: stats.executionTimeMillis ?? null,
      indexed: /IXSCAN|geo/i.test(stageName) || (stats.totalDocsExamined > 0 && stats.totalDocsExamined <= (stats.nReturned ?? 0) + 4),
    };
  }

  /** True when the 2dsphere index exists (checked once at boot). */
  async hasGeoIndex() {
    try {
      const indexes = await this.collection.indexes();
      return indexes.some((index) => index.key === 'location' || (index.key && index.key.location === '2dsphere'));
    } catch (err) {
      this.#log.warn('could not read indexes:', err.message);
      return false;
    }
  }
}

export default GeospatialService;