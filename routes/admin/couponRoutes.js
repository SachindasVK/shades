const express = require('express')
const couponController = require('../../controller/admin/couponController')
const { adminAuth } = require('../../middlewares/auth');
const router = express.Router()
//coupen management
router.get('/coupons',adminAuth,couponController.getCoupon)
router.post('/coupons',adminAuth,couponController.createCoupon)
router.put('/coupons/:id', adminAuth, couponController.updateCoupon)
router.patch('/coupons/:id/status', adminAuth, couponController.toggleCouponStatus)
router.delete('/coupons/:id', adminAuth, couponController.deleteCoupon)
router.get('/coupons/:id', adminAuth, couponController.getCouponById)
module.exports = router