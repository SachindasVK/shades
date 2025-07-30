const User = require('../../models/userSchema');
const Category = require('../../models/categorySchema')
const Product = require('../../models/productSchema')
const Brand = require("../../models/brandSchema")
const Wallet = require('../../models/walletSchema')
const nodemailer = require('nodemailer');
require('dotenv').config();
const bcrypt = require('bcrypt');
const mongoose = require('mongoose')


function generateReferralCode(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}




// Nodemailer Transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.NODEMAILER_EMAIL,
    pass: process.env.NODEMAILER_PASSWORD
  }
});

// Generate OTP
const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send Verification Email
const sendVerificationEmail = async (email, otp) => {
  try {
    const mailOptions = {
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: 'SHADES - Verify Your Email',
      text: `Your OTP for SHADES registration is: ${otp}`
    };
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending verification email:', error);
    return false;
  }
};

// Secure Password
const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    return passwordHash;
  } catch (error) {
    console.error('Error hashing password:', error);
    throw error;
  }
};

const signup = async (req, res) => {
  try {
    const { name, email, password, cPassword, referralCode } = req.body;

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();
    const trimmedCPassword = cPassword.trim();

    if (trimmedPassword !== trimmedCPassword) {
      return res.render('signup', {
        isLoggedIn: false,
        username: '',
        message: 'Passwords do not match'
      });
    }

    // Add password strength validation
    if (trimmedPassword.length < 6) {
      return res.render('signup', {
        isLoggedIn: false,
        username: '',
        message: 'Password must be at least 6 characters long'
      });
    }

    const findUser = await User.findOne({ email: trimmedEmail });
    if (findUser) {
      return res.render('signup', {
        isLoggedIn: false,
        username: '',
        message: 'User with this email already exists'
      });
    }

    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(trimmedEmail, otp);
    if (!emailSent) {
      return res.render('signup', {
        isLoggedIn: false,
        username: '',
        message: 'Failed to send OTP. Please try again.'
      });
    }

    const hashedPassword = await securePassword(trimmedPassword);
    let referredBy = null;
    if (referralCode) {
      const referrer = await User.findOne({ referralCode });
      if (referrer) {
        referredBy = referralCode;
        req.session.referredBy = referredBy;
      }
    }

    // Set session data BEFORE rendering
    req.session.userOtp = otp;
    req.session.userData = {
      name: trimmedName,
      email: trimmedEmail,
      password: hashedPassword,
      referredBy
    };

    // Force session save before rendering
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.render('signup', {
          isLoggedIn: false,
          username: '',
          message: 'Session error. Please try again.'
        });
      }

      res.render('verify-otp', {
        isLoggedIn: false,
        username: '',
        email: trimmedEmail
      });
    });

    console.log('OTP sent to:', trimmedEmail);
    console.log('OTP:', otp);

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).render('page-404', {
      isLoggedIn: false,
      username: '',
      message: 'Server error'
    });
  }
};


// Load Homepage
const loadHomepage = async (req, res) => {
  try {
    const userId = req.session.user || (req.user && req.user._id);

    const categories = await Category.find({ isActive: true });
    const brands = await Brand.find({ isActive: true, isDeleted: false });
    // New arrivals
    let newArrivals = await Product.find({
      isDeleted: false,
      isActive:true,
      category: { $in: categories.map(category => category._id) }
    }).populate('category').populate('brand');
    newArrivals.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    newArrivals = newArrivals.slice(0, 12);

    // Best sellers
    let bestSellerProducts = await Product.find({
      isDeleted: false,
      category: { $in: categories.map(category => category._id) }
    }).populate('category').sort({ salesCount: -1 }).populate('brand');

    if (!bestSellerProducts[0]?.salesCount) {
      // No best sellers, fallback
      bestSellerProducts = await Product.find({
        isDeleted: false,
        category: { $in: categories.map(category => category._id) }
      }).populate('category')
    } else {
      bestSellerProducts = bestSellerProducts.slice(0, 4)
    }

    // User logic
    if (userId) {
      const userData = await User.findOne({ _id: userId });

      if (userData?.isBlocked) {
        req.session.destroy(err => {
          if (err) console.log('Session destroy error:', err);
          return res.redirect('/login');
        });
        return;
      }

      return res.render('home', {
        newArrivals,
        bestSellerProducts,
        isLoggedIn: true,
        username: userData.name,
        user: userData,
        categories,
        brands
      });
    }

    // Guest rendering
    res.render('home', {
      newArrivals,
      bestSellerProducts,
      isLoggedIn: false,
      username: '',
      categories,
      brands
    });

  } catch (error) {
    console.error('Home page error:', error);
    res.status(500).render('page-404', {
      isLoggedIn: false,
      username: '',
      message: 'Server error'
    });
  }
};





