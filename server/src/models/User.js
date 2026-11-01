import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required.'],
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 50,
    },

    email: {
      type: String,
      required: [true, 'Email is required.'],
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Please provide a valid email address.',
      ],
    },

    password: {
      type: String,
      required: [true, 'Password is required.'],
      minlength: 8,
      select: false,
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
      index: true,
    },

    emailVerificationOtpHash: {
      type: String,
      default: null,
      select: false,
    },

    emailVerificationOtpExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },

    emailVerificationOtpLastSentAt: {
      type: Date,
      default: null,
      select: false,
    },

    passwordResetOtpHash: {
      type: String,
      default: null,
      select: false,
    },

    passwordResetOtpExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },

    passwordResetOtpLastSentAt: {
      type: Date,
      default: null,
      select: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }

  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  if (typeof candidatePassword !== 'string' || !this.password) {
    return false;
  }

  return bcrypt.compare(candidatePassword, this.password);
};

const User =
  mongoose.models.User || mongoose.model('User', userSchema);

export default User;