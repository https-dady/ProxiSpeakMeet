import mongoose from 'mongoose';

import MeetingHistory from '../models/MeetingHistory.js';

const VALID_STATUSES = new Set([
  'active',
  'completed',
  'abandoned',
]);

function validateIdentity({ userId, sessionId, roomId }) {
  if (
    typeof userId !== 'string' ||
    !mongoose.Types.ObjectId.isValid(userId)
  ) {
    throw new TypeError('A valid authenticated userId is required.');
  }

  if (
    typeof sessionId !== 'string' ||
    !sessionId.trim() ||
    sessionId.length > 100
  ) {
    throw new TypeError('A valid sessionId is required.');
  }

  if (
    typeof roomId !== 'string' ||
    !/^[a-z0-9][a-z0-9_-]{0,47}$/i.test(roomId)
  ) {
    throw new TypeError('A valid roomId is required.');
  }
}

function getDurationSeconds(startedAt, endedAt) {
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return 0;
  }

  return Math.max(0, Math.floor((end - start) / 1000));
}

export function createMeetingHistoryService({
  MeetingHistoryModel = MeetingHistory,
  clock = () => new Date(),
  logger = null,
} = {}) {
  /**
   * Create a participant's meeting-history record.
   *
   * A socket session can only create one record for the same
   * authenticated account. Repeated calls are idempotent.
   */
  async function startMeeting({
    userId,
    sessionId,
    roomId,
    roomName = '',
    username,
    role = 'participant',
    participantCountAtJoin = 1,
  }) {
    validateIdentity({
      userId,
      sessionId,
      roomId,
    });

    if (
      typeof username !== 'string' ||
      !username.trim()
    ) {
      throw new TypeError('An authenticated username is required.');
    }

    if (!['host', 'participant'].includes(role)) {
      throw new TypeError('Invalid meeting participant role.');
    }

    const now = clock();

    const safeRoomName =
      typeof roomName === 'string'
        ? roomName.trim().slice(0, 100)
        : '';

    const safeParticipantCount =
      Number.isInteger(participantCountAtJoin) &&
      participantCountAtJoin >= 1
        ? participantCountAtJoin
        : 1;

    try {
      const record = await MeetingHistoryModel.findOneAndUpdate(
        {
          userId,
          sessionId,
        },
        {
          $setOnInsert: {
            userId,
            sessionId,
            roomId: roomId.toLowerCase(),
            roomName: safeRoomName,
            username: username.trim().slice(0, 50),
            role,
            status: 'active',
            startedAt: now,
            lastSeenAt: now,
            endedAt: null,
            durationSeconds: 0,
            participantCountAtJoin: safeParticipantCount,
          },
        },
        {
          new: true,
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        },
      );

      return record;
    } catch (error) {
      // A concurrent duplicate upsert may win the unique index race.
      if (error?.code === 11000) {
        const existingRecord = await MeetingHistoryModel.findOne({
          userId,
          sessionId,
        });

        if (existingRecord) {
          return existingRecord;
        }
      }

      logger?.error?.(
        'Failed to create meeting history record:',
        error,
      );

      throw error;
    }
  }

  /**
   * Update the last-seen timestamp for an active participant.
   *
   * Heartbeats never modify completed or abandoned records.
   */
  async function touchMeeting({
    userId,
    sessionId,
  }) {
    if (
      typeof userId !== 'string' ||
      !mongoose.Types.ObjectId.isValid(userId) ||
      typeof sessionId !== 'string' ||
      !sessionId.trim()
    ) {
      throw new TypeError('Valid meeting identity is required.');
    }

    return MeetingHistoryModel.findOneAndUpdate(
      {
        userId,
        sessionId,
        status: 'active',
      },
      {
        $set: {
          lastSeenAt: clock(),
        },
      },
      {
        new: true,
        runValidators: true,
      },
    );
  }

  /**
   * Finish a meeting participation record.
   *
   * Normal room leave becomes completed.
   * Unexpected disconnect becomes abandoned.
   *
   * A completed/abandoned record cannot be overwritten by a
   * later duplicate cleanup call.
   */
  async function endMeeting({
    userId,
    sessionId,
    status = 'completed',
  }) {
    if (
      typeof userId !== 'string' ||
      !mongoose.Types.ObjectId.isValid(userId) ||
      typeof sessionId !== 'string' ||
      !sessionId.trim()
    ) {
      throw new TypeError('Valid meeting identity is required.');
    }

    if (!VALID_STATUSES.has(status) || status === 'active') {
      throw new TypeError(
        'Meeting end status must be completed or abandoned.',
      );
    }

    const endedAt = clock();

    const record = await MeetingHistoryModel.findOne({
      userId,
      sessionId,
    });

    if (!record || record.status !== 'active') {
      return record;
    }

    const durationSeconds = getDurationSeconds(
      record.startedAt,
      endedAt,
    );

    record.status = status;
    record.endedAt = endedAt;
    record.lastSeenAt = endedAt;
    record.durationSeconds = durationSeconds;

    await record.save();

    return record;
  }

  /**
   * Mark stale active records as abandoned.
   *
   * This is intended for a future scheduled recovery task.
   * It is deliberately not started automatically here.
   */
  async function abandonStaleMeetings({
    olderThanMs,
  }) {
    if (
      !Number.isFinite(olderThanMs) ||
      olderThanMs <= 0
    ) {
      throw new TypeError(
        'olderThanMs must be a positive number.',
      );
    }

    const cutoff = new Date(
      clock().getTime() - olderThanMs,
    );

    const staleRecords = await MeetingHistoryModel.find({
      status: 'active',
      lastSeenAt: {
        $lt: cutoff,
      },
    }).select('_id startedAt');

    if (staleRecords.length === 0) {
      return {
        matchedCount: 0,
        modifiedCount: 0,
      };
    }

    const endedAt = clock();

    const operations = staleRecords.map((record) => ({
      updateOne: {
        filter: {
          _id: record._id,
          status: 'active',
        },
        update: {
          $set: {
            status: 'abandoned',
            endedAt,
            lastSeenAt: endedAt,
            durationSeconds: getDurationSeconds(
              record.startedAt,
              endedAt,
            ),
          },
        },
      },
    }));

    const result = await MeetingHistoryModel.bulkWrite(
      operations,
      {
        ordered: false,
      },
    );

    return {
      matchedCount: result.matchedCount ?? 0,
      modifiedCount: result.modifiedCount ?? 0,
    };
  }

  return Object.freeze({
    startMeeting,
    touchMeeting,
    endMeeting,
    abandonStaleMeetings,
  });
}

export const meetingHistoryService =
  createMeetingHistoryService();

export default meetingHistoryService;