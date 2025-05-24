const mongoose = require('mongoose')
const {Schema} = mongoose

const productSchema = new Schema({
    productName: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    brand: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Brand"
},

     hasOffer: {
        type: Boolean,
        default: false
    },
    offerPercentage: {
        type: Number,
        default: 0,
        min: 0,
        max: 99
    },
    category: {
        type: Schema.Types.ObjectId, 
        ref: 'Category',
        required: true
    },
    regularPrice: {
        type: Number,
        required: true
    },
    salePrice: {
        type: Number,
        required: true
    },
    productOffer: {
        type: Number,
        default: 0
    },
    quantity: {
        type: Number,
        default: 0
    },
    color: {
        type: String,
        required: true
    },
    productImage: {
        type: [String],
        required: true
    },
    isDeleted:{
        type:Boolean,
        default:false
    },
    isActive: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'out-of-stock', 'available'],
        default: 'available'
      },
      salesCount: {
    type: Number,
    default: 0
  }
}, {timestamps: true})

const Product = mongoose.model('Product', productSchema)

module.exports = Product