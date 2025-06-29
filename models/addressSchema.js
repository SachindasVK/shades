const mongoose = require('mongoose');
const { Schema } = mongoose;

const addressSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    address: [{
        isDefault: {
            type: Boolean,
            default: false
        },
        addressType: {
            type: String,
            required: true
        },
        name: {
            type: String,
            required: true
        },
        country: {
            type: String,
            required: true
        },
        city: {
            type: String,
            required: true
        },
        area: {
            type: String,
            required: true
        },
        streetAddress: {
            type: String,
            required: true
        },
        landMark: {
            type: String,
            required: false
        },
        state: {
            type: String,
            required: true
        },
        pincode: {
            type: Number,
            required: true
        },
        phone: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: true
        }
    }]
})

const Address = mongoose.model('Address', addressSchema);

module.exports = Address;