const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const Product = require('../../models/productSchema')
const Wallet = require('../../models/walletSchema')
const Coupon = require('../../models/couponSchema')
const logger = require('../../helpers/logger')

const viewAllOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const sort = req.query.sort || 'date-desc';
    const status = req.query.status || 'all';

    let query = {};
    if (search) {
      query.$or = [
        { orderId: { $regex: search, $options: 'i' } },
        { 'userId.name': { $regex: search, $options: 'i' } },
        { 'userId.email': { $regex: search, $options: 'i' } },
      ];
    }
    if (status !== 'all') {
      query.status = status.toLowerCase();
    }

    let sortOption = {};
    if (sort === 'date-desc') sortOption.createdAt = -1;
    else if (sort === 'date-asc') sortOption.createdAt = 1;
    else if (sort === 'total-desc') sortOption.finalAmount = -1;
    else if (sort === 'total-asc') sortOption.finalAmount = 1;

    const orders = await Order.find(query)
      .populate('userId', 'name email')
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .lean();

    const totalOrders = await Order.countDocuments(query);
    res.render('ordermanagement', {
      pageTitle: 'Orders Management',
      orders,
      totalOrders,
      currentPage: page,
      limit,
      totalPages: Math.ceil(totalOrders / limit),
      search,
      sort,
      status,
    });
  } catch (error) {
    logger.error('Error fetching orders:', error);
    res.status(500).render('error', {
      message: 'Failed to load order management page',
    });
  }
};

const updateOrderStatus = async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  try {
    const validStatuses = [
      'pending',
      'confirmed',
      'shipped',
      'delivered',
      'cancelled',
      'return_requested',
      'returned',
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value',
      });
    }

    const order = await Order.findOne({ orderId }).populate('userId');
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    const previousStatus = order.status;

    order.status = status;
    order.updatedOn = Date.now();

    if (status === 'cancelled') {
      order.cancelledAt = Date.now();

      // Restore product quantities if cancelled
      for (const item of order.orderedItems) {
        const product = await Product.findById(item.product);
        if (product) {
          if (product.status) {
            product.status = product.status.toLowerCase();
          }
          product.quantity += item.quantity;
          await product.save();
        }
      }

      // Process refund if payment was made online or via wallet
      const payment = ['online', 'wallet']
      if (payment.includes(order.paymentMethod)) {
        await processRefund(order.userId._id, order.finalAmount, orderId, 'Order cancellation');
      }

    } else if (status === 'delivered') {
      order.deliveredOn = Date.now();

    } else if (status === 'return_requested') {
      order.requestStatus = 'pending';

    } else if (status === 'returned') {
      // Restore product quantities
      for (const item of order.orderedItems) {
        const product = await Product.findById(item.product);
        if (product) {
          product.quantity += item.quantity;
          await product.save();
        }
      }

      // Process refund for returned items
      await processRefund(order.userId._id, order.finalAmount, orderId, 'Order return');
      order.requestStatus = 'approved';
    }

    await order.save();

    return res.status(200).json({
      success: true,
      message: `Order status updated from ${previousStatus} to ${status} successfully`,
      order: {
        orderId: order.orderId,
        status: order.status,
        updatedOn: order.updatedOn
      }
    });

  } catch (error) {
    logger.error('Error updating order status:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating status',
    });
  }
};

// process refunds
async function processRefund(userId, amount, orderId, reason) {
  try {
    let wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      wallet = new Wallet({
        userId,
        balance: 0,
        refundAmount: 0,
        totalDebited: 0,
        transactions: []
      });
    }

    // Add refund to wallet
    wallet.balance += amount;
    wallet.refundAmount += amount;

    // Add transaction record
    wallet.transactions.push({
      amount,
      transactionType: 'credit',
      transactionPurpose: 'refund',
      description: `${reason} - Order #${orderId}`,
      createdAt: new Date()
    });

    await wallet.save();


    await User.findByIdAndUpdate(userId, {
      $inc: { wallet: amount }
    });

    logger.info(`Refunded ₹${amount} to user ${userId} for order ${orderId}`);

  } catch (error) {
    logger.error('Error processing refund:', error);
    throw error;
  }
}


const getOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params

    logger.info(`Requested Order ID: ${orderId}`);

    const order = await Order.findOne({ orderId })
      .populate('userId', 'name email')
      .populate('orderedItems.product', 'productName');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.render('orderDetails', {
      pageTitle: 'Order Details',
      order
    })
  } catch (error) {
    logger.error('Error fetching order details:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

const acceptReturnRequest = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Check if the order status allows return acceptance
    if (order.status !== 'return_requested') {
      return res.status(400).json({
        success: false,
        message: 'Return request is not pending'
      });
    }

    order.status = 'returned';
    order.requestStatus = 'approved';
    order.updatedOn = new Date();

    // Update all order items to returned status
    order.orderedItems.forEach(item => {
      if (item.status === 'return_requested') {
        item.status = 'returned';
        item.updatedOn = new Date();
        item.requestStatus = 'approved'
      }
      if (order.status === 'returned') {
        item.status = 'returned';
        item.updatedOn = new Date();
        item.requestStatus = 'approved'
      }
    });

    await order.save();
    if (order.status === 'returned') {
      // Restore product quantities
      for (const item of order.orderedItems) {
        const product = await Product.findById(item.product);
        if (product) {
          product.quantity += item.quantity;
          await product.save();
        }
      }

      // refund for returned items
      await processRefund(order.userId._id, order.finalAmount, orderId, 'Order return');
      order.requestStatus = 'approved';
    }

    await order.save();

    return res.status(200).json({
      success: true,
      message: 'Return request accepted successfully',
      order: order
    });

  } catch (error) {
    console.error('Error accepting return request:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error occurred while processing return request'
    });
  }
};



