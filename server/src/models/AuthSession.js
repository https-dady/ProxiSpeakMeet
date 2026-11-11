import mongoose from 'mongoose';

const authSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    tokenHash: {
      type: String,
      required: true,
      unique: true,
      select: false,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: {
        expireAfterSeconds: 0,
      },
    },

    lastUsedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

/*
 * Efficiently retrieve active sessions belonging to a user.
 */

authSessionSchema.index({
  userId: 1,
  expiresAt: 1,
});

const AuthSession =
  mongoose.models.AuthSession ||
  mongoose.model('AuthSession', authSessionSchema);

export default AuthSession;