// Verify OTP
const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;

    if (!req.session.userOtp || !req.session.userData) {
      return res.status(400).json({
        success: false,
        message: 'Session expired. Please restart the signup process.'
      });
    }

    if (otp === req.session.userOtp) {
      const { name, email, password } = req.session.userData;
      const referredBy = req.session.referredBy || null;

      // Generate unique referral code
      let referralCode;
      let isUnique = false;
      while (!isUnique) {
        referralCode = generateReferralCode(8);
        const existing = await User.findOne({ referralCode });
        if (!existing) isUnique = true;
      }

      // Save user
      const saveUserData = new User({
        name,
        email,
        password,
        isAdmin: false,
        isBlocked: false,
        referralCode,
        referredBy,
      });

      const savedUser = await saveUserData.save();
      console.log('User saved successfully:', savedUser.email);
      if (referredBy) {
        const referrer = await User.findOne({ referralCode: referredBy });

        if (referrer) {
          // Update referrer's wallet
          let referrerWallet = await Wallet.findOne({ userId: referrer._id });
          if (!referrerWallet) {
            referrerWallet = new Wallet({ userId: referrer._id });
          }
          referrerWallet.balance += 220;
          referrerWallet.transactions.push({
            amount: 220,
            transactionType: 'credit',
            transactionPurpose: 'referrals',
            description: `Referral reward from ${savedUser.email}`
          });
          await referrerWallet.save();

          // Update referred user's wallet
          let referredWallet = await Wallet.findOne({ userId: savedUser._id });
          if (!referredWallet) {
            referredWallet = new Wallet({ userId: savedUser._id });
          }
          referredWallet.balance += 100;
          referredWallet.transactions.push({
            amount: 100,
            transactionType: 'credit',
            transactionPurpose: 'referrals',
            description: 'Referral bonus for signing up'
          });
          await referredWallet.save();

          // Update user model
          referrer.redeemedUsers.push(savedUser._id);
          await referrer.save();

          savedUser.redeemed = true;
          await savedUser.save();

          console.log(`Referral success: ${referrer.email} earned ₹220, ${savedUser.email} earned ₹100`);
        }
      }
      delete req.session.userOtp;
      delete req.session.userData;
      delete req.session.referredBy;

      req.session.user = savedUser._id;
      res.json({ success: true, redirectUrl: '/shop' });

    } else {
      res.status(400).json({
        success: false,
        message: 'Invalid OTP, please try again'
      });
    }

  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred!'
    });
  }
};


