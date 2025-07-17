const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Wishlist = require("../../models/wishlistSchema");

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
    // Extract productIds from wishlist.products
    const productIds = wishlist.products.map((item) => item.productId);
    const products = await Product.find({
      _id: { $in: productIds },
      isDeleted: false,
      isActive: true,
    }).populate("category").populate('brand');

    const validProductIds = products.map((product) => product._id.toString());

    // Find invalid product entries to remove
    const invalidProducts = wishlist.products.filter(
      (item) => !validProductIds.includes(item.productId.toString())
    );

    if (invalidProducts.length > 0) {
      // Remove invalid products from wishlist.
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

      // Update wishlist.products locally as well
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
    console.error("Error in loadWishlist:", error);
    res.redirect("/pageNotFound");
  }
};

const addToWishlist = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId } = req.body;

    // Check if user is logged in
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login to add items to wishlist",
      });
    }

    // Validate productId
    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Find the user
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

    // Check if product is already in wishlist
    const productIndex = wishlist.products.findIndex(
      (item) => item.productId.toString() === productId
    );
    let added = false;

    if (productIndex > -1) {
      // Remove from wishlist if already exists
      wishlist.products.splice(productIndex, 1);
      added = false;
    } else {
      // Add to wishlist if not exists
      wishlist.products.push({ productId, addedOn: new Date() });
      added = true;
    }

    // Save the updated user
    await wishlist.save();

    // Return success response
    res.status(200).json({
      success: true,
      added: added,
      message: added
        ? "Product added to wishlist"
        : "Product removed from wishlist",
      wishlistCount: wishlist.products.length,
    });
  } catch (error) {
    console.error("Error in addToWishlist:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Fixed removeFromWishlist to handle both URL params and request body
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

    // Find user's wishlist document
    const wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: "Wishlist not found",
      });
    }

    // Remove product from wishlist
    const initialLength = wishlist.products.length;
    wishlist.products = wishlist.products.filter(
      (item) => item.productId.toString() !== productId
    );

    // Check if item was actually removed
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
    console.error("Error in removeFromWishlist:", error);
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

    // Check if user is logged in
    if (!userId) {
      return res.status(200).json({
        success: true,
        wishlistStatus: {},
      });
    }

    // Validate productIds
    if (!productIds || !Array.isArray(productIds)) {
      return res.status(400).json({
        success: false,
        message: "Product IDs array is required",
      });
    }

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Find user's wishlist
    const wishlist = await Wishlist.findOne({ userId });
    // Create status object for each product
    const wishlistStatus = {};

    if (wishlist && wishlist.products.length > 0) {
      const productIdSet = new Set(
        wishlist.products.map((item) => item.productId.toString())
      );

      productIds.forEach((id) => {
        wishlistStatus[id] = productIdSet.has(id);
      });
    } else {
      // If no wishlist, all are false
      productIds.forEach((id) => {
        wishlistStatus[id] = false;
      });
    }

    // Return status for all products
    res.status(200).json({
      success: true,
      wishlistStatus,
    });
  } catch (error) {
    console.error("Error in getWishlistStatus:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const wishlistCount = async (req, res) => {
  try {
    const userId = req.session.user;
    console.log('User in session:', userId);

    if (!userId) {
      return res.json({ count: 0 });
    }

    const wishlist = await Wishlist.findOne({ userId });
    console.log('wishlist:', wishlist);

    const count = wishlist ? wishlist.products.length : 0;

    console.log('wishlist Count:', count);

    res.json({ count });
  } catch (error) {
    console.error('Error fetching wishlist count:', error);
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
