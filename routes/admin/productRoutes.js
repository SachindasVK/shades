const express = require('express')
const productController = require('../../controller/admin/productController')
const { adminAuth } = require('../../middlewares/auth')
const multer = require("multer");
const upload = multer();
const router = express.Router()



// product managenmt
router.get('/products', adminAuth, productController.getAllProducts)
router.post('/products/:id/offer', adminAuth, productController.addProductOffer)
router.put('/update-quantity/:id', adminAuth, productController.updateProductQuantity)
router.delete('/products/:id/offer', adminAuth, productController.removeProductOffer)
router.patch('/products/:id/status', adminAuth, productController.updateProductStatus)
router.get('/productEdit/:id', adminAuth, productController.getEditProduct);
router.post('/editProduct/:id', adminAuth, upload.fields([
    { name: 'image1', maxCount: 1 },
    { name: 'image2', maxCount: 1 },
    { name: 'image3', maxCount: 1 },
    { name: 'image4', maxCount: 1 }
]), productController.editProduct);


// add product management
router.get("/addProducts", adminAuth, productController.getProductsAddPage);
router.post("/saveImage", adminAuth, upload.single('image'), productController.saveImage);
router.post("/addProducts", adminAuth, upload.fields([
    { name: 'image1', maxCount: 1 },
    { name: 'image2', maxCount: 1 },
    { name: 'image3', maxCount: 1 },
    { name: 'image4', maxCount: 1 }
]), productController.addProducts);

router.get('/product-details/:id',adminAuth,productController.loadProductDetails)

module.exports = router