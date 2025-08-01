const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Wishlist = require("../../models/wishlistSchema");
const logger = require('../../helpers/logger')

const loadWishlist = async (req, res) => {
  try {
    const userId = req.session.user;
    const user = await User.findById(userId);

    if (!user) {
      return res.redirect("/login");
    }
    let wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      return res.render("wishlist", {
        user: user.toObject(),
        username: user.name,
        wishlist: [],
        wishlistCount: 0,
      });
    }

    const productIds = wishlist.products.map((item) => item.productId);
    const products = await Product.find({
      _id: { $in: productIds },
      isDeleted: false,
      isActive: true,
    }).populate("category").populate('brand');

    const validProductIds = products.map((product) => product._id.toString());

    const invalidProducts = wishlist.products.filter(
      (item) => !validProductIds.includes(item.productId.toString())
    );

    if (invalidProducts.length > 0) {
      await Wishlist.updateOne(
        { userId },
        {
          $pull: {
            products: {
              productId: { $in: invalidProducts.map((i) => i.productId) },
            },
          },
        }
      );

      wishlist.products = wishlist.products.filter((item) =>
        validProductIds.includes(item.productId.toString())
      );
    }

    res.render("wishlist", {
      user: user.toObject(),
      username: user.name,
      wishlist: products,
      wishlistCount: products.length,
    });
  } catch (error) {
    logger.error("Error in loadWishlist:", error);
    res.redirect("/pageNotFound");
  }
};

const addToWishlist = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login to add items to wishlist",
      });
    }

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const user = await User.findById(userId);
    if (!user || user.isBlocked) {
      return res.status(404).json({
        success: false,
        message: "Unauthorized or blocked",
      });
    }

    let wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
      wishlist = new Wishlist({ userId, products: [] });
    }

    const productIndex = wishlist.products.findIndex(
      (item) => item.productId.toString() === productId
    );
    let added = false;

    if (productIndex > -1) {
      wishlist.products.splice(productIndex, 1);
      added = false;
    } else {
      wishlist.products.push({ productId, addedOn: new Date() });
      added = true;
    }

    await wishlist.save();

    res.status(200).json({
      success: true,
      added: added,
      message: added
        ? "Product added to wishlist"
        : "Product removed from wishlist",
      wishlistCount: wishlist.products.length,
    });
  } catch (error) {
    logger.error("Error in addToWishlist:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const removeFromWishlist = async (req, res) => {
  try {
    const userId = req.session.user;
    const productId = req.params.id || req.body.productId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login to manage wishlist",
      });
    }

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: "Wishlist not found",
      });
    }

    const initialLength = wishlist.products.length;
    wishlist.products = wishlist.products.filter(
      (item) => item.productId.toString() !== productId
    );

    if (wishlist.products.length === initialLength) {
      return res.status(404).json({
        success: false,
        message: "Item not found in wishlist",
      });
    }

    await wishlist.save();

    res.status(200).json({
      success: true,
      message: "Product removed from wishlist",
      wishlistCount: wishlist.products.length,
    });
  } catch (error) {
    logger.error("Error in removeFromWishlist:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getWishlistStatus = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productIds } = req.body;

    if (!userId) {
      return res.status(200).json({
        success: true,
        wishlistStatus: {},
      });
    }

    if (!productIds || !Array.isArray(productIds)) {
      return res.status(400).json({
        success: false,
        message: "Product IDs array is required",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const wishlist = await Wishlist.findOne({ userId });
    const wishlistStatus = {};

    if (wishlist && wishlist.products.length > 0) {
      const productIdSet = new Set(
        wishlist.products.map((item) => item.productId.toString())
      );

      productIds.forEach((id) => {
        wishlistStatus[id] = productIdSet.has(id);
      });
    } else {
      productIds.forEach((id) => {
        wishlistStatus[id] = false;
      });
    }
    res.status(200).json({
      success: true,
      wishlistStatus,
    });
  } catch (error) {
    logger.error("Error in getWishlistStatus:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const wishlistCount = async (req, res) => {
  try {
    const userId = req.session.user;

    if (!userId) {
      return res.json({ count: 0 });
    }

    const wishlist = await Wishlist.findOne({ userId });
    const count = wishlist ? wishlist.products.length : 0;

    res.json({ count });
  } catch (error) {
    logger.error('Error fetching wishlist count:', error);
    res.status(500).json({ count: 0 });
  }
};



module.exports = {
  loadWishlist,
  addToWishlist,
  removeFromWishlist,
  getWishlistStatus,
  wishlistCount
};
