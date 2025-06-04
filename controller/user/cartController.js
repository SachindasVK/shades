const User = require('../../models/userSchema')
const Cart = require('../../models/cartSchema')


const getCart = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);
        
         const cartData = await Cart.findOne({ userId }).populate("items.productId");
        res.render('cart', {
            username: userData?.name || "Guest",
            cartItems: cartData?.items || []
        });
    } catch (error) {
        console.log("Error in getCart:", error);
        res.redirect('/error-page'); // Optional error redirect
    }
};


module.exports = {
    getCart
}