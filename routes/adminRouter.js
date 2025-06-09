const express = require('express');
const router = express.Router();
const adminController = require('../controller/admin/adminController');
const customerController = require('../controller/admin/customerController');
const categoryController = require('../controller/admin/categoryController');
const productController = require('../controller/admin/productController');
const brandController = require('../controller/admin/brandController')
const bannerController = require('../controller/admin/bannerController')
const couponController = require('../controller/admin/couponController')
const orderController = require('../controller/admin/orderController')
const { adminAuth } = require('../middlewares/auth');
const multer = require("multer");
const { brandUpload } = require('../helpers/multer');
const upload = multer();

// Error management
router.get('/error', adminController.error);

// General admin
router.get('/login', adminController.loadLogin);
router.post('/login', adminController.login);
router.get('/dashboard', adminAuth, adminController.loadDashboard);
router.get('/logout', adminController.logout);

// Customer management
router.get('/customers', adminAuth, customerController.customerInfo);
router.get('/customers/view/:id', adminAuth, customerController.viewCustomer);
router.get('/customers/block/:id', adminAuth, customerController.blockUser);
router.get('/customers/unblock/:id', adminAuth, customerController.unblockUser);

// Category management
router.get('/categories', adminAuth, categoryController.categoryInfo);
router.post('/categories', adminAuth, categoryController.addCategory);
router.post('/categories/:id/offer',adminAuth,categoryController.addCategoryOffer)
router.delete('/categories/:id/offer',adminAuth,categoryController.removeCategoryOffer)
router.patch('/categories/:id/status', adminAuth, categoryController.updateCategoryStatus)
router.put('/categories/:id',adminAuth,categoryController.editCategory)

// brand management
router.get('/brands',adminAuth,brandController.getBrand)
router.post('/brands', adminAuth, brandUpload.single('logo'), brandController.addBrand);
router.put('/brands/:id', adminAuth, brandUpload.single('logo'), brandController.editBrand);
router.patch('/brands/:id/status',adminAuth,brandController.updateBrandStatus)


// add product management
router.get("/addProducts", adminAuth, productController.getProductsAddPage);
router.post("/saveImage", adminAuth, upload.single('image'), productController.saveImage);
router.post("/addProducts", adminAuth, upload.fields([
    { name: 'image1', maxCount: 1 },
    { name: 'image2', maxCount: 1 },
    { name: 'image3', maxCount: 1 },
    { name: 'image4', maxCount: 1 }
]), productController.addProducts);

// product managenmt
router.get('/products',adminAuth,productController.getAllProducts)
router.post('/products/:id/offer',adminAuth,productController.addProductOffer)
router.delete('/products/:id/offer',adminAuth,productController.removeProductOffer)
router.patch('/products/:id/status',adminAuth,productController.updateProductStatus)
router.get('/productEdit/:id', adminAuth, productController.getEditProduct);
router.post('/editProduct/:id', adminAuth, upload.fields([
    { name: 'image1', maxCount: 1 },
    { name: 'image2', maxCount: 1 },
    { name: 'image3', maxCount: 1 },
    { name: 'image4', maxCount: 1 }
]), productController.editProduct);


//banner management
router.get('/banners',adminAuth,bannerController.getBannerpage)

//coupen management
router.get('/coupons',adminAuth,couponController.getCoupon)
router.post('/coupons',adminAuth,couponController.createCoupon)
router.put('/coupons/:id', adminAuth, couponController.updateCoupon)
router.patch('/coupons/:id/status', adminAuth, couponController.toggleCouponStatus)
router.delete('/coupons/:id', adminAuth, couponController.deleteCoupon)
router.get('/coupons/:id', adminAuth, couponController.getCouponById)

//order management
router.get('/orders',adminAuth,orderController.viewAllOrders)
router.patch('/orders/:orderId/status', adminAuth,orderController.updateOrderStatus);
router.patch('/orders/:orderId/verify-return',adminAuth,orderController.verifyReturn);
module.exports = router;