const mongoose = require('mongoose');
const { Schema } = mongoose;

const cartSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [{
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0
    },
    status: {
      type: String,
      enum: ['Placed', 'Cancelled', 'Removed'],
      default: 'Placed'
    },
    cancellationReason: {
      type: String,
      default: 'none'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true 
});


cartSchema.pre('save', function (next) {
  this.items.forEach(item => {
    item.totalPrice = item.price * item.quantity;
  });
  next();
});


cartSchema.methods.getTotalValue = function() {
  return this.items.reduce((total, item) => {
    if (item.status === 'Placed') {
      return total + item.totalPrice;
    }
    return total;
  }, 0);
};

cartSchema.methods.getActiveItemsCount = function() {
  return this.items.filter(item => item.status === 'Placed').length;
};

const Cart = mongoose.model('Cart', cartSchema);

module.exports = Cart;
