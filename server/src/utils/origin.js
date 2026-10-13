/**
 * Origin policy shared by the Express `cors` middleware and the Socket.io
 * server, so the HTTP API and the websocket can never disagree.
 *
 *   CLIENT_URL unset -> single-origin deployment (the client bundle is served
 *                       by this same Express app), so every origin is accepted
 *                       and a warning is logged once in production.
 *   CLIENT_URL="*"   -> reflect the request origin (previews, tunnels).
 *   CLIENT_URL=a,b   -> strict allow-list.
 */
import config from '../config/index.js';
import logger from '../utils/logger.js';

const log = logger.child('origin');

let warnedOpenOrigin = false;

export function corsOrigin(cfg = config) {
  const allowed = cfg.server.clientOrigins ?? [];
  if (allowed.includes('*')) return true;
  if (allowed.length === 0) {
    // Both the Express layer and the Socket.io server ask for a policy; warn once.
    if (cfg.isProduction && !warnedOpenOrigin) {
      warnedOpenOrigin = true;
      log.warn(
        'CLIENT_URL is not set — accepting every origin. ' +
          'Set CLIENT_URL to your https:// domain to lock this down.',
      );
    }
    return true;
  }
  return (origin, callback) => {
    if (!origin || allowed.includes(origin)) return callback(null, true);
    return callback(new Error(`origin ${origin} is not allowed by CLIENT_URL`));
  };
}

export default corsOrigin;