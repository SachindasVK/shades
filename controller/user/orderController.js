const User = require('../../models/userSchema')
const Order = require('../../models/orderSchema')
const Product = require('../../models/productSchema')
const PDFDocument = require('pdfkit');
const Wallet = require('../../models/walletSchema')

const getOrders = async (req, res) => {
    try {
        const userId = req.session.user;

        if (!userId) {
            return res.redirect('/login');
        }

        const userData = await User.findById(userId);
        if (!userData) {
            return res.redirect('/pageNotFound');
        }

        const { status, timeFilter, page = 1, limit = 5 } = req.query;

        let query = { userId };

        // status filter
        if (status && status !== 'All') {
            // Handle different status formats "Return_Requested" vs "Return Requested
            const statusValue = status.replace(/[_\s]/g, ' ').trim();
            query.status = new RegExp(`^${statusValue}$`, 'i')
        }

        if (timeFilter && timeFilter !== 'All') {
            const currentDate = new Date();
            let cutoffDate = new Date();

            switch (timeFilter) {
                case 'Last30Days':
                    cutoffDate.setDate(currentDate.getDate() - 30);
                    break;
                case 'Last3Months':
                    cutoffDate.setMonth(currentDate.getMonth() - 3);
                    break;
                case 'Last6Months':
                    cutoffDate.setMonth(currentDate.getMonth() - 6);
                    break;
                default:
                    cutoffDate = null;
            }

            if (cutoffDate) {
                query.createdOn = { $gte: cutoffDate };
            }
        }
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        const totalOrders = await Order.countDocuments(query);
        const totalPages = Math.ceil(totalOrders / limitNum);

        // Fetch filtered and paginated orders
        const orders = await Order.find(query)
            .populate('orderedItems.product')
            .sort({ createdOn: -1 })
            .skip(skip)
            .limit(limitNum);

        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.json({
                success: true,
                orders,
                pagination: {
                    currentPage: pageNum,
                    totalPages,
                    totalOrders,
                    hasNext: pageNum < totalPages,
                    hasPrev: pageNum > 1
                }
            });
        }
        res.render('order', {
            orders,
            username: userData.name,
            pagination: {
                currentPage: pageNum,
                totalPages,
                totalOrders,
                hasNext: pageNum < totalPages,
                hasPrev: pageNum > 1
            },
            filters: {
                status: status || 'All',
                timeFilter: timeFilter || 'All'
            }
        });

    } catch (error) {
        console.error('Get Orders Error:', error);

        // AJAX errors
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(500).json({
                success: false,
                message: 'Error fetching orders'
            });
        }

        res.redirect('/pageNotFound');
    }
};
const filterOrders = async (req, res) => {
    try {
        const userId = req.session.user;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const { status, timeFilter, page = 1, limit = 5 } = req.body;

        let query = { userId };
        if (status && status !== 'All') {
            const statusValue = status.replace(/[_\s]/g, ' ').trim();
            query.status = new RegExp(`^${statusValue}$`, 'i');
        }

        if (timeFilter && timeFilter !== 'All') {
            const currentDate = new Date();
            let cutoffDate = new Date();

            switch (timeFilter) {
                case 'Last30Days':
                    cutoffDate.setDate(currentDate.getDate() - 30);
                    break;
                case 'Last3Months':
                    cutoffDate.setMonth(currentDate.getMonth() - 3);
                    break;
                case 'Last6Months':
                    cutoffDate.setMonth(currentDate.getMonth() - 6);
                    break;
            }

            if (cutoffDate) {
                query.createdOn = { $gte: cutoffDate };
            }
        }

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        const totalOrders = await Order.countDocuments(query);
        const orders = await Order.find(query)
            .populate('orderedItems.product')
            .sort({ createdOn: -1 })
            .skip(skip)
            .limit(limitNum);

        res.json({
            success: true,
            orders,
            pagination: {
                currentPage: pageNum,
                totalPages: Math.ceil(totalOrders / limitNum),
                totalOrders,
                hasNext: pageNum < Math.ceil(totalOrders / limitNum),
                hasPrev: pageNum > 1
            }
        });

    } catch (error) {
        console.error('Filter Orders Error:', error);
        res.status(500).json({ success: false, message: 'Error filtering orders' });
    }
};

const getOrderDetails = async (req, res) => {
    try {
        const userId = req.session.user;

        if (!userId) {
            return res.redirect('/login');
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.redirect('/pageNotFound');
        }

        const orderId = req.params.id;

        // Validate ObjectId format
        if (!orderId.match(/^[0-9a-fA-F]{24}$/)) {
            return res.redirect('/orders');
        }

        const order = await Order.findOne({ _id: orderId, userId })
            .populate('orderedItems.product');

        if (!order) {
            return res.redirect('/orders');
        }

        res.render('order-details', {
            order,
            username: user.name
        });

    } catch (error) {
        console.error('Get Order Details Error:', error);
        res.redirect('/pageNotFound');
    }
};

