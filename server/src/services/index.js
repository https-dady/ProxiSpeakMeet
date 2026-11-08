/**
 * Service container.
 *
 * All application services are constructed here and shared
 * between HTTP routes, Socket.IO and background runtime tasks.
 */

import config from '../config/index.js';
import logger from '../utils/logger.js';

import { createGeoTransform } from '../utils/geo.js';
import { occlusionBetween } from './obstacleService.js';

import { GeospatialService } from './geospatialService.js';
import { PresenceStore } from './presenceStore.js';
import { PeerGraph } from './peerGraph.js';
import { AuditService } from './auditService.js';

import {
  getCachedRoom,
  chooseSpawn,
  getRoom,
  getRoomAccess,
  listRooms,
  persistRoom,
  invalidateRoomCache,
} from './roomService.js';

import {
  createMeetingHistoryService,
} from './meetingHistoryService.js';

export function createServices({
  emit = () => {},
  geospatial: geospatialOverride = null,
  logger: loggerOverride = logger,
  config: configOverride = config,
} = {}) {
  const transform = createGeoTransform(
    configOverride.world,
  );

  const geospatial =
    geospatialOverride ??
    new GeospatialService({
      transform,
      logger: loggerOverride.child('geo'),
    });

  const store = new PresenceStore({
    transform,
    logger: loggerOverride.child('presence'),
  });

  const peerGraph = new PeerGraph({
    earshotPx:
      configOverride.world.earshotRadiusPx,

    emit,

    logger: loggerOverride.child('mesh'),

    resolveSoundFactor: (a, b) => {
      const room = getCachedRoom(a.roomId);

      if (!room) return 1;

      return occlusionBetween(
        a,
        b,
        room.obstacles,
      ).soundFactor;
    },

    isReady: (user) => user.ready !== false,
  });

  const audit = new AuditService({
    geospatial,
    transform,
    budgetMs:
      configOverride.spatial.auditBudgetMs,
    logger: loggerOverride.child('audit'),
  });

  const meetingHistory = createMeetingHistoryService({
    logger: loggerOverride.child('meeting-history'),
  });

  return {
    config: configOverride,
    transform,
    geospatial,
    store,
    peerGraph,
    audit,

    // Room services.
    getRoom,
    getRoomAccess,
    getCachedRoom,
    listRooms,
    persistRoom,
    invalidateRoomCache,
    chooseSpawn,

    // Persistent meeting history.
    meetingHistory,
  };
}

export default createServices;