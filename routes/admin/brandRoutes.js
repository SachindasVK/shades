const express = require('express')
const brandController = require('../../controller/admin/brandController')
const { adminAuth } = require('../../middlewares/auth');
const { brandUpload } = require('../../helpers/multer');
const router = express.Router()


// brand management
router.get('/brands',adminAuth,brandController.getBrand)
router.post('/brands', adminAuth, brandUpload.single('logo'), brandController.addBrand);
router.put('/brands/:id', adminAuth, brandUpload.single('logo'), brandController.editBrand);
router.patch('/brands/:id/status',adminAuth,brandController.updateBrandStatus)

module.exports = router