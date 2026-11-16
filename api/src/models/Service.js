'use strict';

const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      minlength: 2,
      maxlength: 5,
      match: [/^[A-Z]{2,5}$/, 'Code must be 2-5 uppercase letters'],
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: '', trim: true, maxlength: 500 },
    location: { type: String, default: '', trim: true, maxlength: 160 },
    averageServiceMinutes: { type: Number, default: 5, min: 1, max: 180 },
    color: {
      type: String,
      enum: ['indigo', 'emerald', 'amber', 'rose', 'sky', 'violet', 'teal', 'orange'],
      default: 'indigo',
    },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: String, default: null },
  },
  { timestamps: true, versionKey: false }
);

serviceSchema.virtual('displayCode').get(function displayCode() {
  return `[${this.code}]`;
});

const Service = mongoose.models.Service || mongoose.model('Service', serviceSchema);

module.exports = Service;
