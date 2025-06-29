const User = require('../models/userSchema')
const Cart = require('../models/cartSchema')
const userAuth = async (req, res, next) => {
  try {
    res.locals.isLoggedIn = false;
    res.locals.user = null;

    if (!req.session.user) {
      return res.redirect('/login');
    }

    const userId = req.session.user?._id || req.session.user;
    const user = await User.findById(userId);

    if (!user) {
      req.session.destroy((err) => {
        if (err) console.log('Error destroying session:', err);
        res.redirect('/login');
      });
      return;
    }

    if (user.isBlocked) {
      req.session.message = 'Access denied. Your account has been blocked.';
      req.session.destroy((err) => {
        if (err) console.log('Error destroying session:', err);
        res.redirect('/login');
      });
      return;
    }

    req.user = user;
    res.locals.user = user;
    res.locals.isLoggedIn = true;

    next();
  } catch (error) {
    console.log('Error in userAuth middleware:', error);
    req.session.destroy((err) => {
      if (err) console.log('Error destroying session:', err);
      res.status(500).send('Internal server error');
    });
  }
};



const adminAuth = async (req, res, next) => {
    try {
        const adminId = req.session.admin;

        if (!adminId) {
            return res.redirect('/admin/login');
        }

        const adminUser = await User.findById(adminId);

        if (adminUser && adminUser.isAdmin) {
            next();
        } else {
            res.redirect('/admin/login');
        }
    } catch (error) {
        console.error('Error in adminAuth middleware:', error);
        res.status(500).send('Internal Server Error!');
    }
};




const validateCartStock = async (req, res, next) => {
  try {
    const userId = req.session.user;
    const cart = await Cart.findOne({ userId }).populate('items.productId');

    if (!cart || cart.items.length === 0) {
      return res.redirect('/cart'); // redirect if empty
    }

    const outOfStockItems = cart.items.filter(item => {
      const product = item.productId;
      return !product || product.quantity < item.quantity;
    });

    if (outOfStockItems.length > 0) {
      req.session.cartError = "Some items in your cart are out of stock. Please update your cart.";
      return res.redirect('/cart');
    }

    next(); // everything ok
  } catch (error) {
    console.error("Checkout stock validation failed:", error);
    res.redirect('/cart');
  }
};

module.exports = {
    userAuth,
    adminAuth,
    validateCartStock
}