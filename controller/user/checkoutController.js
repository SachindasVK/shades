const User = require('../../models/userSchema')
const Cart = require('../../models/cartSchema')
const Address = require('../../models/addressSchema')
const Coupon = require('../../models/couponSchema')
const Wallet = require('../../models/walletSchema')
const Order = require('../../models/orderSchema')
const Product = require('../../models/productSchema')
const razorpay = require('../../config/razorpay')
const crypto = require('crypto')
const mongoose = require('mongoose');
const logger = require('../../helpers/logger')

const getSelectAddress = async (req, res) => {
  try {
    const userId = req.session.user;
    const userData = await User.findById(userId);
    if (!userId) {
      return res.redirect('/login');
    }

    const addressDoc = await Address.findOne({ userId });
    const addresses = addressDoc ? addressDoc.address : [];
    logger.info(`Selected address saved in session:  ${req.session.selectedAddress}`);

    res.render('selectAddress', {
      user: userData,
      addresses,
      isLoggedIn: true,
      username: userData.name,
      selectedAddress: req.session.selectedAddress || null
    });
  } catch (error) {
    logger.error('Error loading addresses:', error);
    res.redirect('/cart');
  }
}


const selectAddress = async (req, res) => {
  try {
    const userId = req.session.user;
    const { selectedAddressId } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    if (!selectedAddressId) {
      return res.status(400).json({ success: false, message: 'Please select an address' });
    }

    const addressDoc = await Address.findOne({ userId });

    if (!addressDoc) {
      return res.status(404).json({ success: false, message: 'No addresses found' });
    }

    const selectedAddress = addressDoc.address.find(addr => addr._id.toString() === selectedAddressId);

    if (!selectedAddress) {
      return res.status(404).json({ success: false, message: 'Selected address not found' });
    }

   
    req.session.selectedAddress = selectedAddress;

    res.json({
      success: true,
      message: 'Address selected successfully',
      redirectUrl: '/checkout/shipping'
    });

  } catch (error) {
    logger.error('Error selecting address:', error);
    res.status(500).json({
      success: false,
      message: 'Server error occurred while selecting address'
    });
  }
}

const loadShipping = async (req, res) => {
  try {
    const userId = req.session.user || req.user.id;
    const { addressId } = req.body;


    if (!addressId) {
      return res.status(400).json({
        success: false,
        message: 'Please select an address to continue'
      });
    }


    const userAddresses = await Address.findOne({ userId: userId });

    if (!userAddresses) {
      return res.status(404).json({
        success: false,
        message: 'No addresses found. Please add an address first.'
      });
    }

  
    const selectedAddress = userAddresses.address.find(addr => addr._id.toString() === addressId);
    logger.info(selectedAddress)
    if (!selectedAddress) {
      return res.status(404).json({
        success: false,
        message: 'Selected address not found. Please choose a different address.'
      });
    }

   
    req.session.selectedAddress = {
      addressId: addressId,
      name: selectedAddress.name,
      flat: selectedAddress.flat,
      area: selectedAddress.area,
      landMark: selectedAddress.landMark,
      city: selectedAddress.city,
      state: selectedAddress.state,
      pincode: selectedAddress.pincode,
      phone: selectedAddress.phone,
      addressType: selectedAddress.addressType,
      flat: selectedAddress.flat
    };

  
    req.session.save((err) => {
      if (err) {
        logger.error('Session save error:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to save address selection. Please try again.'
        });
      }

      res.json({
        success: true,
        message: 'Address selected successfully',
        redirectUrl: '/shipping'
      });
    });

  } catch (error) {
    logger.error('Error proceeding to shipping:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.'
    });
  }
}


const getShipping = async (req, res) => {
  try {
    const userId = req.session.user;

    const selectedAddress = req.session.selectedAddress;
    const shippingMethod = req.session.shippingMethod || null;
    if (!selectedAddress) {
      return res.redirect('/selected-address')
    }

    const user = await User.findById(userId);

    res.render('shipping', {
      address: selectedAddress,
      username: user?.name || "User"
    });
  } catch (error) {
    logger.error("Error loading shipping page:", error);
    res.status(500).send("Internal Server Error");
  }
};

