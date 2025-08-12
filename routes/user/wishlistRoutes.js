const express = require('express');
const wishlistController = require('../../controller/user/wishlistController');
const { userAuth } = require('../../middlewares/auth');
const router = express.Router();

//wishlist management
router.get('/wishlist', userAuth, wishlistController.loadWishlist);
router.post('/addtowishlist', userAuth, wishlistController.addToWishlist);
router.delete('/wishlist/remove/:id', userAuth, wishlistController.removeFromWishlist);
router.post('/wishlist/status', userAuth, wishlistController.getWishlistStatus);
router.get('/wishlist/count', userAuth, wishlistController.wishlistCount);

module.exports = router;
