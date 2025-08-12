const mongoose = require('mongoose');
const { Schema } = mongoose;

const brandSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    logo: {
      type: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['available', 'Unavailable'],
      default: 'available',
    },
  },
  { timestamps: true }
);

brandSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

const Brand = mongoose.model('Brand', brandSchema);
module.exports = Brand;
