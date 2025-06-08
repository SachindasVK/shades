const User = require('../../models/userSchema')
const Cart = require('../../models/cartSchema')
const Product = require('../../models/productSchema')
const Address = require('../../models/addressSchema')
const Coupon = require('../../models/couponSchema')
const Wallet = require('../../models/walletSchema')

const getSelectAddress = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);
        if (!userId) {
            return res.redirect('/login');
        }

        const addressDoc = await Address.findOne({ userId });
        const addresses = addressDoc ? addressDoc.address : [];

        res.render('selectAddress', {
            user: userData,
            addresses,
            isLoggedIn: true,
            username: userData.name
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
            redirectUrl: '/checkout/shipping' // Next step in checkout
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
        let total = 0;
        let cartItems = [];
        if (cart) {
            cartItems = cart.items.filter(item => item.status === 'Placed');
            cartItems.forEach(item => {
                total += item.totalPrice;
            });
        }


        const wallet = await Wallet.findOne({ userId });

       
        const coupons = await Coupon.find({
            isDeleted: false,
            expireOn: { $gte: new Date() },
            minimumPrice: { $lte: total }
        });


        const expectedDelivery = new Date();
        expectedDelivery.setDate(expectedDelivery.getDate() + 3);
        const expectedDeliveryDate = expectedDelivery.toDateString();
        
        const maxCodAmount = 10000;
        const isCodEligible = total <= maxCodAmount;
      
        res.render('payment', {
            user,
            username: user.name,
            address: selectedAddress,
            cartItems,
            totalAmount: total,
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

module.exports = {
    getSelectAddress,
    selectAddress,
    loadShipping,
    getShipping,
    proceedToPayment,
    loadPayment
}