const proceedToPayment = async (req, res) => {
  try {
    const userId = req.session.user;
    const { shippingMethod, deliveryDate } = req.body;

    if (!shippingMethod) {
      return res.status(400).json({ success: false, message: 'Shipping method is required' });
    }

    req.session.shippingDetails = {
      method: shippingMethod,
      date: shippingMethod === 'schedule' ? deliveryDate : null
    };

    return res.status(200).json({
      success: true,
      message: "Shipping method saved successfully",
      redirectUrl: "/payment"
    });
  } catch (error) {
    logger.error("Error proceeding to payment:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong while proceeding to payment"
    });
  }
}

const loadPayment = async (req, res) => {
  try {
    const userId = req.session.user;
    const selectedAddress = req.session.selectedAddress;
    const user = await User.findById(userId);

    const cart = await Cart.findOne({ userId }).populate('items.productId');
    let subtotal = 0;
    let cartItems = [];

    if (cart) {
      cartItems = cart.items.filter(item => item.status === 'Placed');
      cartItems.forEach(item => {
        const pricePerUnit = item.productId?.salePrice || item.productId?.regularPrice || 0;
        subtotal += pricePerUnit * item.quantity;
      });
    }

    // calculate total amount
    const baseDiscount = subtotal > 1500 ? 200 : 0;
    const deliveryCharge = subtotal > 2000 ? 0 : 50;
    const gst = Math.round(subtotal * 0.18);
    const totalAmount = subtotal + deliveryCharge + gst - baseDiscount;

    const wallet = await Wallet.findOne({ userId });

    const rawCoupons = await Coupon.find({
      isDeleted: false,
      expireOn: { $gte: new Date() },
      minimumPrice: { $lte: subtotal }
    });

    const coupons = rawCoupons.map(coupon => {
      const discountAmount = (coupon.discountPercentage / 100) * subtotal;
      const offerPrice = Math.min(discountAmount, coupon.maxDiscount); 
      return {
        ...coupon._doc,
        offerPrice: Math.floor(offerPrice) 
      };
    });


    const shippingDetails = req.session.shippingDetails || {};

    const deliveryDate = shippingDetails.date
      ? new Date(shippingDetails.date)
      : (() => {
        const date = new Date();
        date.setDate(date.getDate() + 3);
        return date;
      })();

    const expectedDeliveryDate = deliveryDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });

    const shippingMethod = shippingDetails.method
      ? shippingDetails.method.charAt(0).toUpperCase() + shippingDetails.method.slice(1)
      : "Free";

    const maxCodAmount = 20000;
    const isCodEligible = totalAmount <= maxCodAmount;

    res.render("payment", {
      user,
      username: user.name,
      address: selectedAddress,
      cartItems,
      totalAmount: subtotal,
      walletBalance: wallet?.balance || 0,
      coupons,
      expectedDeliveryDate,
      shippingMethod,
      isCodEligible,
      razorpayKey: process.env.RAZORPAY_KEY_ID
    });

  } catch (error) {
    logger.error("Error rendering payment page:", error.message);
    res.status(500).send("Error loading payment page");
  }
};

const placeOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const { paymentMethod, appliedCoupon, couponDiscount } = req.body;
    if (!paymentMethod) {
      return res.status(400).json({ success: false, message: 'Payment method is required' });
    }

    const selectedAddress = req.session.selectedAddress;
    if (!selectedAddress) {
      return res.status(400).json({ success: false, message: 'No address selected' });
    }

    const cart = await Cart.findOne({ userId }).populate('items.productId');
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    const activeItems = cart.items.filter(item => item.status === 'Placed');
    if (activeItems.length === 0) {
      return res.status(400).json({ success: false, message: 'No active items in cart' });
    }

    let subtotal = 0;
    const orderedItems = [];

  
    for (const item of activeItems) {
      const product = item.productId;
      if (!product) {
        return res.status(400).json({ success: false, message: 'Invalid product in cart' });
      }

      if (product.quantity < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for product: ${product.productName}`
        });
      }

      const itemPrice = product.salePrice || product.regularPrice || 0;
      const itemTotal = itemPrice * item.quantity;
      subtotal += itemTotal;

      orderedItems.push({
        product: product._id,
        productName: product.productName,
        productImages: product.productImage || [],
        quantity: item.quantity,
        price: itemPrice,
        regularPrice: product.regularPrice || itemPrice,
        status: 'confirmed'
      });
    }

    
    const baseDiscount = subtotal > 1500 ? 200 : 0;
    const totalDiscount = baseDiscount + (couponDiscount || 0);
    const deliveryCharge = subtotal > 2000 ? 0 : 50;
    const gst = Math.round(subtotal * 0.18);
    const finalAmount = subtotal + deliveryCharge + gst - totalDiscount;



    
    if (paymentMethod === 'cod' && finalAmount > 20000) {
      return res.status(400).json({
        success: false,
        message: 'COD not allowed for orders above ₹20,000'
      });
    }

    if (paymentMethod === 'wallet') {
      const wallet = await Wallet.findOne({ userId });
      if (!wallet || wallet.balance < finalAmount) {
        return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });
      }

      wallet.balance -= finalAmount;
      wallet.totalDebited += finalAmount;
      wallet.transactions.push({
        amount: finalAmount,
        transactionType: 'debit',
        transactionPurpose: 'purchase',
        description: 'Order placed using wallet'
      });
      await wallet.save();
    }

  
    const shippingDetails = req.session.shippingDetails || {};
    const deliveryDate = shippingDetails.date
      ? new Date(shippingDetails.date)
      : (() => {
        const date = new Date();
        date.setDate(date.getDate() + 3);
        return date;
      })();

    const expectedDelivery = deliveryDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });

    const shippingMethod = shippingDetails.method
      ? shippingDetails.method.charAt(0).toUpperCase() + shippingDetails.method.slice(1)
      : "Free";


    const order = new Order({
      userId,
      orderedItems,
      totalPrice: subtotal,
      discount: baseDiscount,
      couponApplied: !!appliedCoupon,
      couponCode: appliedCoupon || null,
      couponDiscount: couponDiscount || 0,
      deliveryCharge,
      gstAmount: gst,
      finalAmount,
      address: selectedAddress,
      paymentMethod,
      status: paymentMethod === 'wallet' ? 'confirmed' : 'pending',
      paymentStatus: paymentMethod === 'wallet' ? 'Paid' : 'Pending',
      invoiceDate: new Date(),
      createdOn: new Date(),
      expectedDelivery,
      shippingMethod
    });


    const savedOrder = await order.save();


    if (paymentMethod === 'online') {
      try {
        const razorpayOrder = await razorpay.orders.create({
          amount: finalAmount * 100,
          currency: "INR",
          receipt: `order_rcptid_${savedOrder._id}`,
          notes: {
            orderId: savedOrder._id.toString(),
            userId: userId.toString()
          }
        });

        savedOrder.razorpayOrderId = razorpayOrder.id;
        await savedOrder.save();

        return res.json({
          success: true,
          message: 'Redirecting to payment gateway',
          orderId: savedOrder._id,
          razorpayOrderId: razorpayOrder.id,
          amount: finalAmount,
          paymentRequired: true
        });
      } catch (razorpayError) {
        logger.error('Razorpay error:', JSON.stringify(razorpayError));

        
        await Order.findByIdAndDelete(savedOrder._id);
        return res.status(500).json({
          success: false,
          message: 'Failed to initialize payment gateway'
        });
      }
    }

  
    if (paymentMethod === 'cod' || paymentMethod === 'wallet') {
     
      for (const item of activeItems) {
        await Product.findByIdAndUpdate(item.productId._id, {
          $inc: {
            quantity: -item.quantity,
            salesCount: item.quantity
          }
        });
      }

     
      await Cart.findOneAndUpdate({ userId }, { $set: { items: [] } });

      
      delete req.session.selectedAddress;
      delete req.session.shippingDetails;
    }

    res.json({
      success: true,
      message: 'Order placed successfully!',
      orderId: savedOrder._id,
      redirectUrl: `/order-confirmation/${savedOrder._id}`
    });

  } catch (error) {
    logger.error('Error placing order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to place order. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};



const confirmOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    const user = await User.findById(userId);
    if (!user) return res.redirect('/login');

    const orderId = req.params.id;

    let order = null;

    if (mongoose.Types.ObjectId.isValid(orderId)) {
      order = await Order.findById(orderId);
    }

    if (!order) {
      order = await Order.findOne({ orderId });
    }

    if (!order) {
      logger.info(`Order not found ${orderId}`);
      return res.redirect('/pageNotFound');
    }

    
    for (const item of order.orderedItems) {
      if (item.status === 'pending') {
        item.status = 'confirmed';
        item.updatedOn = new Date();
      }
    }

    if (order.status === 'pending') {
      order.status = 'confirmed';
      order.updatedOn = new Date();
      await order.save();
    }


    const shippingDetails = req.session.shippingDetails || {};
    const deliveryDate = shippingDetails.date
      ? new Date(shippingDetails.date)
      : (() => {
        const date = new Date();
        date.setDate(date.getDate() + 3);
        return date;
      })();

    const expectedDeliveryDate = deliveryDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });

    res.render('order-confirm', {
      orderNumber: order.orderId,
      paymentMethod: order.paymentMethod,
      expectedDeliveryDate,
      totalAmount: order.finalAmount,
      username: user.name
    });

  } catch (error) {
    logger.error("Order confirmation error:", error);
    res.redirect('/pageNotFound');
  }
};






const loadRazorpayPayment = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const order = await Order.findById(orderId).populate('userId');

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (!order.razorpayOrderId) {
      return res.status(400).json({ success: false, message: "Razorpay Order ID missing" });
    }

    if (order.paymentStatus === 'Paid') {
      return res.status(400).json({ success: false, message: "Order already paid" });
    }

    res.json({
      success: true,
      razorpayKey: process.env.RAZORPAY_KEY_ID,
      amount: order.finalAmount * 100, 
      orderId: order.razorpayOrderId,
      orderDbId: order._id,
      customerName: order.userId.name,
      email: order.userId.email,
      phone: order.address.phone
    });

  } catch (error) {
    logger.error('Error loading Razorpay payment:', error);
    res.status(500).json({ success: false, message: "Failed to load payment details" });
  }
};



const verifyRazorpayPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderDbId } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderDbId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required payment verification data'
      });
    }

    const generatedSignature = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
     
      await Order.findByIdAndUpdate(orderDbId, {
        paymentStatus: 'Failed',
        status: 'failed',
        paymentError: 'Signature verification failed',
        updatedOn: new Date()
      });

      return res.status(400).json({
        success: false,
        message: 'Payment verification failed'
      });
    }

    
    const order = await Order.findById(orderDbId).populate('orderedItems.product');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    order.status = 'confirmed';
    order.paymentStatus = 'Paid';
    order.paymentId = razorpay_payment_id;
    order.updatedOn = new Date();
    await order.save();

    for (const item of order.orderedItems) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: {
          quantity: -item.quantity,
          salesCount: item.quantity
        }
      });
    }

   
    await Cart.findOneAndUpdate({ userId: order.userId }, { $set: { items: [] } });

  
    const userId = req.session.user;
    if (userId) {
      delete req.session.selectedAddress;
      delete req.session.shippingDetails;
    }

    res.json({
      success: true,
      message: 'Payment verified successfully',
      orderId: orderDbId
    });

  } catch (error) {
    logger.error("Razorpay verification error:", error);

  
    if (req.body.orderDbId) {
      await Order.findByIdAndUpdate(req.body.orderDbId, {
        paymentStatus: 'Failed',
        status: 'failed',
        paymentError: error.message,
        updatedOn: new Date()
      });
    }

    res.status(500).json({
      success: false,
      message: 'Payment verification failed due to server error'
    });
  }
};



const paymentFailed = async (req, res) => {
  try {
    const { orderDbId, reason } = req.body;

    if (!orderDbId) {
      return res.status(400).json({ success: false, message: "Order ID missing" });
    }

    await Order.findByIdAndUpdate(orderDbId, {
      status: 'pending',
      paymentStatus: 'Failed',
      paymentError: reason || 'Unknown failure',
      updatedOn: new Date()
    });

    return res.json({ success: true, message: "Payment marked as failed" });
  } catch (error) {
    logger.error("Payment Failed Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};



const orderFailure = async (req, res) => {
  try {
    const userId = req.session.user;
    const user = await User.findById(userId);

    if (!user) {
      return res.redirect('/login');
    }

    const order = await Order.findOne({ userId }).sort({ createdAt: -1 });

    if (!order) {
      return res.render('order-failure', {
        order: null,
        username: user.name
      });
    }

    res.render('order-failure', {
      order,
      username: user.name
    });
  } catch (error) {
    logger.error("Error in orderFailure controller:", error);
    res.redirect('/shop');
  }
};


module.exports = {
  getSelectAddress,
  selectAddress,
  loadShipping,
  getShipping,
  proceedToPayment,
  loadPayment,
  placeOrder,
  confirmOrder,
  loadRazorpayPayment,
  verifyRazorpayPayment,
  paymentFailed,
  orderFailure
}