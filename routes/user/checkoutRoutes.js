const express = require('express');
const checkoutController = require('../../controller/user/checkoutController');
const { userAuth } = require('../../middlewares/auth');
const router = express.Router();

//checkout management
router.get('/select-address', userAuth, checkoutController.getSelectAddress);
router.post('/select-address', userAuth, checkoutController.selectAddress);
router.post('/checkout/proceed-to-shipping', userAuth, checkoutController.loadShipping);
router.get('/shipping', userAuth, checkoutController.getShipping);
router.post('/checkout/proceed-to-payment', userAuth, checkoutController.proceedToPayment);
router.get('/payment', userAuth, checkoutController.loadPayment);
router.post('/place-order', userAuth, checkoutController.placeOrder);
router.get('/order-confirmation/:id', userAuth, checkoutController.confirmOrder);
router.get('/order-failure', userAuth, checkoutController.orderFailure);
router.get('/payment/:orderId', userAuth, checkoutController.loadRazorpayPayment);
router.post('/verify-payment', userAuth, checkoutController.verifyRazorpayPayment);
router.post('/payment-failed', userAuth, checkoutController.paymentFailed);
router.post('/retry-payment/:orderId', userAuth, checkoutController.loadRazorpayPayment);

module.exports = router;
