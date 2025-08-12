const User = require('../../models/userSchema');
const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const Coupon = require('../../models/couponSchema');
const bcrypt = require('bcrypt');
const logger = require('../../helpers/logger');

const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        logger.error('Error destroying session:', err);
        return res.redirect('/error');
      }

      res.clearCookie('connect.sid');
      logger.info('logout success');

      res.redirect('/admin/login');
    });
  } catch (error) {
    logger.error('Unexpected error during logout:', error);
    res.redirect('/admin/error');
  }
};

const error = async (req, res) => {
  try {
    res.render('error', {
      message: 'An error occurred while processing your request.',
    });
  } catch (error) {
    logger.error('Error rendering the error page:', error);
    res.status(500).send('An error occurred while rendering the error page');
  }
};

const loadLogin = (req, res) => {
  if (req.session.admin) {
    return res.redirect('/admin/dashboard');
  }
  res.render('adminLogin', { message: '' });
};

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
        return res.render('adminLogin', {
          message: 'Invalid email or password',
        });
      }
    } else {
      return res.render('adminLogin', { message: 'No admin account found' });
    }
  } catch (error) {
    logger.error('login error!', error);
    return res.redirect('/admin/error');
  }
};

const loadDashboard = async (req, res) => {
  if (!req.session.admin) return [];

  try {
    const result = await Order.aggregate([
      {
        $match: {
          status: { $in: ['delivered'] },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: {
            $sum: '$finalAmount',
          },
        },
      },
    ]);
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
    const outOfStock = await Product.countDocuments({
      quantity: 0,
      isDeleted: false,
    });
    const lowStock = await Product.countDocuments({
      quantity: { $gt: 0, $lte: 5 },
      isDeleted: false,
    });
    const inStock = await Product.countDocuments({
      quantity: { $gt: 5 },
      isDeleted: false,
    });

    const recentActivities = [];

    const recentOrders = await Order.find().sort({ createdAt: -1 }).limit(1).lean();
    recentOrders.forEach((order) => {
      recentActivities.push({
        type: 'order',
        time: order.createdAt,
        orderId: order.orderId,
      });
    });

    const recentUsers = await User.find({ isAdmin: false }).sort({ createdAt: -1 }).limit(1).lean();
    recentUsers.forEach((user) => {
      recentActivities.push({
        type: 'user',
        time: user.createdAt,
        name: user.name,
      });
    });

    const lowStockProducts = await Product.find({
      quantity: { $lte: 5, $gt: 0 },
    })
      .sort({ updatedAt: -1 })
      .limit(1)
      .lean();
    lowStockProducts.forEach((product) => {
      recentActivities.push({
        type: 'lowStock',
        time: product.updatedAt,
        productName: product.productName,
        quantity: product.quantity,
      });
    });
    const outOfStockProducts = await Product.find({ quantity: { $eq: 0 } })
      .sort({ updatedAt: -1 })
      .limit(1)
      .lean();
    outOfStockProducts.forEach((product) => {
      recentActivities.push({
        type: 'outOfStock',
        time: product.updatedAt,
        productName: product.productName,
        quantity: product.quantity,
      });
    });

    const stockAddedProducts = await Product.find({ quantity: { $gt: 0 } })
      .sort({ createdAt: -1 })
      .limit(1)
      .lean();
    stockAddedProducts.forEach((product) => {
      recentActivities.push({
        type: 'stockAdded',
        time: product.createdAt,
        productName: product.productName,
        quantity: product.quantity,
      });
    });

    const recentCoupons = await Coupon.find({ isDeleted: false })
      .sort({ createdOn: -1 })
      .limit(1)
      .lean();
    recentCoupons.forEach((coupon) => {
      recentActivities.push({
        type: 'coupon',
        time: coupon.createdOn,
        name: coupon.name,
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
      topProducts,
    });
  } catch (error) {
    logger.error('dashboard error', error);
    res.redirect('/admin/error');
  }
};

const viewAllRecentActivities = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    const recentActivities = [];

    const recentOrders = await Order.find().sort({ createdAt: -1 }).lean();
    recentOrders.forEach((order) => {
      recentActivities.push({
        type: 'order',
        time: order.createdAt,
        orderId: order.orderId,
      });
    });

    const recentUsers = await User.find({ isAdmin: false }).sort({ createdAt: -1 }).lean();
    recentUsers.forEach((user) => {
      recentActivities.push({
        type: 'user',
        time: user.createdAt,
        name: user.name,
      });
    });

    const lowStockProducts = await Product.find({ quantity: { $lte: 5 } })
      .sort({ updatedAt: -1 })
      .lean();
    lowStockProducts.forEach((product) => {
      recentActivities.push({
        type: 'lowStock',
        time: product.updatedAt,
        productName: product.productName,
        quantity: product.quantity,
      });
    });

    const outOfStockProducts = await Product.find({ quantity: 0 }).sort({ updatedAt: -1 }).lean();
    outOfStockProducts.forEach((product) => {
      recentActivities.push({
        type: 'outOfStock',
        time: product.updatedAt,
        productName: product.productName,
        quantity: product.quantity,
      });
    });

    const recentCoupons = await Coupon.find({ isDeleted: false }).sort({ createdOn: -1 }).lean();
    recentCoupons.forEach((coupon) => {
      recentActivities.push({
        type: 'coupon',
        time: coupon.createdOn,
        name: coupon.name,
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
      search,
    });
  } catch (error) {
    logger.error('Error fetching orders:', error);
    res.status(500).render('error', {
      message: 'Failed to load order management page',
    });
  }
};

const getSalesChart = async (req, res) => {
  try {
    const filter = req.query.filter || 'monthly';
    const now = new Date();
    const match = {
      status: 'delivered',
    };

    let groupStage = {};
    if (filter === 'daily') {
      const past7Days = new Date();
      past7Days.setDate(now.getDate() - 6);
      match.createdAt = { $gte: past7Days };
      groupStage = {
        _id: { $dateToString: { format: '%d-%m', date: '$createdAt' } },
        total: { $sum: '$finalAmount' },
      };
    } else if (filter === 'weekly') {
      const past30Days = new Date();
      past30Days.setDate(now.getDate() - 30);
      match.createdAt = { $gte: past30Days };
      groupStage = {
        _id: { $isoWeek: '$createdAt' },
        total: { $sum: '$finalAmount' },
      };
    } else if (filter === 'monthly') {
      groupStage = {
        _id: { $month: '$createdAt' },
        total: { $sum: '$finalAmount' },
      };
    } else if (filter === 'yearly') {
      groupStage = {
        _id: { $year: '$createdAt' },
        total: { $sum: '$finalAmount' },
      };
    }

    const sales = await Order.aggregate([
      { $match: match },
      { $group: groupStage },
      { $sort: { _id: 1 } },
    ]);

    res.json({ success: true, data: sales });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ success: false, message: 'Failed to load chart' });
  }
};

