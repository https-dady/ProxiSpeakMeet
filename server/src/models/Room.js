import mongoose from 'mongoose';

/**
 * A persisted office: dimensions, furniture, access policy and ownership.
 *
 * Existing rooms remain public by default for backward compatibility.
 * Private rooms are restricted to their owner and explicitly allowed users.
 */
const ObstacleSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      enum: ['wall', 'desk', 'plant', 'pillar', 'screen'],
      default: 'wall',
    },
    x: { type: Number, required: true, min: 0, validate: Number.isFinite },
    y: { type: Number, required: true, min: 0, validate: Number.isFinite },
    w: { type: Number, required: true, min: 1, validate: Number.isFinite },
    h: { type: Number, required: true, min: 1, validate: Number.isFinite },
    blocksAudio: { type: Boolean, default: true },
    attenuation: {
      type: Number,
      default: 0.2,
      min: 0,
      max: 1,
      validate: Number.isFinite,
    },
  },
  { _id: false },
);

const SpawnPointSchema = new mongoose.Schema(
  {
    x: { type: Number, required: true, min: 0, validate: Number.isFinite },
    y: { type: Number, required: true, min: 0, validate: Number.isFinite },
  },
  { _id: false },
);

const RoomSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      required: true,
      default: 'Unnamed Office',
      trim: true,
      maxlength: 80,
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },

    // Room access control.
    visibility: {
      type: String,
      enum: ['public', 'private'],
      default: 'public',
      required: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    allowedUsers: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
      ],
      default: [],
    },

    width: {
      type: Number,
      required: true,
      min: 200,
      validate: Number.isFinite,
    },
    height: {
      type: Number,
      required: true,
      min: 200,
      validate: Number.isFinite,
    },
    obstacles: {
      type: [ObstacleSchema],
      default: [],
    },
    spawnPoints: {
      type: [SpawnPointSchema],
      default: [],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

/**
 * Validate geometry as a whole because obstacle and spawn-point boundaries
 * depend on the room's width and height.
 */
RoomSchema.pre('validate', function validateRoomGeometry() {
  const width = this.width;
  const height = this.height;

  if (!Number.isFinite(width) || width < 200) {
    this.invalidate(
      'width',
      'Room width must be a finite number of at least 200',
    );
  }

  if (!Number.isFinite(height) || height < 200) {
    this.invalidate(
      'height',
      'Room height must be a finite number of at least 200',
    );
  }

  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return;
  }

  for (const [index, obstacle] of (this.obstacles ?? []).entries()) {
    const validObstacle =
      Number.isFinite(obstacle.x) &&
      Number.isFinite(obstacle.y) &&
      Number.isFinite(obstacle.w) &&
      Number.isFinite(obstacle.h) &&
      obstacle.x >= 0 &&
      obstacle.y >= 0 &&
      obstacle.w >= 1 &&
      obstacle.h >= 1 &&
      obstacle.x + obstacle.w <= width &&
      obstacle.y + obstacle.h <= height;

    if (!validObstacle) {
      this.invalidate(
        'obstacles',
        `Obstacle at index ${index} must have positive dimensions and fit within room bounds`,
      );
    }
  }

  for (const [index, point] of (this.spawnPoints ?? []).entries()) {
    const validSpawnPoint =
      Number.isFinite(point.x) &&
      Number.isFinite(point.y) &&
      point.x >= 0 &&
      point.y >= 0 &&
      point.x <= width &&
      point.y <= height;

    if (!validSpawnPoint) {
      this.invalidate(
        'spawnPoints',
        `Spawn point at index ${index} must be within room bounds`,
      );
    }
  }
});

/**
 * Private rooms must have an owner.
 * Public rooms may optionally have an owner.
 */
RoomSchema.pre('validate', function validateRoomAccess() {
  if (this.visibility === 'private' && !this.ownerId) {
    this.invalidate(
      'ownerId',
      'A private room must have an owner',
    );
  }
});

export const Room =
  mongoose.models.Room || mongoose.model('Room', RoomSchema);

export default Room;