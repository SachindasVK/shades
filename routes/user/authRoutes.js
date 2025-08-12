const express = require('express');
const userController = require('../../controller/user/userController');
const passport = require('passport');
const router = express.Router();

//sign up
router.get('/signup', userController.loadSignup);
router.post('/signup', userController.signup);

//otp veryfication
router.post('/resend-otp', userController.resendOtp);
router.post('/verify-otp', userController.verifyOtp);

//Login
router.get('/login', userController.loadLogin);
router.post('/login', userController.login);
//logout
router.get('/logout', userController.logout);

//google login
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
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
router.get('/', userController.loadHomepage);
router.get('/shop', userController.loadShoppingPage);
router.get('/product/details/:id', userController.productDetails);

router.get('/page-404', userController.pageNotFound);

module.exports = router;