const downloadInvoice = async (req, res) => {
  try {
    const orderId = req.params.id;
    const userId = req.session.user;

    if (!userId) return res.status(401).send("Unauthorized");

    if (!orderId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).send("Invalid order ID");
    }

    const order = await Order.findOne({ _id: orderId, userId })
      .populate('userId')
      .populate('orderedItems.product');

    if (!order) return res.status(404).send("Order not found");

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderId}.pdf`);
    doc.pipe(res);

    // Title
    doc.fontSize(20).text('INVOICE', { align: 'center' }).moveDown();

    // Order Info
    doc.fontSize(12).text(`Order ID: ${order.orderId}`);
    doc.text(`Date: ${new Date(order.createdOn).toLocaleDateString('en-GB')}`).moveDown();

    // Customer Info
    doc.text(`Name: ${order.userId.name}`);
    doc.text(`Email: ${order.userId.email}`);
    if (order.address) {
      doc.text(`Address: ${order.address.flat}, ${order.address.area}, ${order.address.city}`);
      doc.text(`Phone: ${order.address.phone}`);
    }
    doc.moveDown();

    // Items
    doc.text('Items:', { underline: true });
    order.orderedItems.forEach((item) => {
      if (item.status !== 'cancelled') {
        const total = item.price * item.quantity;
        doc.text(`${item.productName} - Qty: ${item.quantity} - ₹${item.price} = ₹${total}`);
      }
    });
    doc.moveDown();

    // Summary
    const activeItems = order.orderedItems.filter(i => i.status !== 'cancelled');
    const subtotal = activeItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
    doc.text(`Subtotal: ₹${subtotal}`);
    if (order.discount > 0) doc.text(`Discount: -₹${order.discount}`);
    doc.text(`Delivery Charge: ₹${order.deliveryCharge || 0}`);
    doc.text(`GST: ₹${order.gstAmount || 0}`);
    doc.text(`Total: ₹${order.finalAmount}`, { bold: true });
    doc.moveDown();

    // Payment
    doc.text(`Payment Method: ${order.paymentMethod}`);
    doc.text(`Payment Status: ${order.paymentStatus || 'Pending'}`);

    doc.moveDown().text('Thank you for your purchase!', { align: 'center' });
    doc.end();

  } catch (err) {
    console.error("Invoice error:", err);
    res.status(500).send("Internal Server Error");
  }
};

const cancelOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { cancelReason } = req.body;
        const userId = req.session.user;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        // Validate inputs
        if (!cancelReason || cancelReason.trim() === '') {
            return res.status(400).json({ success: false, message: 'Cancel reason is required' });
        }

        // Validate ObjectId format
        if (!orderId.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ success: false, message: 'Invalid order ID' });
        }

        const order = await Order.findOne({ _id: orderId, userId }).populate('orderedItems.product');

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // Check if order can be cancelled
        if (['cancelled', 'delivered', 'shipped'].includes(order.status)) {
            return res.status(400).json({
                success: false,
                message: `Cannot cancel order with status: ${order.status}`
            });
        }

        // Update order status
        order.status = 'cancelled';
        order.cancelReason = cancelReason.trim();
        order.cancelledAt = new Date();

        // Cancel all items in the order
        order.orderedItems.forEach(item => {
            if (item.status !== 'cancelled') {
                item.status = 'cancelled';
                item.cancelReason = cancelReason.trim();
                item.cancelledAt = new Date();
            }
        });

        // Restore product stock for cancelled items
        for (const item of order.orderedItems) {
            if (item.product) {
                await Product.findByIdAndUpdate(
                    item.product._id,
                    { $inc: { 
                        quantity: item.quantity,
                        salesCount: -item.quantity  
                    } }
                );
            }
        }

        await order.save();

        if (order.paymentMethod === 'wallet'||order.paymentMethod === 'online') {
            const refundAmount = order.finalAmount || 0;

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

            wallet.balance += refundAmount;
            wallet.refundAmount += refundAmount;

            wallet.transactions.push({
                amount: refundAmount,
                transactionType: 'credit',
                transactionPurpose: 'refund',
                description: `Refund for cancelled order ${order.orderId}`
            });

            await wallet.save();

            order.refundStatus = 'refunded';
            order.refundAmount = refundAmount;
        }

        res.json({
            success: true,
            message: 'Order cancelled successfully. Refund will be processed within 5-7 business days.'
        });

    } catch (error) {
        console.error('Cancel Order Error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while cancelling the order'
        });
    }
};




// Return request handler 
const requestReturn = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { returnReason } = req.body;
        const userId = req.session.user;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const order = await Order.findOne({ _id: orderId, userId });

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.status !== 'delivered') {
            return res.status(400).json({
                success: false,
                message: 'Only delivered orders can be returned'
            });
        }


        const returnWindow = 7 * 24 * 60 * 60 * 1000;
        const deliveryDate = order.deliveredOn || order.createdOn;
        const currentDate = new Date();

        if (currentDate - deliveryDate > returnWindow) {
            return res.status(400).json({
                success: false,
                message: 'Return window has expired'
            });
        }

        order.status = 'return_requested';
        order.returnReason = returnReason;
        order.requestStatus = 'pending';

        await order.save();

        res.json({
            success: true,
            message: 'Return request submitted successfully'
        });

    } catch (error) {
        console.error('Return Request Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

module.exports = {
    getOrders,
    getOrderDetails,
    downloadInvoice,
    cancelOrder,
    filterOrders,
    requestReturn
}