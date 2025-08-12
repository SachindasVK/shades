const express = require('express');
const authRoutes = require('./admin/authRoutes');
const brandRoutes = require('./admin/brandRoutes');
const categoryRoutes = require('./admin/categoryRoutes');
const couponRoutes = require('./admin/couponRoutes');
const customerRoutes = require('./admin/customerRoutes');
const dashboardRoutes = require('./admin/dashboardRoutes');
const orderRoutes = require('./admin/orderRoutes');
const productRoutes = require('./admin/productRoutes');
const salesReportRoutes = require('./admin/salesReportRoutes');
const router = express.Router();

router.use('/', authRoutes);
router.use('/', brandRoutes);
router.use('/', categoryRoutes);
router.use('/', couponRoutes);
router.use('/', customerRoutes);
router.use('/', dashboardRoutes);
router.use('/', orderRoutes);
router.use('/', productRoutes);
router.use('/', salesReportRoutes);

module.exports = router;
