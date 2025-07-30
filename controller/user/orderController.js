const User = require('../../models/userSchema')
const Order = require('../../models/orderSchema')
const Product = require('../../models/productSchema')
const PDFDocument = require('pdfkit');
const Wallet = require('../../models/walletSchema')
const razorpay = require('../../config/razorpay')
const Coupon = require('../../models/couponSchema')

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

        // Company Details
        doc.fontSize(14).font('Helvetica-Bold').text('SHADES', { align: 'left' });
        doc.fontSize(10).font('Helvetica')
            .text('123 Business Avenue, Commerce City, IN 12345')
            .text('Email: contact@shades.com')
            .text('Phone: +91 123-456-7890')
            .moveDown(2);

        // Title
        doc.fontSize(20).font('Helvetica-Bold').text('INVOICE', { align: 'center' }).moveDown(1.5);

        // Order Info
        doc.fontSize(12).font('Helvetica')
            .text(`Order ID: ${order.orderId}`)
            .text(`Date: ${new Date(order.createdOn).toLocaleDateString('en-GB')}`)
            .moveDown();

        // Customer Info
        doc.font('Helvetica-Bold').text('Bill To:').font('Helvetica');
        doc.text(`Name: ${order.userId.name}`);
        doc.text(`Email: ${order.userId.email}`);
        if (order.address) {
            doc.text(`Address: House/Flat ${order.address.flat}, ${order.address.area}, ${order.address.city}`);
            doc.text(`Phone: ${order.address.phone}`);
        }
        doc.moveDown(1);

        // Items Section Heading
        doc.font('Helvetica-Bold').fontSize(12).text('Items:', { underline: true });
        doc.moveDown(0.5);

        // Column Headers 
        const headerY = doc.y;
        doc.font('Helvetica-Bold').fontSize(10);
        doc.text('Product Name', 50, headerY, { width: 180 });
        doc.text('Qty', 250, headerY, { width: 50, align: 'center' });
        doc.text('Price', 320, headerY, { width: 80, align: 'right' });
        doc.text('Total', 420, headerY, { width: 80, align: 'right' });

        // Draw line under headers
        doc.y = headerY + 15;
        doc.lineWidth(0.5).moveTo(50, doc.y).lineTo(500, doc.y).stroke();
        doc.moveDown(0.3);

        // Table Rows 
        order.orderedItems.forEach((item) => {
            if (item.status !== 'cancelled') {
                const total = item.price * item.quantity;
                const rowY = doc.y;

                doc.font('Helvetica').fontSize(10);

                // Product name with proper wrapping
                const productName = item.productName || item.product?.name || 'Unnamed Product';
                doc.text(productName, 50, rowY, { width: 180 });

                // Quantity
                doc.text(item.quantity.toString(), 250, rowY, { width: 50, align: 'center' });

                // Price
                doc.text(`₹${item.price.toFixed(2)}`, 320, rowY, { width: 80, align: 'right' });

                // Total
                doc.text(`₹${total.toFixed(2)}`, 420, rowY, { width: 80, align: 'right' });

                doc.moveDown(0.5);
            }
        });

        // Draw line after items
        doc.lineWidth(0.5).moveTo(50, doc.y).lineTo(500, doc.y).stroke();
        doc.moveDown();

        // Summary Section 
        const activeItems = order.orderedItems.filter(i => i.status !== 'cancelled');
        const subtotal = activeItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

        doc.font('Helvetica').fontSize(12);

        // Right-align summary items
        const summaryX = 350;
        const summaryWidth = 150;

        doc.text(`Subtotal: ₹${subtotal.toFixed(2)}`, summaryX, doc.y, { width: summaryWidth, align: 'right' });

        if (order.discount > 0) {
            doc.text(`Discount: -₹${order.discount.toFixed(2)}`, summaryX, doc.y, { width: summaryWidth, align: 'right' });
        }

        if (order.couponDiscount > 0) {
            doc.text(`Coupon Discount: -₹${order.couponDiscount.toFixed(2)}`, summaryX, doc.y, { width: summaryWidth, align: 'right' });
        }

        doc.text(`Delivery Charge: ₹${(order.deliveryCharge || 0).toFixed(2)}`, summaryX, doc.y, { width: summaryWidth, align: 'right' });
        doc.text(`GST: ₹${(order.gstAmount || 0).toFixed(2)}`, summaryX, doc.y, { width: summaryWidth, align: 'right' });

        doc.font('Helvetica-Bold').text(`Total: ₹${order.finalAmount.toFixed(2)}`, summaryX, doc.y, { width: summaryWidth, align: 'right' });
        doc.moveDown(1);

        // Payment Info
        doc.font('Helvetica')
            .text(`Payment Method: ${order.paymentMethod?.toUpperCase()}`)
            .text(`Payment Status: ${order.paymentStatus || 'Pending'}`);

        doc.moveDown(2);
        doc.font('Helvetica-Oblique').text('Thank you for your purchase!', { align: 'center' });

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

       
        if (!cancelReason || cancelReason.trim() === '') {
            return res.status(400).json({ success: false, message: 'Cancel reason is required' });
        }

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
        order.refundedAt = new Date();

        // Restore product stock for cancelled items
        for (const item of order.orderedItems) {
            if (item.product) {
                await Product.findByIdAndUpdate(
                    item.product._id,
                    {
                        $inc: {
                            quantity: item.quantity,
                            salesCount: -item.quantity
                        }
                    }
                );
            }
        }

        await order.save();
        const paymentMethods = ['wallet', 'online']
        if (paymentMethods.includes(order.paymentMethod)) {
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
            order.paymentStatus = 'Refunded';
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



const cancelSingleItem = async (req, res) => {
    try {
        const userId = req.session.user;
        const { itemId } = req.params;
        const { cancelReason } = req.body;

        if (!userId) {
            return res.status(400).json({ success: false, message: 'item id missing' })
        }

        const order = await Order.findOne({ userId, 'orderedItems._id': itemId })
        if (!order) {
            return res.status(404).json({ success: false, message: 'order or item not found' })
        }

        const item = order.orderedItems.id(itemId)
        if (!item || item.status === 'cancelled') {
            return res.status(400).json({ success: false, message: 'item already cancelled or not found' })
        }


        // Update the item status
        item.status = 'cancelled';
        item.cancelReason = cancelReason;
        item.cancelledAt = new Date();
        item.refundedAt = new Date();

        const allItemsCancelled = order.orderedItems.every(i => i.status === 'cancelled');
        if (allItemsCancelled) {
            order.status = 'cancelled';
        }
        await Product.findByIdAndUpdate(
            item.product,
            {
                $inc: {
                    quantity: item.quantity,
                    salesCount: -item.quantity
                }
            }
        );


        // recalculate finalAmount, coupon logic etc if needed
        const activeItems = order.orderedItems.filter(item => item.status !== 'cancelled');
        const activeTotal = activeItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

        order.finalAmount = activeTotal + order.deliveryCharge + order.gstAmount - (order.discount || 0) - (order.couponDiscount || 0);

        await order.save();
        if (order.paymentMethod === 'wallet' || order.paymentMethod === 'online') {
            const refundAmountRaw = item.price * item.quantity;

            // Total price of all items before cancellation
            const totalBeforeCancellation = order.orderedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

            // Get coupon details 
            const coupon = order.couponCode
                ? await Coupon.findOne({ name: order.couponCode, isDeleted: false })
                : null;

            let refundAmount = refundAmountRaw;

            // base discount
            if (order.discount && totalBeforeCancellation > 0) {
                const discountShare = (refundAmount / totalBeforeCancellation) * order.discount;
                refundAmount = refundAmount - discountShare;
                refundAmount = Math.round(refundAmount);
            }


            if (coupon && totalBeforeCancellation >= coupon.minimumPrice) {
                // Calculate actual discount used
                const totalCouponDiscount = Math.min(
                    (totalBeforeCancellation * coupon.discountPercentage) / 100,
                    coupon.maxDiscount
                );

                // Calculate this item's share of discount
                const itemDiscountShare = (refundAmountRaw / totalBeforeCancellation) * totalCouponDiscount;

                // Reduce refund by item's share
                refundAmount = refundAmountRaw - itemDiscountShare;
                refundAmount = Math.floor(refundAmount);

                if (order.discount && totalBeforeCancellation > 0) {
                    const discountShare = (refundAmount / totalBeforeCancellation) * order.discount;
                    refundAmount = refundAmount - discountShare;
                    refundAmount = Math.floor(refundAmount);
                }
            }

            // Refund to wallet
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
                description: `Refund for cancelled item from order ${order.orderId}`
            });

            await wallet.save();

            order.refundStatus = 'refunded';
            order.refundAmount = refundAmount;
            order.paymentStatus = 'Refunded';
        }
        res.status(200).json({ success: true, message: "Item cancelled successfully" });
    } catch (error) {
        console.error("Cancel item error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
}



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


        if (order.status === 'return_requested') {
            return res.status(400).json({ success: false, message: 'Return already requested' });
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


const getRazorpayOrder = async (req, res) => {
    try {
        const orderDb = await Order.findById(req.params.orderId)
        if (!orderDb) return res.json({ success: false })

        const newOrder = await razorpay.orders.create({
            amount: orderDb.finalAmount * 100,
            currency: "INR",
            receipt: `retry_${orderDb._id}`
        });
        res.json({
            success: true,
            razorpayKey: process.env.RAZORPAY_KEY_ID,
            orderId: newOrder.id,
            amount: newOrder.amount,
        });
    } catch (error) {
        console.error(error);
        res.json({ success: false });
    }
}


const returnOrderItem = async (req, res) => {
    try {
        const userId = req.session.user;
        const { itemId } = req.params;
        const { returnItemReason } = req.body;

        if (!itemId) {
            return res.status(400).json({ success: false, message: 'Item ID missing' });
        }

        const order = await Order.findOne({ userId, 'orderedItems._id': itemId });

        if (!order) {
            return res.status(404).json({ success: false, message: 'Ordered item not found' });
        }

        const item = order.orderedItems.id(itemId);

        if (!item || item.status === 'returned') {
            return res.status(400).json({ success: false, message: 'Item already return requested or invalid' });
        }

        if (order.status !== 'delivered') {
            return res.status(400).json({ success: false, message: 'Only delivered items can be returned' });
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

        // Update subdocument
        item.status = 'return_requested';
        item.returnReason = returnItemReason;
        item.requestStatus = 'pending';

        const allItemsReturned = order.orderedItems.every(i => i.status === 'return_requested');
        if (allItemsReturned) {
            order.status = 'return_requested';
        }
        // Save parent document
        await order.save();

        return res.json({
            success: true,
            message: 'Return request submitted successfully'
        });
    } catch (error) {
        console.error('Return item error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error });
    }
};

module.exports = {
    getOrders,
    getOrderDetails,
    downloadInvoice,
    cancelOrder,
    filterOrders,
    requestReturn,
    getRazorpayOrder,
    cancelSingleItem,
    returnOrderItem
}