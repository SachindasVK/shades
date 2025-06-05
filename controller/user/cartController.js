const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const Cart = require('../../models/cartSchema');
const Wishlist = require('../../models/wishlistSchema');

const getCart = async (req, res) => {
  try {
    const userId = req.session.user;

    const cart = await Cart.findOne({ userId }).populate({
      path: 'items.productId',
      model: 'Product',
      populate:[
      { path: "brand", model: "Brand" },
      { path: "category", model: "Category" }
    ]
    });

    if (!cart) {
      return res.render('cart', {
        username: '',
        cartItems: [],
        grandTotal: 0
      });
    }

    // Clean-up: Remove out-of-stock or invalid items
    cart.items = cart.items.filter(item => {
      const product = item.productId;
      return (
        product &&
        product.quantity > 0 &&
         (!product.isBlocked || product.isBlocked === false)&&
        product.category &&
        product.category.status === 'Available'
      );
    });

    await cart.save();

    // Prepare data for rendering
    const cartItems = cart.items.map(item => ({
      product: item.productId,
      quantity: item.quantity,
      price: item.productId.price,
      totalPrice: item.productId.salesPrice * item.quantity
    }));

    const grandTotal = cartItems.reduce((total, item) => total + item.totalPrice, 0);

    const user = await User.findById(userId);

    res.render('cart', {
      username: user?.name || '',
      cartItems,
      grandTotal
    });

  } catch (error) {
    console.log("Error in getCart:", error);
    res.status(500).render('error', {
      message: 'Something went wrong loading your cart',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
};



const  addToCart = async (req, res) => {
    try {
        const userId = req.session.user;
        const { productId, quantity } = req.body;

        if (!userId) {
            return res.status(400).json({ success: false, message: 'You are not logged in!' });
        }

        if (!productId || quantity <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid product or quantity' });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(400).json({ success: false, message: 'Product not found' });
        }

        const itemPrice = product.salePrice; // `product.price` does NOT exist in your schema
        const itemTotal = itemPrice * quantity;

        let cart = await Cart.findOne({ userId });

        if (!cart) {
            cart = new Cart({ userId, items: [] });
        }

        const existingItem = cart.items.find(item => item.productId.toString() === productId);

        if (existingItem) {
            existingItem.quantity += quantity;
            existingItem.totalPrice = existingItem.quantity * itemPrice;
            existingItem.price = itemPrice; // In case price changed
        } else {
            cart.items.push({
                productId,
                quantity,
                price: itemPrice,
                totalPrice: itemTotal
            });
        }

        await cart.save();

        const cartCount = cart.items.reduce((total, item) => total + item.quantity, 0);
        res.json({ success: true, cartCount });

    } catch (error) {
        console.error('Add to Cart Error:', error);
        res.status(500).json({ success: false, message: 'Something went wrong' });
    }
};

const removeCart = async(req,res)=>{
    try {
        const userId = req.session.user;
        const {productId} = req.body;

        if(!userId){
            return res.status(401).json({success:false,message:'please login first'})
        }

        const cart = await Cart.findOne({userId})

        if(!cart){
            return res.status(404).json({success:false,message:'Cart not found'})
        }
        cart.items = cart.items.filter(item=>item.productId.toString()!==productId)
console.log('Cart after removal:', cart.items);
        await cart.save()
        res.json({success:true})
    } catch (error) {
        console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
    }
}
module.exports = {
    getCart,
   addToCart,
   removeCart
};