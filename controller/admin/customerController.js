const User = require('../../models/userSchema');
const Order = require('../../models/orderSchema')
const Address = require('../../models/addressSchema')
const mongoose = require('mongoose');

const customerInfo = async (req, res) => {
    try {
        // Get search parameters
        let search = '';
        if (req.query.search) {
            search = req.query.search;
        }
        
        // Pagination parameters
        let page = 1;
        if (req.query.page) {
            page = Number(req.query.page);
        }
        const limit = 4;
        
        // Query to find users
        const userData = await User.find({
            isAdmin: false,
            $or: [
                { name: { $regex: '.*' + search + '.*', $options: 'i' } },
                { email: { $regex: '.*' + search + '.*', $options: 'i' } }
            ]
        })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec();
        
        // Count total matching users for pagination
        const count = await User.find({
            isAdmin: false,
            $or: [
                { name: { $regex: '.*' + search + '.*', $options: 'i' } },
                { email: { $regex: '.*' + search + '.*', $options: 'i' } }
            ]
        }).countDocuments();
        
        // Get order count for each user
        for (let i = 0; i < userData.length; i++) {
            userData[i].orderCount = await Order.countDocuments({ userId: userData[i]._id });
        }

        // Render the page with all required data
        res.render('customers', {
            pageTitle: 'Customers',
            userData,
            count,
            currentPage: page,
            limit,
            search
        });
    } catch (error) {
        console.error('Error in customer management:', error);
        res.status(500).render('admin/error', {
            message: 'An error occurred while loading customer data'
        });
    }
};

const viewCustomer = async (req, res) => {
  try {
    const userId = req.params.id;

    // Fetch user details
    const userDetails = await User.findById(userId);
    if (!userDetails) {
      return res.status(404).render('admin/error', {
        message: 'Customer not found'
      });
    }

    // Fetch address document
    const addressDoc = await Address.findOne({ userId });
    const addresses = addressDoc ? addressDoc.address : [];

    // Fetch orders for this user, sorted by newest first
    const orders = await Order.find({ userId }).sort({ createdAt: -1 }).lean();

    const userWithStats = {
      ...userDetails.toObject(),
      orderCount: orders.length
    };

    res.render('customer-view', {
      pageTitle: 'Customer Details',
      user: userWithStats,
      address: addresses,
      orders
    });

  } catch (error) {
    console.error('Error viewing customer:', error);
    res.status(500).render('admin/error', {
      message: 'An error occurred while retrieving customer details'
    });
  }
};


// Function to block a user
const blockUser = async (req, res) => {
    try {
        const userId = req.params.id;
        const { page, search } = req.query;

        await User.findByIdAndUpdate(userId, { isBlocked: true });

        // Construct redirect URL with page and search parameters
        let redirectUrl = `/admin/customers?page=${page || 1}`;
        if (search) {
            redirectUrl += `&search=${encodeURIComponent(search)}`;
        }

        res.redirect(redirectUrl);
    } catch (error) {
        console.error('Error blocking user:', error);
        res.status(500).render('admin/error', {
            message: 'Failed to block user'
        });
    }
};

// Function to unblock a user
const unblockUser = async (req, res) => {
    try {
        const userId = req.params.id;
        const { page, search } = req.query;

        await User.findByIdAndUpdate(userId, { isBlocked: false });

        // Construct redirect URL with page and search parameters
        let redirectUrl = `/admin/customers?page=${page || 1}`;
        if (search) {
            redirectUrl += `&search=${encodeURIComponent(search)}`;
        }

        res.redirect(redirectUrl);
    } catch (error) {
        console.error('Error unblocking user:', error);
        res.status(500).render('admin/error', {
            message: 'Failed to unblock user'
        });
    }
};

module.exports = {
    customerInfo,
    viewCustomer,
    blockUser,
    unblockUser
};