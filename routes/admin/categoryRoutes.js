const express = require('express')
const categoryController = require('../../controller/admin/categoryController')
const { adminAuth } = require('../../middlewares/auth');
const router = express.Router()

router.get('/categories', adminAuth, categoryController.categoryInfo);
router.post('/categories/add', adminAuth, categoryController.addCategory);
router.put('/categories/edit/:id',adminAuth,categoryController.editCategory)
router.post('/categories/:id/offer',adminAuth,categoryController.addCategoryOffer)
router.delete('/categories/:id/offer',adminAuth,categoryController.removeCategoryOffer)
router.patch('/categories/:id/status', adminAuth, categoryController.updateCategoryStatus)
module.exports = router