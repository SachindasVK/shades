const express = require('express')
const brandController = require('../../controller/admin/brandController')
const { adminAuth } = require('../../middlewares/auth');
const router = express.Router()


// brand management
router.get('/brands', adminAuth, brandController.getBrand)
router.post('/brand/add', adminAuth,  brandController.addBrand);
router.put('/brand/edit/:id', adminAuth, brandController.editBrand);
router.patch('/brands/:id/status', adminAuth, brandController.updateBrandStatus)

module.exports = router