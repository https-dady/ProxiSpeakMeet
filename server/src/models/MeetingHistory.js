import mongoose from 'mongoose';

const MeetingHistorySchema = new mongoose.Schema(
  {
    // Authenticated account that participated in this meeting.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Unique identifier for one participant's meeting session.
    // This is different from roomId because the same room
    // can host multiple meetings over time.
    sessionId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    // Existing ProxiSpeak virtual office identifier.
    roomId: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 48,
    },

    // Snapshot of the room name at the time of participation.
    roomName: {
      type: String,
      default: '',
      trim: true,
      maxlength: 100,
    },

    // Snapshot of the participant's username.
    username: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },

    role: {
      type: String,
      enum: ['host', 'participant'],
      default: 'participant',
      required: true,
    },

    status: {
      type: String,
      enum: ['active', 'completed', 'abandoned'],
      default: 'active',
      required: true,
      index: true,
    },

    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },

    endedAt: {
      type: Date,
      default: null,
    },

    lastSeenAt: {
      type: Date,
      required: true,
      default: Date.now,
    },

    durationSeconds: {
      type: Number,
      default: 0,
      min: 0,
      validate: Number.isFinite,
    },

    participantCountAtJoin: {
      type: Number,
      default: 1,
      min: 1,
      validate: Number.isInteger,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// A user cannot have duplicate history records for the same session.
MeetingHistorySchema.index(
  {
    userId: 1,
    sessionId: 1,
  },
  {
    unique: true,
  },
);

// Dashboard history: newest meetings first.
MeetingHistorySchema.index({
  userId: 1,
  startedAt: -1,
});

// Room-level history and diagnostics.
MeetingHistorySchema.index({
  roomId: 1,
  startedAt: -1,
});

// Helps locate sessions that were interrupted unexpectedly.
MeetingHistorySchema.index({
  status: 1,
  lastSeenAt: 1,
});

const MeetingHistory =
  mongoose.models.MeetingHistory ||
  mongoose.model('MeetingHistory', MeetingHistorySchema);

export default MeetingHistory;