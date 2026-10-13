/**
 * Service container. Everything the socket + HTTP layers need, constructed in
 * one place and injectable so the whole stack can be exercised in tests with
 * in-memory doubles.
 */
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { createGeoTransform } from '../utils/geo.js';
import { occlusionBetween } from './obstacleService.js';
import { GeospatialService } from './geospatialService.js';
import { PresenceStore } from './presenceStore.js';
import { PeerGraph } from './peerGraph.js';
import { AuditService } from './auditService.js';
import { getCachedRoom, chooseSpawn, getRoom, listRooms, persistRoom, invalidateRoomCache } from './roomService.js';

export function createServices({
  emit = () => {},
  geospatial: geospatialOverride = null,
  logger: loggerOverride = logger,
  config: configOverride = config,
} = {}) {
  const transform = createGeoTransform(configOverride.world);
  const geospatial =
    geospatialOverride ??
    new GeospatialService({
      transform,
      logger: loggerOverride.child('geo'),
    });
  const store = new PresenceStore({ transform, logger: loggerOverride.child('presence') });

  const peerGraph = new PeerGraph({
    earshotPx: configOverride.world.earshotRadiusPx,
    emit,
    logger: loggerOverride.child('mesh'),
    // Occlusion needs the room's furniture, which is cached in memory after the
    // first lookup, so this stays synchronous on the hot path.
    resolveSoundFactor: (a, b) => {
      const room = getCachedRoom(a.roomId);
      if (!room) return 1;
      return occlusionBetween(a, b, room.obstacles).soundFactor;
    },
    isReady: (user) => user.ready !== false,
  });

  const audit = new AuditService({
    geospatial,
    transform,
    budgetMs: configOverride.spatial.auditBudgetMs,
    logger: loggerOverride.child('audit'),
  });

  return {
    config: configOverride,
    transform,
    geospatial,
    store,
    peerGraph,
    audit,
    getRoom,
    getCachedRoom,
    listRooms,
    persistRoom,
    invalidateRoomCache,
    chooseSpawn,
  };
}

export default createServices;