const mongoose = require('mongoose')
const{Schema} = mongoose

const userSchema = new Schema({
    name:{
        type:String,
        required:true
    },
    email:{
        type:String,
        required:true,
        unique:true,
    },
    phone:{
        type:String,
        required:false,
        unique:false,
        sparse:true,
        default:null
    },
    image:{
        type:String,
        required:false
    },
    googleId:{
        type:String,
        unique:true,
        sparse: true
    },
    password:{
        type:String,
        required:false
    },
passwordChangedAt: {
    type: Date,
    default: Date.now
},
    isBlocked:{
        type:Boolean,
        default:false
    },
    isAdmin:{
        type:Boolean,
        default:false
    },
     username: {
        type:String,
        required:false
    },
     cart:[{
        productId: {
            type: Schema.Types.ObjectId,
            ref: 'Product'
        },
        quantity: {
            type: Number,
            default: 1
        }
    }],
    wishlist:[{
        type: Schema.Types.ObjectId,
        ref: 'Product'
    }],
    wallet:{
        type: Number,
        default: 0
    },
    orderHistory:[{
        type:Schema.Types.ObjectId,
        ref:'Order'
    }],
    createdOn:{
        type:Date,
        default:Date.now
    },
    referalCode:{
        type:String,
        // required:true
    },
    redeemed:{
        type:Boolean,
        // default:false
    },
    redeemedUsers:[{
        type:Schema.Types.ObjectId,
        ref:"User",
        // required:true
    }],
    searchHistory:[{
        category:{
            type:Schema.Types.ObjectId,
            ref:'Category'
        },
        brand:{
            type:String
        },
         searchOn:{
            type: Date,
            default: Date.now
        }
    }]
},{ timestamps: true })


const User = mongoose.model("User",userSchema)

module.exports = User