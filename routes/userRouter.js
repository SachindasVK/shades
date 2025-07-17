const express = require('express')
const router = express.Router()
const userController = require('../controller/user/userController')
const profileController = require('../controller/user/profileController')
const productController = require('../controller/user/productController')
const wishlistController = require('../controller/user/wishlistController')
const orderController = require('../controller/user/orderController')
const cartController = require('../controller/user/cartController')
const checkoutController = require('../controller/user/checkoutController')
const walletController = require('../controller/user/walletController')
const addressController = require('../controller/user/addressController')
const passport = require('passport')
const { userAuth } = require('../middlewares/auth')
const { validateCartStock } = require('../middlewares/auth')
const { userUpload } = require('../helpers/multer')





router.get('/pageNotFound', userController.pageNotFound)

//sign up management
router.get('/signup', userController.loadSignup)
router.post('/signup', userController.signup)
router.post('/verify-otp', userController.verifyOtp)
router.post('/resend-otp', userController.resendOtp)

//Login management
router.get('/login', userController.loadLogin)
router.post('/login', userController.login)
router.get('/logout', userController.logout)

//google auth
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }))
router.get('/auth/google/callback', (req, res, next) => {
  passport.authenticate('google', async (err, user, info) => {
    if (err || !user) {
      console.error('Google Auth error:', err || 'No user');
      req.session.errorMessage = 'Google login failed. Try again.';
      return res.redirect('/login');
    }

    if (user.isBlocked) {
      console.log('Google login blocked for:', user.email);
      req.session.errorMessage = 'User blocked by admin!';
      return res.redirect('/login');
    }

    req.logIn(user, (err) => {
      if (err) {
        console.error('Login error after Google auth:', err);
        req.session.errorMessage = 'Login failed. Try again.';
        return res.redirect('/signup');
      }

      req.session.user = user._id;
      console.log('Google login success:', user.email);
      return res.redirect('/shop');
    });
  })(req, res, next);
});


//user pages
router.get('/', userController.loadHomepage)
router.get('/shop', userController.loadShoppingPage)
router.get('/productDetails', productController.productDetails)

//profile management
router.get('/forgot-password', profileController.getForgotPassPage)
router.post('/forgot-email-valid', profileController.forgotEmailValid)
router.post('/verify-forgotpassword-otp', profileController.verifyForgotPassOtp)
router.post('/resend-otp', profileController.resendOtp)
router.get('/reset-password', profileController.getResetPassPage)
router.post('/reset-password', profileController.postNewPassword)
router.get('/profile', userAuth, profileController.userProfile)
router.post('/profile/upload', userAuth, userUpload.single('image'), profileController.uploadProfileImage);
router.post('/edit-profile/:id', userAuth, userUpload.single('image'), profileController.editUserProfile);
router.delete('/remove-profile/:id', userAuth, profileController.removeProfile)
router.get('/changepassword', userAuth, profileController.getchangePassword)
router.post('/changepassword', userAuth, profileController.changePassword)

//order management
router.get('/orders', userAuth, orderController.getOrders)
router.post('/orders/filter', userAuth, orderController.filterOrders);
router.get('/order/details/:id', userAuth, orderController.getOrderDetails)
router.get('/order/invoice/:id', userAuth, orderController.downloadInvoice)
router.put('/order/cancel/:orderId', userAuth, orderController.cancelOrder)
router.put('/order/cancel-item/:itemId',userAuth, orderController.cancelSingleItem)
router.post('/order/:orderId/return', userAuth, orderController.requestReturn)

//wallet management
router.get('/wallet', userAuth, walletController.getWallet)
router.post('/wallet/create-order', userAuth, walletController.createWalletRazorpayOrder);
router.post('/wallet/verify-payment', userAuth, walletController.verifyWalletPayment);

// referrals management
router.get('/referrals', userAuth, walletController.getReferrals)
//wishlist management
router.get('/wishlist', userAuth, wishlistController.loadWishlist)
router.post('/addtowishlist', userAuth, wishlistController.addToWishlist)
router.delete('/wishlist/remove/:id', userAuth, wishlistController.removeFromWishlist)
router.post('/wishlist/status', userAuth, wishlistController.getWishlistStatus)

//address management
router.get('/address', userAuth, addressController.getAddress)
router.post('/address/add', userAuth, addressController.addAddress)
router.put('/address/update/:id', userAuth, addressController.updateAddress)
router.delete('/address/delete/:id', userAuth, addressController.deleteAddress)

//Cart management
router.get('/cart', userAuth, cartController.getCart)
router.post('/cart/add', userAuth, cartController.addToCart)
router.post('/cart/remove', userAuth, cartController.removeCart)
router.post('/cart/update-quantity', userAuth, cartController.updateQuantity);
router.post('/cart/status', userAuth, cartController.getCartStatus)

//checkout management
router.get('/select-address', userAuth, checkoutController.getSelectAddress)
router.post('/select-address', userAuth, checkoutController.selectAddress)
router.post('/checkout/proceed-to-shipping', userAuth, checkoutController.loadShipping)
router.get('/shipping', userAuth, checkoutController.getShipping)
router.post('/checkout/proceed-to-payment', userAuth, checkoutController.proceedToPayment)
router.get('/payment', userAuth, checkoutController.loadPayment)
router.post('/place-order', userAuth, checkoutController.placeOrder)
router.get('/order-confirmation/:id', userAuth, checkoutController.confirmOrder)
router.get('/payment/:orderId', userAuth, checkoutController.loadRazorpayPayment);
router.post('/verify-payment', userAuth, checkoutController.verifyRazorpayPayment);
router.post('/payment-failed',userAuth,checkoutController.paymentFailed)
router.post('/retry-payment/:orderId',userAuth,checkoutController.loadRazorpayPayment)
router.get('/create-razorpay-order/:orderId',userAuth,orderController.getRazorpayOrder)

module.exports = router