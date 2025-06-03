const express = require('express')
const router = express.Router()
const userController = require('../controller/user/userController')
const profileController = require('../controller/user/profileController')
const productController = require('../controller/user/productController')
const passport = require('passport')
const {userAuth} = require('../middlewares/auth')
const {userUpload} = require('../helpers/multer')

router.get('/pageNotFound',userController.pageNotFound)

//sign up management
router.get('/signup',userController.loadSignup)
router.post('/signup',userController.signup)
router.post('/verify-otp',userController.verifyOtp)
router.post('/resend-otp',userController.resendOtp)
//Login management
router.get('/login',userController.loadLogin)
router.post('/login',userController.login)
router.get('/logout',userController.logout)
//google
router.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}))
router.get('/auth/google/callback', (req, res, next) => {
  passport.authenticate('google', async (err, user, info) => {
    if (err || !user) {
      console.error('Google Auth error:', err || 'No user');
      req.session.errorMessage = 'Google login failed. Try again.';
      return res.redirect('/signup');
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


//user Autherised
router.get('/',userController.loadHomepage)
router.get('/shop',userController.loadShoppingPage)
router.get('/about',userController.loadAbout)
//profile management
router.get('/forgot-password',profileController.getForgotPassPage)
router.post('/forgot-email-valid',profileController.forgotEmailValid)
router.post('/verify-forgotpassword-otp',profileController.verifyForgotPassOtp)
router.post('/resend-otp',profileController.resendOtp)
router.get('/reset-password',profileController.getResetPassPage)
router.post('/reset-password',profileController.postNewPassword)
router.get('/profile', userAuth, profileController.userProfile);
// Add this route for image upload
router.post('/profile/upload', userAuth, userUpload.single('image'), profileController.uploadProfileImage);
router.post('/edit-profile/:id', userAuth, userUpload.single('image'), profileController.editUserProfile);
router.delete('/remove-profile/:id',userAuth,profileController.removeProfile)
router.get('/changepassword',userAuth,profileController.getchangePassword)
router.post('/changepassword',userAuth,profileController.changePassword)
router.get('/address',userAuth,profileController.getAddress)
router.post('/address/add',userAuth,profileController.addAddress)
router.put('/address/update/:id',userAuth,profileController.updateAddress)
router.delete('/address/delete/:id',userAuth,profileController.deleteAddress)
//product management
router.get('/productDetails',productController.productDetails)
module.exports = router