// Resend OTP with Session Recovery
const resendOtp = async (req, res) => {
  try {
    if (!req.session) {
      return res.status(400).json({
        success: false,
        message: 'Session expired. Please restart the signup process.',
        redirect: '/signup'
      });
    }

    if (!req.session.userData) {
      // Try to get email from request body as fallback
      let email = req.body.email;
      if (email) {
        email = email.trim().toLowerCase();
        const existingUser = await User.findOne({ email: email });
        if (existingUser) {
          console.log('User already exists, cannot resend OTP for existing user');
          return res.status(400).json({
            success: false,
            message: 'User already exists. Please login instead.',
            redirect: '/login'
          });
        }

        // Generate new OTP
        const otp = generateOtp();
        console.log('Resend OTP:', otp);

        // Recreate session data
        req.session.userOtp = otp;
        req.session.userData = { email: email };

        // Send verification email
        const emailSent = await sendVerificationEmail(email, otp);

        if (emailSent) {
          console.log('OTP sent successfully to:', email);
          return res.status(200).json({
            success: true,
            message: 'OTP sent successfully. Please check your email.'
          });
        } else {
          console.log('Failed to send email to:', email);
          return res.status(500).json({
            success: false,
            message: 'Failed to send OTP. Please try again.'
          });
        }
      }

      return res.status(400).json({
        success: false,
        message: 'Session expired. Please restart the signup process.',
        redirect: '/signup'
      });
    }

    const email = req.session.userData.email;

    if (!email) {
      console.log('Email not found in userData');
      return res.status(400).json({
        success: false,
        message: 'Email not found in session. Please restart the signup process.',
        redirect: '/signup'
      });
    }

    // Generate new OTP
    const otp = generateOtp();
    console.log('Generated new OTP:', otp);

    // Update session with new OTP
    req.session.userOtp = otp;

    // Save session explicitly to ensure it persists
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
      } else {
        console.log('Session saved successfully');
      }
    });

    // Send verification email
    const emailSent = await sendVerificationEmail(email, otp);

    if (emailSent) {
      console.log('OTP resent successfully to:', email);
      console.log('New OTP:', otp);

      res.status(200).json({
        success: true,
        message: 'OTP resent successfully. Please check your email.'
      });
    } else {
      console.log('Failed to send email to:', email);
      res.status(500).json({
        success: false,
        message: 'Failed to resend OTP. Please try again.'
      });
    }

  } catch (error) {
    console.error('Error in resendOtp:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again.'
    });
  }
};


// Load Signup
const loadSignup = async (req, res) => {
  try {
    if (req.session.user || req.user) {
      return res.redirect('/');
    }
    res.render('signup', {
      isLoggedIn: false,
      username: '',
      message: null
    });
  } catch (error) {
    console.error('Signup page error:', error);
    res.status(500).render('page-404', {
      isLoggedIn: false,
      username: '',
      message: 'Server error'
    });
  }
};

// Load Login
const loadLogin = async (req, res) => {
  try {
    if (req.session.user || req.user) {
      const user = req.user || await User.findById(req.session.user);
      if (user && !user.isBlocked) {
        return res.redirect('/');
      }
    }

    // Save the message & then remove it from session
    const message = req.session.errorMessage || null;
    delete req.session.errorMessage;

    res.render('login', {
      isLoggedIn: false,
      username: '',
      message
    });
  } catch (error) {
    console.error('Login page error:', error);
    res.status(500).render('page-404', {
      isLoggedIn: false,
      username: '',
      message: 'Server error'
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // input validation
    if (!email || !password) {
      req.session.errorMessage = 'Email and password are required!';
      return res.redirect('/login');
    }

    // Trim whitespace inputs
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    const findUser = await User.findOne({
      // isAdmin: 0,
      email: trimmedEmail
    });

    if (findUser && findUser.isAdmin) {
      return res.redirect('admin/login');
    }

    if (!findUser) {
      console.log('User not found for email:', trimmedEmail)
      req.session.errorMessage = 'User not found!'
      return res.redirect('/login')
    }

    if (findUser.isBlocked) {
      console.log('User is blocked:', trimmedEmail);
      req.session.errorMessage = 'User blocked by admin!'
      return res.redirect('/login')
    }

    // Check if password field exists and is not empty
    if (!findUser.password) {
      console.log('No password found for user:', trimmedEmail)
      req.session.errorMessage = 'Account setup incomplete. Please contact support.'
      return res.redirect('/login')
    }
    const passwordMatch = await bcrypt.compare(trimmedPassword, findUser.password)
    console.log('Password match result:', passwordMatch)

    if (!passwordMatch) {
      console.log('Password mismatch for user:', trimmedEmail)
      req.session.errorMessage = 'Incorrect password'
      return res.redirect('/login')
    }

    console.log('Login successful for user:', trimmedEmail);
    req.session.user = findUser._id;

    // Add session id regeneration for security
    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regeneration error:', err);
        req.session.errorMessage = 'Login failed. Please try again.';
        return res.redirect('/login');
      }
      // save user id again
      req.session.user = findUser._id;
      console.log('Session regenerated, redirecting to shop');
      res.redirect('/shop');
    });

  } catch (error) {
    console.error('Login error:', error);
    req.session.errorMessage = 'Login failed. Please try again later.';
    res.redirect('/login');
  }
};

