const express = require('express')
const walletController = require('../../controller/user/walletController')
const {userAuth} = require('../../middlewares/auth')
const router = express.Router()

//wallet management
router.get('/wallet', userAuth, walletController.getWallet)
router.post('/wallet/create-order', userAuth, walletController.createWalletRazorpayOrder);
router.post('/wallet/verify-payment', userAuth, walletController.verifyWalletPayment);

// referrals management
router.get('/referrals', userAuth, walletController.getReferrals)

module.exports = router