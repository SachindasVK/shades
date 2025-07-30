const express = require('express')
const profileController = require('../../controller/user/profileController')
const {userAuth} = require('../../middlewares/auth')
const { userUpload } = require('../../helpers/multer')
const router = express.Router()

//profile 
router.get('/profile', userAuth, profileController.userProfile)
router.post('/profile/upload', userAuth, userUpload.single('image'), profileController.uploadProfileImage);
router.delete('/remove-profile/:id', userAuth, profileController.removeProfile)
router.post('/edit-profile/:id', userAuth, profileController.editUserProfile);

//change password
router.get('/changepassword', userAuth, profileController.getchangePassword)
router.post('/changepassword', userAuth, profileController.changePassword)

//forgot password
router.get('/forgot-password', profileController.getForgotPassPage)
router.post('/forgot-email-valid', profileController.forgotEmailValid)

//reset password
router.get('/reset-password', profileController.getResetPassPage)
router.post('/reset-password', profileController.postNewPassword)

//otp
router.post('/resend-otp', profileController.resendOtp)
router.post('/verify-forgotpassword-otp', profileController.verifyForgotPassOtp)

module.exports =router