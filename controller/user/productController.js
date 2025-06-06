const Product = require('../../models/productSchema')
const Category = require('../../models/categorySchema')
const User = require('../../models/userSchema')
const { log } = require('console')


const productDetails = async(req,res)=>{
    try {
        const userId = req.session.user
        const userData = await User.findById(userId)
        const productId = req.query.id
        const product = await Product.findById(productId).populate('category')
        const findCategory = product.category
        const categoryOffer = findCategory ?.categoryOffer||0
        const productOffer = product.productOffer||0
        const totalOffer = categoryOffer + productOffer
         if (!product) {
            return res.redirect('/shop'); // or show 404
        }

          const recommendations = await Product.find({
            isDeleted: false,
            category: product.category,
            _id: { $ne: productId } // exclude the current product
        })

         if (userData?.isBlocked) {
    req.session.destroy(err => {
      if (err) console.log('Session destroy error:', err);
      return res.redirect('/login');
    });
    return;
  }        
        res.render('productDetails',{
            isLoggedIn: req.session.user,
      user: userData,
      username: userData ? userData.name : null,
            product:product,
            quantity:product.quantity,
            totalOffer:totalOffer,
            category:findCategory,
            recommendations 
        })
    } catch (error) {
        console.error('error for fetching product details',error)
        res.redirect('/pageNotFound')
    }
}


module.exports = {
    productDetails
}