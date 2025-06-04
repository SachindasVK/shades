const User = require('../../models/userSchema')
const Product = require('../../models/productSchema')

const loadWishlist = async (req, res) => {
    try {
        const userId = req.session.user;
        
        if (!userId) {
            return res.redirect('/login');
        }

        // Populate user with wishlist products
        const user = await User.findById(userId).populate({
            path: 'wishlist',
            populate: {
                path: 'category'
            }
        });

        if (!user) {
            return res.redirect('/login');
        }

        res.render('wishlist', {
            user: user, // Pass the entire user object
            username: user.name,
            wishlistCount: user.wishlist.length
        });

    } catch (error) {
        console.error('Error in loadWishlist:', error);
        res.redirect('/pageNotFound');
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
                message: 'Please login to add items to wishlist'
            });
        }

        // Validate productId
        if (!productId) {
            return res.status(400).json({
                success: false,
                message: 'Product ID is required'
            });
        }

        // Check if product exists
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Find the user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if product is already in wishlist
        const productIndex = user.wishlist.findIndex(item => item.toString() === productId);
        let added = false;

        if (productIndex > -1) {
            // Remove from wishlist if already exists
            user.wishlist.splice(productIndex, 1);
            added = false;
        } else {
            // Add to wishlist if not exists
            user.wishlist.push(productId);
            added = true;
        }

        // Save the updated user
        await user.save();

        // Return success response
        res.status(200).json({
            success: true,
            added: added,
            message: added ? 'Product added to wishlist' : 'Product removed from wishlist',
            wishlistCount: user.wishlist.length
        });

    } catch (error) {
        console.error('Error in addToWishlist:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const getWishlistCount = async (req, res) => {
    try {
        const userId = req.session.user;

        if (!userId) {
            return res.status(200).json({
                success: true,
                count: 0
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(200).json({
                success: true,
                count: 0
            });
        }

        res.status(200).json({
            success: true,
            count: user.wishlist.length
        });

    } catch (error) {
        console.error('Error in getWishlistCount:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Fixed removeFromWishlist to handle both URL params and request body
const removeFromWishlist = async (req, res) => {
    try {
        const userId = req.session.user;
        // Get productId from URL params or request body
        const productId = req.params.id || req.body.productId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Please login to manage wishlist'
            });
        }

        if (!productId) {
            return res.status(400).json({
                success: false,
                message: 'Product ID is required'
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Remove product from wishlist
        const initialLength = user.wishlist.length;
        user.wishlist = user.wishlist.filter(id => id.toString() !== productId);
        
        // Check if item was actually removed
        if (user.wishlist.length === initialLength) {
            return res.status(404).json({
                success: false,
                message: 'Item not found in wishlist'
            });
        }

        await user.save();

        res.status(200).json({
            success: true,
            message: 'Product removed from wishlist',
            wishlistCount: user.wishlist.length
        });

    } catch (error) {
        console.error('Error in removeFromWishlist:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};



module.exports = {
    loadWishlist,
    addToWishlist,
    getWishlistCount,
    removeFromWishlist,
}