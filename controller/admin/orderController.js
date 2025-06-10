const Order = require('../../models/orderSchema'); 
const User = require('../../models/userSchema');
const Product = require('../../models/productSchema')
const Wallet = require('../../models/walletSchema')

const viewAllOrders = async (req, res) => {
  try {
    // Extract query parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const sort = req.query.sort || 'date-desc';
    const status = req.query.status || 'all';

    // Build query
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

    // Build sort object
    let sortOption = {};
    if (sort === 'date-desc') sortOption.createdAt = -1;
    else if (sort === 'date-asc') sortOption.createdAt = 1;
    else if (sort === 'total-desc') sortOption.finalAmount = -1;
    else if (sort === 'total-asc') sortOption.finalAmount = 1;

    // Fetch paginated orders
    const orders = await Order.find(query)
      .populate('userId', 'name email')
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total number of orders for pagination
    const totalOrders = await Order.countDocuments(query);

    // Render the EJS template with paginated data
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
    console.error('Error fetching orders:', error);
    res.status(500).render('error', {
      message: 'Failed to load order management page',
    });
  }
};

const updateOrderStatus = async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  try {
    // Validate status
    const validStatuses = [
      'pending',
      'confirmed',
      'shipped',
      'delivered',
      'cancelled',
      'return_requested',
      'returning',
      'returned',
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value',
      });
    }

    // Find and update the order
    const order = await Order.findOne({ orderId }).populate('userId');
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    const previousStatus = order.status;

    // Update the status and relevant fields
    order.status = status;
    order.updatedOn = Date.now();

    // Handle specific status updates
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
      if (order.paymentMethod === 'online' || order.paymentMethod === 'wallet') {
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
    console.error('Error updating order status:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating status',
    });
  }
};

// Helper function to process refunds
async function processRefund(userId, amount, orderId, reason) {
  try {
    let wallet = await Wallet.findOne({ userId });
    
    if (!wallet) {
      // Create new wallet if doesn't exist
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

    // Also update user's wallet field (if you're using it)
    await User.findByIdAndUpdate(userId, {
      $inc: { wallet: amount }
    });

    console.log(`Refunded ₹${amount} to user ${userId} for order ${orderId}`);
    
  } catch (error) {
    console.error('Error processing refund:', error);
    throw error;
  }
}


const verifyReturn = async (req, res) => {
  const { orderId } = req.params;

  try {
    const order = await Order.findOne({ orderId }).populate('userId');
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (order.status !== 'return_requested') {
      return res.status(400).json({
        success: false,
        message: 'Order is not in return requested status'
      });
    }

    // Update order status to returned
    order.status = 'returned';
    order.requestStatus = 'approved';
    order.updatedOn = Date.now();

    // Restore product quantities
    for (const item of order.orderedItems) {
      const product = await Product.findById(item.product);
      if (product) {
        product.quantity += item.quantity;
        await product.save();
      }
    }

    // Process refund
    await processRefund(order.userId._id, order.finalAmount, orderId, 'Return verified');

    await order.save();

    return res.status(200).json({
      success: true,
      message: 'Return verified and refund processed successfully',
      order: {
        orderId: order.orderId,
        status: order.status,
        refundAmount: order.finalAmount
      }
    });

  } catch (error) {
    console.error('Error verifying return:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while verifying return'
    });
  }
};


const getOrderDetails = async(req,res)=>{
  try {
    const {orderId} = req.params

    console.log('Requested Order ID:', orderId);

       const order = await Order.findOne({ orderId })
            .populate('userId', 'name email')  // populate name and email only
            .populate('orderedItems.product', 'productName'); // productName only

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        res.json({ success: true, order });
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).json({ success: false, message: 'Server error' });
  }
}
module.exports = {
  viewAllOrders,
   updateOrderStatus,
  verifyReturn,
  getOrderDetails
};
