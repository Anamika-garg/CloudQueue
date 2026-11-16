'use strict';

const mongoose = require('mongoose');

const ROLE_VALUES = ['user', 'admin', 'super_admin'];

const userSchema = new mongoose.Schema(
  {
    firebaseUid: { type: String, required: true, unique: true, trim: true },
    email: {
      type: String,
      required: true,
      index: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email address'],
    },
    displayName: { type: String, default: '', trim: true, maxlength: 120 },
    role: { type: String, enum: ROLE_VALUES, default: 'user', index: true },
    photoUrl: { type: String, default: '' },
    lastLoginAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false }
);

const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = User;
module.exports.ROLE_VALUES = ROLE_VALUES;
