const express = require('express')
const orderController = require('../../controller/user/orderController')
const {userAuth} = require('../../middlewares/auth')
const router = express.Router()

//order management
router.get('/orders', userAuth, orderController.getOrders)
//order details
router.get('/order/details/:id', userAuth, orderController.getOrderDetails)
router.get('/order/invoice/:id', userAuth, orderController.downloadInvoice)
router.put('/order/cancel/:orderId', userAuth, orderController.cancelOrder)
router.put('/order/cancel-item/:itemId',userAuth, orderController.cancelSingleItem)
router.post('/order/:orderId/return', userAuth, orderController.requestReturn)
router.put('/order/return-item/:itemId',userAuth,orderController.returnOrderItem)
router.get('/create-razorpay-order/:orderId', userAuth, orderController.getRazorpayOrder)

module.exports = router