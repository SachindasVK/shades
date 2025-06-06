const Wishlist = require('../models/wishlistSchema');


const wishlistCount = async (req, res, next) => {
  try {
    const userId = req.session.user;
    if (userId) {
      const wishlist = await Wishlist.findOne({ userId: userId });
      console.log('UserId from session:', userId);
      console.log('Wishlist document:', wishlist);

      res.locals.wishlistCount = wishlist ? wishlist.products.length : 0;
    } else {
      res.locals.wishlistCount = 0;
    }
    console.log('wishlistAuth middleware running. Count:', res.locals.wishlistCount, 'URL:', req.originalUrl);
    next();
  } catch (error) {
    console.error('Wishlist count middleware error:', error);
    res.locals.wishlistCount = 0;
    next();
  }
};

module.exports = { 
    wishlistCount 
}