// Page Not Found
const pageNotFound = async (req, res) => {
  try {
    res.render('page-404', {
      isLoggedIn: !!(req.session.user || req.user),
      username: '',
      message: 'Page not found'
    });
  } catch (error) {
    console.error('404 page error:', error);
    res.status(500).send('Server error');
  }
};



// Logout
const logout = async (req, res) => {
  try {
    console.log('Logout initiated for session:', req.session.user);

    if (req.user) {
      // For Google authenticated users (using Passport)
      req.logout((err) => {
        if (err) {
          console.error('Passport logout error:', err);
          return res.status(500).render('page-404', {
            isLoggedIn: false,
            username: '',
            message: 'Logout failed',
          });
        }

        // Destroy the session after logout with Passport
        req.session.destroy((err) => {
          if (err) {
            console.error('Session destroy error:', err);
            return res.status(500).render('page-404', {
              isLoggedIn: false,
              username: '',
              message: 'Session destroy failed',
            });
          }

          // Clear the session cookie
          res.clearCookie('connect.sid');
          console.log('Google user logged out successfully');
          res.redirect('/');
        });
      });
    } else if (req.session.user) {
      // For email/password authenticated users
      const userId = req.session.user;
      req.session.destroy((err) => {
        if (err) {
          console.error('Session destroy error:', err);
          return res.status(500).render('page-404', {
            isLoggedIn: false,
            username: '',
            message: 'Session destroy failed',
          });
        }

        // Clear the session cookie
        res.clearCookie('connect.sid');
        console.log('User logged out successfully:', userId);
        res.redirect('/');
      });
    } else {
      // User not logged in
      console.log('Logout attempt but user not logged in');
      res.redirect('/');
    }
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).render('page-404', {
      isLoggedIn: false,
      username: '',
      message: 'Server error',
    });
  }
};

