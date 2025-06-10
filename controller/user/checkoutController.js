const User = require('../../models/userSchema')
const Cart = require('../../models/cartSchema')
const Address = require('../../models/addressSchema')
const Coupon = require('../../models/couponSchema')
const Wallet = require('../../models/walletSchema')
const Order = require('../../models/orderSchema')
const Product = require('../../models/productSchema')

const getSelectAddress = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);
        if (!userId) {
            return res.redirect('/login');
        }

        const addressDoc = await Address.findOne({ userId });
        const addresses = addressDoc ? addressDoc.address : [];
console.log("Selected address saved in session:", req.session.selectedAddress);

        res.render('selectAddress', {
            user: userData,
            addresses,
            isLoggedIn: true,
            username: userData.name,
            selectedAddress: req.session.selectedAddress || null 
        });
    } catch (error) {
        console.log('Error loading addresses:', error);
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

        // Store selected address in session for checkout process
        req.session.selectedAddress = selectedAddress;

        res.json({
            success: true,
            message: 'Address selected successfully',
            redirectUrl: '/checkout/shipping' 
        });

    } catch (error) {
        console.error('Error selecting address:', error);
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


        // Validate that addressId is provided
        if (!addressId) {
            return res.status(400).json({
                success: false,
                message: 'Please select an address to continue'
            });
        }

        // Find user's addresses and verify the selected address exists
        const userAddresses = await Address.findOne({ userId: userId });

        if (!userAddresses) {
            return res.status(404).json({
                success: false,
                message: 'No addresses found. Please add an address first.'
            });
        }

        // Find the selected address
        const selectedAddress = userAddresses.address.find(addr => addr._id.toString() === addressId);
        console.log(selectedAddress)
        if (!selectedAddress) {
            return res.status(404).json({
                success: false,
                message: 'Selected address not found. Please choose a different address.'
            });
        }

        // Store selected address in session for next steps
        req.session.selectedAddress = {
            addressId: addressId,
            name: selectedAddress.name,
            streetAddress: selectedAddress.streetAddress,
            area: selectedAddress.area,
            landMark: selectedAddress.landMark,
            city: selectedAddress.city,
            state: selectedAddress.state,
            pincode: selectedAddress.pincode,
            phone: selectedAddress.phone,
            addressType: selectedAddress.addressType
        };

        // Save session
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to save address selection. Please try again.'
                });
            }

            // Success response with redirect URL
            res.json({
                success: true,
                message: 'Address selected successfully',
                redirectUrl: '/shipping'
            });
        });

    } catch (error) {
        console.error('Error proceeding to shipping:', error);
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
        console.error("Error loading shipping page:", error);
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
        console.error("Error proceeding to payment:", error);
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
    


    //calculate final amount
    const baseDiscount = subtotal > 1500 ? 200 : 0;
    const deliveryCharge = subtotal > 2000 ? 0 : 50;
    const gst = Math.round(subtotal * 0.18);
    const totalAmount = subtotal + deliveryCharge + gst - baseDiscount;



    const wallet = await Wallet.findOne({ userId });

    const coupons = await Coupon.find({
      isDeleted: false,
      expireOn: { $gte: new Date() },
      minimumPrice: { $lte: subtotal }
    });

    const expectedDelivery = new Date();
    expectedDelivery.setDate(expectedDelivery.getDate() + 3);
    const expectedDeliveryDate = expectedDelivery.toDateString();


    const maxCodAmount = 20000; 
    const isCodEligible = totalAmount <= maxCodAmount;

    res.render('payment', {
      user,
      username: user.name,
      address: selectedAddress,
      cartItems,
      totalAmount: subtotal,
      finalAmount, 
      walletBalance: wallet?.balance || 0,
      coupons,
      expectedDeliveryDate,
      isCodEligible,
    });

  } catch (error) {
    console.error("Error rendering payment page:", error.message);
    res.status(500).send("Error loading payment page");
  }
};

const placeOrder = async (req, res) => {
  try {
    const userId = req.session.user?._id || req.user?._id;
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

      // Stock check
      if (product.stock < item.quantity) {
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
        status: 'pending'
      });
    }

    // Discounts and charges
    const baseDiscount = subtotal > 1500 ? 200 : 0;
    const totalDiscount = baseDiscount + (couponDiscount || 0);
    const deliveryCharge = subtotal > 2000 ? 0 : 50;
    const gst = Math.round(subtotal * 0.18);
    const finalAmount = subtotal + deliveryCharge + gst - totalDiscount;

    // Use consistent COD limit (20000) to match loadPayment
    if (paymentMethod === 'cod' && finalAmount > 20000) {
      return res.status(400).json({ 
        success: false, 
        message: 'COD not allowed for orders above ₹20,000' 
      });
    }

    if (paymentMethod === 'wallet') {
      const user = await User.findById(userId);
      if (!user || user.wallet < finalAmount) {
        return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });
      }
    }

    const expectedDelivery = new Date();
    expectedDelivery.setDate(expectedDelivery.getDate() + 5);

    const order = new Order({
      userId,
      orderedItems,
      totalPrice: subtotal,
      discount: totalDiscount,
      deliveryCharge,
      gstAmount: gst,
      finalAmount,
      address: selectedAddress,
      paymentMethod,
      status: paymentMethod === 'wallet' ? 'confirmed' : 'pending',
      invoiceDate: new Date(),
      createdOn: new Date(),
      couponApplied: !!appliedCoupon,
      expectedDelivery
    });

    const savedOrder = await order.save();

    // Wallet payment
    if (paymentMethod === 'wallet') {
      await User.findByIdAndUpdate(userId, { $inc: { wallet: -finalAmount } });
    }

    // If Razorpay/online payment needed
    if (paymentMethod === 'online') {
      return res.json({
        success: true,
        message: 'Redirecting to payment gateway',
        orderId: savedOrder.orderId,
        redirectUrl: `/payment/${savedOrder.orderId}`,
        paymentRequired: true
      });
    }

    // Clear the cart
    await Cart.findOneAndUpdate({ userId }, { $set: { items: [] } });

    // Clear session data
    delete req.session.selectedAddress;
    delete req.session.shippingMethod;

    res.json({
      success: true,
      message: 'Order placed successfully!',
      orderId: savedOrder.orderId,
      redirectUrl: `/order-confirmation/${savedOrder.orderId}`
    });

  } catch (error) {
    console.error('Error placing order:', error);
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
    const user = await User.findById(userId)
    if(!user){
        res.redirect('/login')
    }
    const orderId = req.params.id;

    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.redirect('/pageNotFound'); // or 404 page
    }

    function calculateExpectedDate(days = 7) {
  const today = new Date();
  today.setDate(today.getDate() + days);

  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return today.toLocaleDateString('en-IN', options); // eg: 15 June 2025
}
const expectedDeliveryDate = calculateExpectedDate(5); 

    res.render('order-confirm', {
      orderNumber: order.orderId,
      paymentMethod: order.paymentMethod,
      expectedDeliveryDate,
      totalAmount: order.finalAmount,
      username:user.name
    });

  } catch (error) {
    console.error("Order confirmation error:", error);
    res.redirect('/pageNotFound');
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
    confirmOrder
}