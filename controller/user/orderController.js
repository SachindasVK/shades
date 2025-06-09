const User = require('../../models/userSchema');
const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema'); // Add this if not imported
const PDFDocument = require('pdfkit');

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

        const orders = await Order.find({ userId })
            .populate('orderedItems.product')
            .sort({ createdAt: -1 }); 

        res.render('order', {
            orders,
            username: userData.name
        });

    } catch (error) {
        console.error('Get Orders Error:', error);
        res.redirect('/pageNotFound');
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
            return res.redirect('/orders'); // Fixed redirect issue
        }

        // Calculate expected delivery date if not set
        if (!order.expectedDelivery) {
            const deliveryDate = new Date(order.createdOn);
            deliveryDate.setDate(deliveryDate.getDate() + 7); // 7 days from order date
            order.expectedDelivery = deliveryDate;
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

        if (!userId) {
            return res.status(401).send("Unauthorized");
        }

        // Validate ObjectId format
        if (!orderId.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).send("Invalid order ID");
        }

        const order = await Order.findOne({ _id: orderId, userId })
            .populate('userId')
            .populate('orderedItems.product');

        if (!order) {
            return res.status(404).send("Order not found");
        }

        const doc = new PDFDocument({ margin: 50 });

        // Set headers for download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderId}.pdf`);

        // Pipe PDF to response
        doc.pipe(res);

        // Header
        doc.fontSize(20).text('INVOICE', { align: 'center' });
        doc.moveDown();

        // Order details
        doc.fontSize(14).text(`Order ID: ${order.orderId}`, { align: 'left' });
        doc.text(`Invoice Date: ${new Date(order.createdOn).toLocaleDateString('en-GB')}`);
        doc.moveDown();

        // Customer details
        doc.fontSize(12).text('BILL TO:', { underline: true });
        doc.text(`Name: ${order.userId.name}`);
        doc.text(`Email: ${order.userId.email}`);
        
        // Shipping address
        if (order.address) {
            doc.text(`Address: ${order.address.flat || ''} ${order.address.area || ''}`);
            doc.text(`${order.address.city || ''}, ${order.address.state || ''} - ${order.address.pincode || ''}`);
            doc.text(`Phone: ${order.address.phone || ''}`);
        }
        doc.moveDown();

        // Items table header
        doc.text('ITEMS:', { underline: true });
        doc.moveDown(0.5);

        // Table headers
        const tableTop = doc.y;
        doc.text('Item', 50, tableTop);
        doc.text('Qty', 300, tableTop);
        doc.text('Price', 350, tableTop);
        doc.text('Total', 450, tableTop);
        
        // Draw line under headers
        doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();
        
        let yPosition = tableTop + 25;

        // Items
        order.orderedItems.forEach(item => {
            if (item.status !== 'cancelled') {
                const itemTotal = item.price * item.quantity;
                
                // Wrap long product names
                const productName = item.productName.length > 30 
                    ? item.productName.substring(0, 30) + '...' 
                    : item.productName;
                
                doc.text(productName, 50, yPosition);
                doc.text(item.quantity.toString(), 300, yPosition);
                doc.text(`₹${item.price.toLocaleString('en-IN')}`, 350, yPosition);
                doc.text(`₹${itemTotal.toLocaleString('en-IN')}`, 450, yPosition);
                
                yPosition += 20;
            }
        });

        // Summary section
        yPosition += 20;
        doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke(); // Line before summary
        yPosition += 15;

        // Calculate totals for non-cancelled items
        const activeItems = order.orderedItems.filter(item => item.status !== 'cancelled');
        const subtotal = activeItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        doc.text('Subtotal:', 350, yPosition);
        doc.text(`₹${subtotal.toLocaleString('en-IN')}`, 450, yPosition);
        yPosition += 15;

        if (order.discount > 0) {
            doc.text('Discount:', 350, yPosition);
            doc.text(`-₹${order.discount.toLocaleString('en-IN')}`, 450, yPosition);
            yPosition += 15;
        }

        doc.text('Delivery Charge:', 350, yPosition);
        doc.text(`₹${(order.deliveryCharge || 0).toLocaleString('en-IN')}`, 450, yPosition);
        yPosition += 15;

        doc.text('GST:', 350, yPosition);
        doc.text(`₹${(order.gstAmount || 0).toLocaleString('en-IN')}`, 450, yPosition);
        yPosition += 15;

        // Final total
        doc.fontSize(14).font('Helvetica-Bold');
        doc.text('TOTAL:', 350, yPosition);
        doc.text(`₹${order.finalAmount.toLocaleString('en-IN')}`, 450, yPosition);

        // Payment method
        yPosition += 30;
        doc.fontSize(12).font('Helvetica');
        doc.text(`Payment Method: ${order.paymentMethod.toUpperCase()}`, 50, yPosition);
        doc.text(`Payment Status: ${(order.paymentStatus || 'pending').toUpperCase()}`, 50, yPosition + 15);

        // Footer
        yPosition += 50;
        doc.text('Thank you for your business!', { align: 'center' });

        doc.end();

    } catch (error) {
        console.error('Invoice Download Error:', error);
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
                    { $inc: { quantity: item.quantity } }
                );
            }
        }

        await order.save();

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

