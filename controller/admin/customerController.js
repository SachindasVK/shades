const User = require('../../models/userSchema');

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
            // Assuming there's an Order model and relation
            // This would need to be adapted based on your actual data model
            // userData[i].orderCount = await Order.countDocuments({ userId: userData[i]._id });
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

// View specific customer
const viewCustomer = async (req, res) => {
    try {
        const userId = req.params.id;
        const userDetails = await User.findById(userId);
        
        if (!userDetails) {
            return res.status(404).render('admin/error', {
                message: 'Customer not found'
            });
        }
        
        // Fetch recent orders (uncomment and modify based on your Order model)
        // const orders = await Order.find({ userId: userId })
        //     .sort({ createdAt: -1 })
        //     .limit(5);
        
        res.render('customer-view', {
            pageTitle: 'Customer Details',
            user: userDetails,
            // orders: orders || []
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