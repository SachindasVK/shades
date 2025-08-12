const express = require('express');
const cartController = require('../../controller/user/cartController');
const { userAuth } = require('../../middlewares/auth');
const router = express.Router();

//Cart management
router.get('/cart', userAuth, cartController.getCart);
router.post('/cart/add', userAuth, cartController.addToCart);
router.post('/cart/remove', userAuth, cartController.removeCart);
router.post('/cart/update-quantity', userAuth, cartController.updateQuantity);
router.post('/cart/status', userAuth, cartController.getCartStatus);
router.get('/cart/count', userAuth, cartController.cartCount);

module.exports = router;
