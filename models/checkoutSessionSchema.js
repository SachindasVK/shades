const checkoutSessionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    sessionId: {
        type: String,
        required: true,
        unique: true
    },
    selectedAddressId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Address'
    },
    shippingMethod: {
        type: String,
        enum: ['standard', 'express', 'overnight']
    },
    paymentMethod: {
        type: String,
        enum: ['card', 'wallet', 'cod', 'upi']
    },
    cartItems: [{
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product'
        },
        quantity: Number,
        price: Number
    }],
    totalAmount: Number,
    step: {
        type: Number,
        default: 1 // 1: Address, 2: Shipping, 3: Payment
    },
    expiresAt: {
        type: Date,
        default: Date.now,
        expires: 3600 // 1 hour
    }
}, {
    timestamps: true
});

const CheckoutSession = mongoose.model('CheckoutSession', checkoutSessionSchema);