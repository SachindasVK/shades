const User = require('../../models/userSchema');
const Order = require('../../models/orderSchema')
const Address = require('../../models/addressSchema')
const logger = require('../../helpers/logger')

const customerInfo = async (req, res) => {
    try {

        let search = '';
        if (req.query.search) {
            search = req.query.search;
        }

        let page = 1;
        if (req.query.page) {
            page = Number(req.query.page);
        }
        const limit = 4;

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

        const count = await User.find({
            isAdmin: false,
            $or: [
                { name: { $regex: '.*' + search + '.*', $options: 'i' } },
                { email: { $regex: '.*' + search + '.*', $options: 'i' } }
            ]
        }).countDocuments();


        for (let i = 0; i < userData.length; i++) {
            userData[i].orderCount = await Order.countDocuments({ userId: userData[i]._id });
        }

        res.render('customers', {
            pageTitle: 'Customers Management',
            userData,
            count,
            currentPage: page,
            limit,
            search
        });
    } catch (error) {
        logger.error('Error in customer management:', error);
        res.status(500).render('error', {
            message: 'An error occurred while loading customer data'
        });
    }
};

const customerDetails = async (req, res) => {
    try {
        const userId = req.params.id;

        const userDetails = await User.findById(userId);
        if (!userDetails) {
            return res.status(404).render('error', {
                message: 'Customer not found'
            });
        }


        const addressDoc = await Address.findOne({ userId });
        const addresses = addressDoc ? addressDoc.address : [];

        const orders = await Order.find({ userId }).sort({ createdAt: -1 }).lean();

        const userWithStats = {
            ...userDetails.toObject(),
            orderCount: orders.length
        };

        res.render('customer-details', {
            pageTitle: 'Customer Details',
            user: userWithStats,
            address: addresses,
            orders
        });

    } catch (error) {
        logger.error('Error viewing customer:', error);
        res.status(500).render('error', {
            message: 'An error occurred while retrieving customer details'
        });
    }
};


const blockUser = async (req, res) => {
    try {
        const userId = req.params.id;
        if (!userId) {
            return res.status(400).json({ success: false, message: 'user not Found' })
        }
        await User.findByIdAndUpdate(userId, { isBlocked: true })
        res.status(200).json({ success: true, message: 'user blocked successfully' })
    } catch (error) {
        logger.error('block user error', error)
        res.status(500).json({ success: false, message: 'block user server error' })
    }
}



const unblockUser = async (req, res) => {
    try {
        const userId = req.params.id;
        if (!userId) {
            return res.status(400).json({ success: false, message: 'user not Found' })
        }
        await User.findByIdAndUpdate(userId, { isBlocked: false })
        res.status(200).json({ success: true, message: 'user unblocked successfully' })
    } catch (error) {
        logger.error('unblock user error', error)
        res.status(500).json({ success: false, message: 'unblock user server error' })
    }
}

module.exports = {
    customerInfo,
    customerDetails,
    blockUser,
    unblockUser
};