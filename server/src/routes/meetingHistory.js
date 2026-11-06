import { Router } from 'express';

import MeetingHistory from '../models/MeetingHistory.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * GET /api/meetings/history
 *
 * Returns the authenticated user's meeting history.
 *
 * Query parameters:
 * - page: Page number (default: 1)
 * - limit: Records per page (default: 20, maximum: 100)
 * - status: Optional active, completed or abandoned
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        ok: false,
        error: 'Authentication required.',
      });
    }

    const requestedPage = Number.parseInt(req.query.page, 10);
    const requestedLimit = Number.parseInt(req.query.limit, 10);

    const page =
      Number.isInteger(requestedPage) && requestedPage > 0
        ? requestedPage
        : 1;

    const limit =
      Number.isInteger(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, MAX_LIMIT)
        : DEFAULT_LIMIT;

    const filter = { userId };

    if (req.query.status !== undefined) {
      const allowedStatuses = [
        'active',
        'completed',
        'abandoned',
      ];

      if (!allowedStatuses.includes(req.query.status)) {
        return res.status(400).json({
          ok: false,
          error: 'Invalid meeting status filter.',
        });
      }

      filter.status = req.query.status;
    }

    const skip = (page - 1) * limit;

    const [meetings, total] = await Promise.all([
      MeetingHistory.find(filter)
        .sort({ startedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select(
          [
            '_id',
            'sessionId',
            'roomId',
            'roomName',
            'username',
            'role',
            'status',
            'startedAt',
            'endedAt',
            'lastSeenAt',
            'durationSeconds',
            'participantCountAtJoin',
          ].join(' '),
        )
        .lean(),

      MeetingHistory.countDocuments(filter),
    ]);

    return res.status(200).json({
      ok: true,
      data: {
        meetings,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page * limit < total,
          hasPreviousPage: page > 1,
        },
      },
    });
  } catch (error) {
    console.error(
      'Meeting history retrieval failed:',
      error.message,
    );

    return res.status(500).json({
      ok: false,
      error: 'Unable to retrieve meeting history.',
    });
  }
});

export default router;