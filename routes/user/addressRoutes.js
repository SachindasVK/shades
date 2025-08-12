const express = require('express');
const addressController = require('../../controller/user/addressController');
const { userAuth } = require('../../middlewares/auth');
const router = express.Router();

//address management
router.get('/address', userAuth, addressController.getAddress);
router.post('/address/add', userAuth, addressController.addAddress);
router.put('/address/update/:id', userAuth, addressController.updateAddress);
router.delete('/address/delete/:id', userAuth, addressController.deleteAddress);

module.exports = router;