const getTopSalesData = async (req, res) => {
  try {
    const filter = req.query.filter || 'product';

    let pipeline = [];

    const matchStage = {
      $match: {
        status: 'delivered',
      },
    };

    if (filter === 'product') {
      pipeline = [
        matchStage,
        { $unwind: '$orderedItems' },
        {
          $group: {
            _id: '$orderedItems.product',
            totalSold: { $sum: '$orderedItems.quantity' },
          },
        },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'product',
          },
        },
        { $unwind: '$product' },
        {
          $match: {
            'product.isDeleted': { $ne: true },
            'product.isActive': { $ne: false },
          },
        },
        {
          $project: {
            name: {
              $cond: {
                if: {
                  $or: [
                    { $eq: ['$product.productName', null] },
                    { $eq: ['$product.productName', ''] },
                  ],
                },
                then: 'Unnamed Product',
                else: '$product.productName',
              },
            },
            totalSold: 1,
          },
        },
        { $sort: { totalSold: -1 } },
        { $limit: 10 },
      ];
    } else if (filter === 'category') {
      pipeline = [
        matchStage,
        { $unwind: '$orderedItems' },
        {
          $lookup: {
            from: 'products',
            localField: 'orderedItems.product',
            foreignField: '_id',
            as: 'product',
          },
        },
        { $unwind: '$product' },
        {
          $match: {
            'product.isDeleted': { $ne: true },
            'product.isActive': { $ne: false },
          },
        },
        {
          $group: {
            _id: '$product.category',
            totalSold: { $sum: '$orderedItems.quantity' },
          },
        },
        {
          $lookup: {
            from: 'categories',
            localField: '_id',
            foreignField: '_id',
            as: 'category',
          },
        },
        { $unwind: '$category' },
        {
          $match: {
            'category.isDeleted': { $ne: true },
            'category.isActive': { $ne: false },
          },
        },
        {
          $project: {
            name: {
              $cond: {
                if: {
                  $or: [{ $eq: ['$category.name', null] }, { $eq: ['$category.name', ''] }],
                },
                then: 'Unnamed Category',
                else: '$category.name',
              },
            },
            totalSold: 1,
          },
        },
        { $sort: { totalSold: -1 } },
        { $limit: 10 },
      ];
    } else if (filter === 'brand') {
      pipeline = [
        matchStage,
        { $unwind: '$orderedItems' },
        {
          $lookup: {
            from: 'products',
            localField: 'orderedItems.product',
            foreignField: '_id',
            as: 'product',
          },
        },
        { $unwind: '$product' },
        {
          $match: {
            'product.isDeleted': { $ne: true },
            'product.isActive': { $ne: false },
          },
        },
        {
          $group: {
            _id: '$product.brand',
            totalSold: { $sum: '$orderedItems.quantity' },
          },
        },
        {
          $lookup: {
            from: 'brands',
            localField: '_id',
            foreignField: '_id',
            as: 'brand',
          },
        },
        { $unwind: '$brand' },
        {
          $match: {
            'brand.isDeleted': { $ne: true },
            'brand.isActive': { $ne: false },
          },
        },
        {
          $project: {
            name: {
              $cond: {
                if: {
                  $or: [{ $eq: ['$brand.name', null] }, { $eq: ['$brand.name', ''] }],
                },
                then: 'Unnamed Brand',
                else: '$brand.name',
              },
            },
            totalSold: 1,
          },
        },
        { $sort: { totalSold: -1 } },
        { $limit: 10 },
      ];
    }

    const result = await Order.aggregate(pipeline);
    if (!result || result.length === 0) {
      console.log('No data found for filter:', filter);
      return res.json({
        success: true,
        data: [],
        message: `No ${filter} sales data found`,
      });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Error in getTopSalesData:', error);
    res.status(500).json({
      success: false,
      message: 'Chart data error',
      error: error.message,
    });
  }
};
module.exports = {
  loadLogin,
  login,
  loadDashboard,
  error,
  logout,
  viewAllRecentActivities,
  getSalesChart,
  getTopSalesData,
};
