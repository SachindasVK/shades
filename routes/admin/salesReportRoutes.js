const express = require('express');
const salesReportController = require('../../controller/admin/salesReportController');
const { adminAuth } = require('../../middlewares/auth');
const router = express.Router();
//Sales Report
router.get('/sales-report', adminAuth, salesReportController.getSalesReport);
router.get('/sales-report/download', adminAuth, salesReportController.downloadSalesReport);

module.exports = router;
