const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");

const getCart = async (req, res) => {
  try {
    const userId = req.session.user;

    const cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      model: "Product",
      populate: [
        { path: "brand", model: "Brand" },
        { path: "category", model: "Category" },
      ],
    });

    if (!cart) {
      return res.render("cart", {
        username: "",
        cartItems: [],
        grandTotal: 0,
      });
    }

    cart.items = cart.items.filter((item) => {
      const product = item.productId;
      return (
        product &&
        product.quantity >= 0 &&
        (!product.isDeleted || product.isDeleted === false) &&
        product.category &&
        product.category.status === "available"
      );
    });
    cart.items.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
    await cart.save();

    const cartItems = cart.items.map((item) => ({
      product: item.productId,
      quantity: item.quantity,
      price: item.productId.price,
      totalPrice: item.productId.salesPrice * item.quantity,
    }));

    const user = await User.findById(userId);

    res.render("cart", {
      username: user.name,
      cartItems,
    });
  } catch (error) {
    console.log("Error in getCart:", error);
    res.status(500).render("error", {
      message: "Something went wrong loading your cart",
      error: process.env.NODE_ENV === "development" ? error : {},
    });
  }
};

const addToCart = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId, quantity } = req.body;

    if (!userId) {
      return res
        .status(400)
        .json({ success: false, message: "You are not logged in!" });
    }

    if (!productId || quantity <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid product or quantity" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res
        .status(400)
        .json({ success: false, message: "Product not found" });
    }

    const itemPrice = product.salePrice;
    const itemTotal = itemPrice * quantity;

    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    const existingItem = cart.items.find(
      (item) => item.productId.toString() === productId
    );

    if (existingItem) {
      if (existingItem.quantity === quantity) {
        existingItem.quantity = quantity;
      }

      existingItem.totalPrice = existingItem.quantity * itemPrice;
      existingItem.price = itemPrice;
    } else {
      cart.items.push({
        productId,
        quantity,
        price: itemPrice,
        totalPrice: itemTotal,
      });
    }

    await cart.save();

    const cartCount = cart.items.reduce(
      (total, item) => total + item.quantity,
      0
    );
    res.json({ success: true, cartCount });
  } catch (error) {
    console.error("Add to Cart Error:", error);
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

const removeCart = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId } = req.body;

    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "please login first" });
    }

    const cart = await Cart.findOne({ userId });

    if (!cart) {
      return res
        .status(404)
        .json({ success: false, message: "Cart not found" });
    }
    cart.items = cart.items.filter(
      (item) => item.productId.toString() !== productId
    );
    console.log("Cart after removal:", cart.items);
    await cart.save();
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const updateQuantity = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId, quantity } = req.body;

    if (!productId || quantity < 1) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid input!" });
    }

    const cart = await Cart.findOne({ userId }).populate('items.productId');

    if (!cart) {
      return res
        .status(404)
        .json({ success: false, message: "Cart not found!" });
    }

    const existingItem = cart.items.find(
      (item) => item.productId._id.toString() === productId
    );

    if (!existingItem) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found in cart" });
    }

    // Check stock availability
    if (quantity > existingItem.productId.quantity) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Insufficient stock available",
          availableStock: existingItem.productId.quantity
        });
    }

    existingItem.quantity = quantity;
    await cart.save();

    // Return updated cart information
    return res.status(200).json({
      success: true,
      message: "Quantity updated",
      updatedItem: {
        productId: productId,
        quantity: quantity,
        unitPrice: existingItem.productId.salePrice || existingItem.productId.regularPrice,
        totalPrice: (existingItem.productId.salePrice || existingItem.productId.regularPrice) * quantity,
        availableStock: existingItem.productId.quantity
      }
    });
  } catch (error) {
    console.error("update quantity error", error);
    return res
      .status(500)
      .json({ success: false, message: "Something went wrong" });
  }
};

const getCartStatus = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productIds } = req.body; // <-- important to get from body

    if (!userId) {
      return res.status(200).json({ success: true, cartStatus: {} });
    }

    if (!productIds || !Array.isArray(productIds)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid product IDs" });
    }

    const cartItems = await Cart.findOne({ userId });

    const cartStatus = {};
    if (cartItems?.items?.length > 0) {
      cartItems.items.forEach((item) => {
        if (productIds.includes(item.productId.toString())) {
          cartStatus[item.productId.toString()] = true;
        }
      });
    }

    res.status(200).json({ success: true, cartStatus });
  } catch (error) {
    console.error("Cart status error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

module.exports = {
  getCart,
  addToCart,
  removeCart,
  updateQuantity,
  getCartStatus,
};
