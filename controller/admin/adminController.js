const User = require('../../models/userSchema')
const Order = require('../../models/orderSchema')
const Product = require('../../models/productSchema')
const Coupon = require('../../models/couponSchema')
const mongoose = require('mongoose')
const bcrypt = require('bcrypt')

const logout = async (req, res) => {
    try {
        // Destroy the session to log out the admin
        req.session.destroy(err => {
            if (err) {
                console.log('Error destroying session:', err);
                return res.redirect('/pageerror');
            }

            // Clear the cookie to avoid session traces
            res.clearCookie('connect.sid'); // depends on your session cookie name


            res.redirect('/admin/login');
        });
    } catch (error) {
        console.log('Unexpected error during logout:', error);
        res.redirect('/admin/error');
    }
};


const error = async (req, res) => {
    try {
        res.render('error', { message: 'An error occurred while processing your request.' });
    } catch (error) {
        console.error('Error rendering the error page:', error);
        res.status(500).send('An error occurred while rendering the error page');
    }
}


const loadLogin = (req, res) => {
    if (req.session.admin) {
        return res.redirect('/admin/dashboard')
    }
    res.render('adminLogin', { message: '' })
}

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const admin = await User.findOne({ email, isAdmin: true });

        if (admin) {
            const passwordMatch = await bcrypt.compare(password, admin.password);

            if (passwordMatch) {
                req.session.admin = admin._id;
                return res.redirect('/admin/dashboard');
            } else {
                return res.render('adminLogin', { message: 'Invalid email or password' });
            }
        } else {
            return res.render('adminLogin', { message: 'No admin account found' });
        }
    } catch (error) {
        console.log('login error!', error);
        return res.redirect('/admin/error');
    }
};




const loadDashboard = async (req, res) => {
    if (req.session.admin) {
        try {

            const result = await Order.aggregate([
                {
                    $match: {
                        status: { $in: ['confirmed', 'delivered'] }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalRevenue: {
                            $sum: '$finalAmount'
                        }
                    }
                }
            ])
            const topProducts = await Product.find({ isDeleted: false, isActive: true })
                .sort({ salesCount: -1 })
                .limit(5)
                .lean();

            const orders = await Order.find({})
                .populate('userId', 'name email')
                .sort({ createdAt: -1 })
                .limit(4)
                .lean();


            const totalRevenue = result[0]?.totalRevenue || 0;
            const totalOrders = await Order.countDocuments({});
            const totalCustomers = await User.countDocuments({ isAdmin: false });
            const totalProducts = await Product.countDocuments({ isDeleted: false });
            const outOfStock = await Product.countDocuments({ quantity: 0, isDeleted: false });
            const lowStock = await Product.countDocuments({ quantity: { $gt: 0, $lte: 5 }, isDeleted: false });
            const inStock = await Product.countDocuments({ quantity: { $gt: 5 }, isDeleted: false });


            const recentActivities = [];

            const recentOrders = await Order.find().sort({ createdAt: -1 }).limit(1).lean();
            recentOrders.forEach(order => {
                recentActivities.push({
                    type: 'order',
                    time: order.createdAt,
                    orderId: order.orderId
                });
            });

            const recentUsers = await User.find({ isAdmin: false }).sort({ createdAt: -1 }).limit(1).lean();
            recentUsers.forEach(user => {
                recentActivities.push({
                    type: 'user',
                    time: user.createdAt,
                    name: user.name
                });
            });

            const lowStockProducts = await Product.find({ quantity: { $lte: 5, $gt: 0 } }).sort({ updatedAt: -1 }).limit(1).lean();
            lowStockProducts.forEach(product => {
                recentActivities.push({
                    type: 'lowStock',
                    time: product.updatedAt,
                    productName: product.productName,
                    quantity: product.quantity
                });
            });
            const outOfStockProducts = await Product.find({ quantity: { $eq: 0 } }).sort({ updatedAt: -1 }).limit(1).lean();
            outOfStockProducts.forEach(product => {
                recentActivities.push({
                    type: 'outOfStock',
                    time: product.updatedAt,
                    productName: product.productName,
                    quantity: product.quantity
                });
            });

            const stockAddedProducts = await Product.find({ quantity: { $gt: 0 } })
                .sort({ updatedAt: -1 })
                .limit(1)
                .lean();
            stockAddedProducts.forEach(product => {
                recentActivities.push({
                    type: 'stockAdded',
                    time: product.updatedAt,
                    productName: product.productName,
                    quantity: product.quantity
                });
            });

            const recentCoupons = await Coupon.find({ isDeleted: false }).sort({ createdOn: -1 }).limit(1).lean();
            recentCoupons.forEach(coupon => {
                recentActivities.push({
                    type: 'coupon',
                    time: coupon.createdOn,
                    name: coupon.name
                });
            });

            recentActivities.sort((a, b) => new Date(b.time) - new Date(a.time));


            res.render('dashboard', {
                pageTitle: 'Dashboard',
                totalRevenue,
                totalOrders,
                totalCustomers,
                totalProducts,
                outOfStock,
                lowStock,
                inStock,
                orders,
                recentActivities,
                topProducts
            })
        } catch (error) {
            console.log('dashboard error', error)
            res.redirect('/admin/error')
        }
    }
}


const viewAllRecentActivities = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';

        const recentActivities = [];

        const recentOrders = await Order.find().sort({ createdAt: -1 }).lean();
        recentOrders.forEach(order => {
            recentActivities.push({
                type: 'order',
                time: order.createdAt,
                orderId: order.orderId
            });
        });

        const recentUsers = await User.find({ isAdmin: false }).sort({ createdAt: -1 }).lean();
        recentUsers.forEach(user => {
            recentActivities.push({
                type: 'user',
                time: user.createdAt,
                name: user.name
            });
        });

        const lowStockProducts = await Product.find({ quantity: { $lte: 5 } }).sort({ updatedAt: -1 }).lean();
        lowStockProducts.forEach(product => {
            recentActivities.push({
                type: 'lowStock',
                time: product.updatedAt,
                productName: product.productName,
                quantity: product.quantity
            });
        });

        const outOfStockProducts = await Product.find({ quantity: 0 }).sort({ updatedAt: -1 }).lean();
        outOfStockProducts.forEach(product => {
            recentActivities.push({
                type: 'outOfStock',
                time: product.updatedAt,
                productName: product.productName,
                quantity: product.quantity
            });
        });

        const recentCoupons = await Coupon.find({ isDeleted: false }).sort({ createdOn: -1 }).lean();
        recentCoupons.forEach(coupon => {
            recentActivities.push({
                type: 'coupon',
                time: coupon.createdOn,
                name: coupon.name
            });
        });

        // Sort and paginate
        recentActivities.sort((a, b) => new Date(b.time) - new Date(a.time));
        const totalActivities = recentActivities.length;
        const paginatedActivities = recentActivities.slice(skip, skip + limit);

        res.render('recentActivity', {
            pageTitle: 'All Recent Activity',
            recentActivities: paginatedActivities,
            currentPage: page,
            limit,
            totalActivities,
            search
        });

    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).render('error', {
            message: 'Failed to load order management page',
        });
    }
};


module.exports = {
    loadLogin,
    login,
    loadDashboard,
    error,
    logout,
    viewAllRecentActivities
}