const Address = require('../../models/addressSchema');
const User = require('../../models/userSchema');
const logger = require('../../helpers/logger');

const getAddress = async (req, res) => {
  try {
    const userId = req.session.user || req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.redirect('/login');
    }

    const addressDoc = await Address.findOne({ userId: userId });

    let addresses = [];

    if (addressDoc && addressDoc.address && addressDoc.address.length > 0) {
      addresses = addressDoc.address
        .map((addr) => ({
          _id: addr._id,
          fullName: addr.name,
          phone: addr.phone,
          flat: addr.flat,
          area: addr.area || '',
          city: addr.city,
          state: addr.state,
          pincode: addr.pincode,
          landmark: addr.landMark || '',
          addressType: addr.addressType,
          isDefault: addr.isDefault || false,
        }))
        .reverse();
    }

    user.addresses = addresses;

    res.render('address', {
      user: user,
      username: user.name,
      title: 'Manage Addresses',
    });
  } catch (error) {
    logger.error('Get address error:', error);
    return res.status(500).render('page-404');
  }
};

const addAddress = async (req, res) => {
  try {
    const userId = req.session.user;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }
    const { fullName, phone, flat, area, pincode, landmark, city, state, addressType, isDefault } =
      req.body;

    if (!fullName || !phone || !flat || !area || !pincode || !city || !state || !addressType) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be filled',
      });
    }

    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Phone number must be 10 digits',
      });
    }

    if (!/^[6-9]\d{9}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'please enter a valid phone number',
      });
    }

    if (!/^\d{6}$/.test(pincode)) {
      return res.status(400).json({
        success: false,
        message: 'Pincode must be 6 digits',
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const newAddress = {
      name: fullName.trim(),
      phone: phone.trim(),
      flat: flat.trim(),
      area: area.trim(),
      pincode: parseInt(pincode),
      landMark: landmark ? landmark.trim() : '',
      city: city.trim(),
      state: state,
      addressType: addressType,
      isDefault: isDefault || false,
      country: 'India',
      email: user.email,
    };

    let addressDoc = await Address.findOne({ userId });

    if (addressDoc && Array.isArray(addressDoc.address)) {
      const isDuplicate = addressDoc.address.some((addr) => {
        return (
          addr.name === newAddress.name &&
          addr.phone === newAddress.phone &&
          addr.area === newAddress.area &&
          addr.flat === newAddress.flat &&
          addr.pincode === newAddress.pincode &&
          addr.landMark === newAddress.landMark &&
          addr.city === newAddress.city &&
          addr.state === newAddress.state &&
          addr.country === newAddress.country &&
          addr.email === newAddress.email
        );
      });

      if (isDuplicate) {
        return res.status(400).json({
          success: false,
          message: 'This address already exists, please choose another address',
        });
      }
    }

    if (!addressDoc) {
      addressDoc = new Address({
        userId,
        address: [newAddress],
      });

      addressDoc.address[0].isDefault = true;
    } else {
      if (isDefault) {
        addressDoc.address.forEach((addr) => {
          addr.isDefault = false;
        });
      }

      const hasDefault = addressDoc.address.some((addr) => addr.isDefault);
      if (!hasDefault) {
        newAddress.isDefault = true;
      }

      addressDoc.address.push(newAddress);
    }

    await addressDoc.save();

    res.json({
      success: true,
      message: 'Address added successfully',
      address: newAddress,
    });
  } catch (error) {
    logger.error('Error adding address:', error);
    return res.status(500).render('page-404');
  }
};

const updateAddress = async (req, res) => {
  try {
    const userId = req.session.user || req.user.id;
    const addressId = req.params.id;
    const { fullName, phone, flat, area, pincode, landmark, city, state, addressType, isDefault } =
      req.body;

    if (!fullName || !phone || !flat || !area || !pincode || !city || !state || !addressType) {
      return res.status(400).json({
        success: false,
        message: 'Please fill in all required fields',
      });
    }

    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Phone number must be 10 digits',
      });
    }

    if (!/^[6-9]\d{9}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'please enter a valid phone number',
      });
    }

    if (!/^\d{6}$/.test(pincode)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 6-digit PIN code',
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const addressDoc = await Address.findOne({ userId: userId });
    if (!addressDoc) {
      return res.status(404).json({
        success: false,
        message: 'Address not found',
      });
    }

    const addressIndex = addressDoc.address.findIndex((addr) => addr._id.toString() === addressId);
    if (addressIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Address not found',
      });
    }

    if (isDefault) {
      addressDoc.address.forEach((addr, index) => {
        if (index !== addressIndex) {
          addr.isDefault = false;
        }
      });
    }

    const addrToUpdate = addressDoc.address[addressIndex];

    addrToUpdate.name = fullName.trim();
    addrToUpdate.phone = phone.trim();
    addrToUpdate.flat = flat.trim();
    addrToUpdate.area = area.trim();
    addrToUpdate.pincode = parseInt(pincode);
    addrToUpdate.city = city.trim();
    addrToUpdate.state = state.trim();
    addrToUpdate.addressType = addressType;
    addrToUpdate.landMark = landmark ? landmark.trim() : '';
    addrToUpdate.country = 'India';
    addrToUpdate.isDefault = Boolean(isDefault);
    addrToUpdate.email = user.email;
    addrToUpdate.altPhone = addrToUpdate.altPhone || '';

    await addressDoc.save();

    res.status(200).json({
      success: true,
      message: 'Address updated successfully',
    });
  } catch (error) {
    logger.error('Update address error:', error);
    return res.status(500).render('page-404');
  }
};

const deleteAddress = async (req, res) => {
  try {
    const userId = req.session.user || req.user.id;
    const addressId = req.params.id;

    const addressDoc = await Address.findOne({ userId: userId });
    if (!addressDoc) {
      return res.status(404).json({
        success: false,
        message: 'Address not found',
      });
    }

    const addressIndex = addressDoc.address.findIndex((addr) => addr._id.toString() === addressId);
    if (addressIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Address not found',
      });
    }
    const isDefaultAddress = addressDoc.address[addressIndex].isDefault;
    addressDoc.address.splice(addressIndex, 1);
    if (isDefaultAddress && addressDoc.address.length > 0) {
      addressDoc.address[0].isDefault = true;
    }

    await addressDoc.save();

    res.status(200).json({
      success: true,
      message: 'Address deleted successfully',
    });
  } catch (error) {
    logger.error('Delete address error:', error);
    return res.status(500).render('page-404');
  }
};
module.exports = {
  getAddress,
  addAddress,
  updateAddress,
  deleteAddress,
};
