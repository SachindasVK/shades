const mongoose = require('mongoose');
const { Schema } = mongoose;

const brandSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  logo: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['Available', 'Unavailable'],
    default: 'Available'
  }
}, { timestamps: true });

// Create a case-insensitive unique index on the name field
brandSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

const Brand = mongoose.model('Brand', brandSchema);
module.exports = Brand;