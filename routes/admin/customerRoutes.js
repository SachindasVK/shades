const express = require('express')
const customerController = require('../../controller/admin/customerController')
const { adminAuth } = require('../../middlewares/auth');
const router = express.Router()

// Customer management
router.get('/customers', adminAuth, customerController.customerInfo);
router.get('/customers/view/:id', adminAuth, customerController.viewCustomer);
router.patch('/customers/:id/block', adminAuth, customerController.blockUser);
router.patch('/customers/:id/unblock',adminAuth, customerController.unblockUser);

module.exports = router