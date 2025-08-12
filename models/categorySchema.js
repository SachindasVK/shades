const mongoose = require('mongoose');
const { Schema } = mongoose;

const categorySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    shape: {
      type: String,
      trim: true,
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
    hasOffer: {
      type: Boolean,
      default: false,
    },
    offerPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 99,
    },
    offerStartDate: {
      type: Date,
      default: null,
    },
    offerEndDate: {
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

const Category = mongoose.model('Category', categorySchema);
module.exports = Category;