const acceptReturnItemRequest = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const item = order.orderedItems.find(item => item._id.toString() === itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found in order' });
    }

    if (item.status === 'returned') {
      return res.status(400).json({ success: false, message: 'Item already returned' });
    }

    if (item.status !== 'return_requested') {
      return res.status(400).json({ success: false, message: 'Item return request is not pending' });
    }

    // Update item return status
    item.status = 'returned';
    item.requestStatus = 'approved';
    item.returnProcessedAt = new Date();
    item.refundedAt = new Date();


    if (req.body.cancelReason) {
      item.cancelReason = req.body.cancelReason;
    }

    // ecalculate Order Status
    const allItemsReturned = order.orderedItems.every(i => i.status === 'returned');
    if (allItemsReturned) {
      order.status = 'returned';
    }

    // Product inventory adjustment
    await Product.findByIdAndUpdate(item.product, {
      $inc: {
        quantity: item.quantity,
        salesCount: -item.quantity
      }
    });

    // total amount 
    const activeItems = order.orderedItems.filter(i => i.status !== 'cancelled');
    const activeTotal = activeItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
    order.finalAmount = activeTotal + order.deliveryCharge + order.gstAmount - (order.discount || 0) - (order.couponDiscount || 0);

    // Refund 
    if (['wallet', 'online'].includes(order.paymentMethod)) {
      const refundAmountRaw = item.price * item.quantity;
      const totalBeforeCancellation = order.orderedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
      const coupon = order.couponCode ? await Coupon.findOne({ name: order.couponCode, isDeleted: false }) : null;
      let refundAmount = refundAmountRaw;

      // Share of base discount
      if (order.discount && totalBeforeCancellation > 0) {
        refundAmount -= Math.round((refundAmountRaw / totalBeforeCancellation) * order.discount);
      }

      // Coupon discount share
      if (coupon && totalBeforeCancellation >= coupon.minimumPrice) {
        const totalCouponDiscount = Math.min((totalBeforeCancellation * coupon.discountPercentage) / 100, coupon.maxDiscount);
        refundAmount -= Math.floor((refundAmountRaw / totalBeforeCancellation) * totalCouponDiscount);
      }

      // Wallet credit
      let wallet = await Wallet.findOne({ userId: order.userId });
      if (!wallet) {
        wallet = new Wallet({
          userId: order.userId,
          balance: 0,
          refundAmount: 0,
          totalDebited: 0,
          transactions: []
        });
      }

      wallet.balance += refundAmount;
      wallet.refundAmount += refundAmount;
      wallet.transactions.push({
        amount: refundAmount,
        transactionType: 'credit',
        transactionPurpose: 'refund',
        description: `Refund for returned item in order ${order.orderId}`
      });
      await wallet.save();

      order.refundStatus = 'refunded';
      order.refundAmount = refundAmount;
      order.paymentStatus = 'Refunded';
    }

    order.updatedOn = new Date();
    order.markModified('orderedItems');
    await order.save();

    return res.status(200).json({
      success: true,
      message: 'Item return request accepted successfully',
      item
    });

  } catch (error) {
    logger.error('Accept item return error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};


const rejectItemReturnRequest = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim() === '') {
      return res.status(400).json({ success: false, message: 'Rejection reason is required' });
    }

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Find the specific item in the order
    const item = order.orderedItems.find(item => item._id.toString() === itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found in order' });
    }

    if (item.status !== 'return_requested') {
      return res.status(400).json({ success: false, message: 'Item return request is not pending' });
    }

    // Update the specific item status  
    item.status = 'return_rejected';
    item.requestStatus = 'rejected';
    item.rejectionReason = reason;
    item.returnProcessedAt = new Date();

    // Check if order status needs to be updated
    const hasAnyPendingReturns = order.orderedItems.some(orderItem =>
      orderItem.status === 'return_requested'
    );

    // If no more pending returns and order was in return_requested state
    if (!hasAnyPendingReturns && order.status === 'return_requested') {

      const allItemsDelivered = order.orderedItems.every(orderItem =>
        orderItem.status === 'return_rejected'
      );

      if (allItemsDelivered) {
        order.status = 'return_rejected';
      }
    }

    order.updatedOn = new Date();
    await order.save();

    return res.status(200).json({
      success: true,
      message: 'Item return request rejected successfully',
      item: item
    });

  } catch (error) {
    logger.error('Reject item return error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};


const rejectOrderReturn = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim() === '') {
      return res.status(400).json({ success: false, message: 'Rejection reason is required' });
    }

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Ensure the order is in a return-requested state
    if (order.status !== 'return_requested') {
      return res.status(400).json({ success: false, message: 'Order is not in return requested state' });
    }


    for (const item of order.orderedItems) {
      item.status = 'return_rejected';
      item.requestStatus = 'rejected';
      item.rejectionReason = reason;
      item.returnProcessedAt = new Date();
      item.updatedOn = new Date()
    }


    order.status = 'return_rejected';
    order.requestStatus = 'rejected'
    order.rejectionReason = reason;
    order.updatedOn = new Date();

    await order.save();

    return res.status(200).json({
      success: true,
      message: 'Order return request rejected successfully',
      order: order
    });

  } catch (error) {
    logger.error('Reject order return error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};


module.exports = {
  viewAllOrders,
  updateOrderStatus,
  getOrderDetails,
  acceptReturnRequest,
  acceptReturnItemRequest,
  rejectItemReturnRequest,
  rejectOrderReturn
};
