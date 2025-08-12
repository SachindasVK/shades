const express = require('express');
const adminController = require('../../controller/admin/adminController');
const { adminAuth } = require('../../middlewares/auth');
const router = express.Router();

router.get('/login', adminController.loadLogin);
router.post('/login', adminController.login);
router.get('/logout', adminAuth, adminController.logout);
// Error management
router.get('/error', adminController.error);

module.exports = router;
