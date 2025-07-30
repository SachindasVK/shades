const express = require('express')
const adminController = require('../../controller/admin/adminController')
const { adminAuth } = require('../../middlewares/auth');
const router = express.Router()

router.get('/dashboard',adminAuth,adminController.loadDashboard);
router.get('/sales-chart',adminAuth,adminController.getSalesChart)
router.get('/top-sales-chart',adminAuth,adminController.getTopSalesData)
// view all recent Activities
router.get('/all-recent-activities',adminAuth,adminController.viewAllRecentActivities)
module.exports = router