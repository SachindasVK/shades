const express = require('express')
const orderController = require('../../controller/admin/orderController')
const { adminAuth } = require('../../middlewares/auth');
const router = express.Router()

router.get('/orders',adminAuth,orderController.viewAllOrders)
router.patch('/orders/:orderId/status', adminAuth,orderController.updateOrderStatus);
router.post('/return/accept/:orderId',adminAuth,orderController.acceptReturnRequest);
router.post('/return/accept-item/:orderId/:itemId',adminAuth,orderController.acceptReturnItemRequest)
router.get('/order/:orderId', adminAuth, orderController.getOrderDetails);
router.post('/return/reject-item/:orderId/:itemId',adminAuth, orderController.rejectItemReturnRequest)
router.post('/return/reject/:orderId',adminAuth, orderController.rejectOrderReturn)

module.exports = router