const cancelOrderItem = async (req, res) => {
    try {
        const { itemId } = req.params;
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
        if (!itemId.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ success: false, message: 'Invalid item ID' });
        }

        const order = await Order.findOne({ 
            "orderedItems._id": itemId,
            userId 
        }).populate('orderedItems.product');

        if (!order) {
            return res.status(404).json({ 
                success: false, 
                message: "Item not found in your orders" 
            });
        }

        const item = order.orderedItems.id(itemId);
        
        if (!item) {
            return res.status(404).json({ 
                success: false, 
                message: "Item not found" 
            });
        }

        // Check if item can be cancelled
        if (['cancelled', 'delivered', 'shipped'].includes(item.status)) {
            return res.status(400).json({ 
                success: false, 
                message: `Cannot cancel item with status: ${item.status}` 
            });
        }

        // Update item status
        item.status = 'cancelled';
        item.cancelReason = cancelReason.trim();
        item.cancelledAt = new Date();

        // Restore product stock
        if (item.product) {
            await Product.findByIdAndUpdate(
                item.product._id,
                { $inc: { quantity: item.quantity } }
            );
        }

        // Check if all items in the order are cancelled
        const allCancelled = order.orderedItems.every(orderItem => 
            orderItem.status === 'cancelled'
        );

        if (allCancelled) {
            order.status = 'cancelled';
            order.cancelReason = 'All items cancelled';
            order.cancelledAt = new Date();
        }

        await order.save();

        res.json({ 
            success: true, 
            message: 'Item cancelled successfully. Refund will be processed within 5-7 business days.' 
        });

    } catch (error) {
        console.error("Item Cancel Error:", error);
        res.status(500).json({ 
            success: false, 
            message: 'An error occurred while cancelling the item' 
        });
    }
};

// Additional helper function for order status updates
const updateOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;
        const userId = req.session.user;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        const order = await Order.findOne({ _id: orderId, userId });
        
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        order.status = status;
        order.updatedOn = new Date();

        if (status === 'delivered') {
            order.deliveredOn = new Date();
            // Update all items to delivered
            order.orderedItems.forEach(item => {
                if (item.status !== 'cancelled') {
                    item.status = 'delivered';
                }
            });
        }

        await order.save();

        res.json({ success: true, message: 'Order status updated successfully' });

    } catch (error) {
        console.error('Update Order Status Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Return request handler (bonus feature)
const requestReturn = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { returnReason, returnDescription } = req.body;
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

        // Check if return window is still open (e.g., 7 days)
        const returnWindow = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
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
        order.returnDescription = returnDescription;
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
    cancelOrderItem,
    // updateOrderStatus,
    // requestReturn
}