const loadShoppingPage = async (req, res) => {
  try {
    // Get user data if logged in
    const userId = req.session.user;
    const userData = userId ? await User.findOne({ _id: userId }) : null;

    // Get all active categories and brands
    const categories = await Category.find({ isActive: true, isDeleted: false });
    const brands = await Brand.find({ isActive: true, isDeleted: false });

    // Parse query parameters with defaults
    const page = parseInt(req.query.page) || 1;
    const searchQuery = req.query.search || '';
    const categoryFilter = req.query.category || 'all';
    const brandFilter = req.query.brand || 'all';
    const sortOption = req.query.sort || 'new';
    const minPrice = req.query.minPrice ? parseInt(req.query.minPrice) : 0;
    const maxPrice = req.query.maxPrice
      ? parseInt(req.query.maxPrice)
      : Number.MAX_SAFE_INTEGER;

    // Build the query object
    const query = {
      isDeleted: false,
      isActive: true
    };

    // Add category filter
    if (categoryFilter !== 'all') {
      try {
        const categoryObjectId = mongoose.Types.ObjectId.isValid(categoryFilter)
          ? new mongoose.Types.ObjectId(categoryFilter)
          : null;
        if (categoryObjectId) {
          query.category = categoryObjectId;
        }
      } catch (err) {
        console.log('Error with category filter:', err);
      }
    }

    // Add brand filter
    if (brandFilter !== 'all') {
      try {
        const brandObjectId = mongoose.Types.ObjectId.isValid(brandFilter)
          ? new mongoose.Types.ObjectId(brandFilter)
          : null;
        if (brandObjectId) {
          query.brand = brandObjectId;
        }
      } catch (err) {
        console.log('Error with brand filter:', err);
      }
    }

    // Add price range filter
    const priceQuery = {};
    if (minPrice !== 0) priceQuery.$gte = minPrice;
    if (maxPrice !== Number.MAX_SAFE_INTEGER) priceQuery.$lte = maxPrice;
    if (Object.keys(priceQuery).length > 0) {
      query.$or = [{ price: priceQuery }, { salePrice: priceQuery }];
    }

    // Add search query
    if (searchQuery) {
      const searchConditions = [
        { productName: { $regex: searchQuery, $options: 'i' } },
        { name: { $regex: searchQuery, $options: 'i' } },
        { description: { $regex: searchQuery, $options: 'i' } },
      ];
      if (query.$or) {
        const existingOr = query.$or;
        query.$and = [{ $or: existingOr }, { $or: searchConditions }];
        delete query.$or;
      } else {
        query.$or = searchConditions;
      }
    }

    // Set up pagination
    const limit = 9;
    const skip = (page - 1) * limit;

    // Aggregation pipeline
    let aggregatePipeline = [
      { $match: query },
      {
        $addFields: {
          displayPrice: {
            $cond: {
              if: { $gt: ['$salePrice', 0] },
              then: '$salePrice',
              else: { $cond: { if: { $gt: ['$price', 0] }, then: '$price', else: 0 } },
            },
          },
          sortName: {
            $cond: {
              if: { $ifNull: ['$productName', false] },
              then: { $toLower: '$productName' },
              else: { $toLower: { $ifNull: ['$name', ''] } },
            },
          },
          averageRating: { $ifNull: ['$averageRating', 0] },
          views: { $ifNull: ['$views', 0] },
        },
      },
    ];

    // Apply sort
    switch (sortOption) {
      case 'price-asc':
        aggregatePipeline.push({ $sort: { displayPrice: 1, _id: 1 } });
        break;
      case 'price-desc':
        aggregatePipeline.push({ $sort: { displayPrice: -1, _id: 1 } });
        break;
      case 'name-asc':
        aggregatePipeline.push({ $sort: { sortName: 1, _id: 1 } });
        break;
      case 'name-desc':
        aggregatePipeline.push({ $sort: { sortName: -1, _id: 1 } });
        break;
      case 'popularity':
        aggregatePipeline.push({ $sort: { views: -1, _id: 1 } });
        break;
      case 'rating':
        aggregatePipeline.push({ $sort: { averageRating: -1, _id: 1 } });
        break;
      case 'featured':
        aggregatePipeline.push({ $sort: { isFeatured: -1, createdAt: -1, _id: 1 } });
        break;
      default:
        aggregatePipeline.push({ $sort: { createdAt: -1, _id: 1 } });
    }

    // category lookup
    aggregatePipeline.push(
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $addFields: { category: { $arrayElemAt: ['$category', 0] } } }
    );

    aggregatePipeline.push({
      $match: {
        'category.isActive': true,
        'category.isDeleted': false,
      },
    });

    // brand lookup
    aggregatePipeline.push(
      {
        $lookup: {
          from: 'brands',
          localField: 'brand',
          foreignField: '_id',
          as: 'brand',
        },
      },
      {
        $addFields: {
          brand: { $arrayElemAt: ['$brand', 0] },
        },
      }
    );


    // pagination
    aggregatePipeline.push({ $skip: skip }, { $limit: limit });

    // Execute aggregation
    const products = await Product.aggregate(aggregatePipeline);

    // wishlist status to products
    let productsWithWishlistStatus = products;
    if (userData) {
      const wishlist = userData.wishlist.map(id => id.toString());
      productsWithWishlistStatus = products.map(product => ({
        ...product,
        inWishlist: wishlist.includes(product._id.toString()),
      }));
    }

    // Get total count
    const totalProductsAgg = await Product.aggregate([
      { $match: query },
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $addFields: { category: { $arrayElemAt: ['$category', 0] } } },
      {
        $match: {
          'category.isActive': true,
          'category.isDeleted': false,
        },
      },
      { $count: 'total' }
    ]);

    const totalProducts = totalProductsAgg.length > 0 ? totalProductsAgg[0].total : 0;

    const totalPages = Math.ceil(totalProducts / limit);

    // Get price range
    const priceStatsPrice = await Product.aggregate([
      { $match: { isDeleted: false, quantity: { $gt: 0 }, price: { $exists: true } } },
      { $group: { _id: null, min: { $min: '$price' }, max: { $max: '$price' } } },
    ]);

    const priceStatsSalePrice = await Product.aggregate([
      { $match: { isDeleted: false, quantity: { $gt: 0 }, salePrice: { $exists: true } } },
      { $group: { _id: null, min: { $min: '$salePrice' }, max: { $max: '$salePrice' } } },
    ]);

    let minPrice1 = priceStatsPrice.length > 0 ? priceStatsPrice[0].min : Number.MAX_SAFE_INTEGER;
    let maxPrice1 = priceStatsPrice.length > 0 ? priceStatsPrice[0].max : 0;
    let minPrice2 = priceStatsSalePrice.length > 0 ? priceStatsSalePrice[0].min : Number.MAX_SAFE_INTEGER;
    let maxPrice2 = priceStatsSalePrice.length > 0 ? priceStatsSalePrice[0].max : 0;

    const priceRange = {
      min: Math.floor(
        Math.min(minPrice1, minPrice2) === Number.MAX_SAFE_INTEGER
          ? 0
          : Math.min(minPrice1, minPrice2)
      ),
      max: Math.ceil(Math.max(maxPrice1, maxPrice2) === 0 ? 1000 : Math.max(maxPrice1, maxPrice2)),
    };

    // Save search history
    if (userData) {
      const searchEntry = {
        query: searchQuery,
        category: categoryFilter !== 'all' ? categoryFilter : null,
        brand: brandFilter !== 'all' ? brandFilter : null,
        searchedOn: new Date(),
      };
      if (searchQuery || categoryFilter !== 'all' || brandFilter !== 'all') {
        userData.searchHistory.push(searchEntry);
        await userData.save();
      }
    }

    if (userData?.isBlocked) {
      req.session.destroy(err => {
        if (err) console.log('Session destroy error:', err);
        console.log('User Blocked!');
        return res.redirect('/login');
      });
      return;
    }

    res.render('shop', {
      isLoggedIn: !!req.session.user,
      user: userData,
      username: userData ? userData.name : null,
      products: productsWithWishlistStatus,
      category: categories,
      brand: brands,
      totalProducts: totalProducts,
      currentPage: page,
      totalPages: totalPages,
      filters: {
        search: searchQuery,
        category: categoryFilter,
        brand: brandFilter,
        sort: sortOption,
        minPrice: minPrice === 0 ? priceRange.min : minPrice,
        maxPrice: maxPrice === Number.MAX_SAFE_INTEGER ? priceRange.max : maxPrice,
      },
      priceRange: priceRange,
    });
  } catch (error) {
    console.log('Error in loadShoppingPage:', error);
    res.redirect('/pageNotFound');
  }
};



const productDetails = async (req, res) => {
    try {
        const userId = req.session.user
        const userData = await User.findById(userId)
        const productId = req.query.id
        const product = await Product.findById(productId).populate('category').populate('brand')
     
        if (!product||product.isDeleted) {
            return res.redirect('/shop');
        }
        
        const recommendations = await Product.find({
            isDeleted: false,
            category: product.category,
            _id: { $ne: productId }
        })

        if (userData?.isBlocked) {
            req.session.destroy(err => {
                if (err) console.log('Session destroy error:', err);
                return res.redirect('/login');
            });
            return;
        }
        res.render('productDetails', {
            isLoggedIn: req.session.user,
            user: userData,
            username: userData ? userData.name : null,
            product: product,
            quantity: product.quantity,
            recommendations
        })
    } catch (error) {
        console.error('error for fetching product details', error)
        res.redirect('/pageNotFound')
    }
}

module.exports = {
  loadHomepage,
  pageNotFound,
  loadSignup,
  loadLogin,
  signup,
  verifyOtp,
  resendOtp,
  login,
  logout,
  loadShoppingPage,
  generateReferralCode,
  productDetails
}