import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters long'],
      maxlength: [50, 'Username cannot exceed 50 characters'],
    },

    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters long'],
      select: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Hash the password before saving a new password.
userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }

  this.password = await bcrypt.hash(this.password, 12);
});

// Compare the entered password with the stored password hash.
userSchema.methods.comparePassword = async function (
  candidatePassword,
) {
  if (
    typeof candidatePassword !== 'string' ||
    typeof this.password !== 'string'
  ) {
    return false;
  }

  return bcrypt.compare(candidatePassword, this.password);
};

// Reuse the existing model if it has already been registered.
const User =
  mongoose.models.User || mongoose.model('User', userSchema);

export default User;