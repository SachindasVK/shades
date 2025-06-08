const Address = require('../../models/addressSchema')
const User = require('../../models/userSchema')


const getAddress = async (req, res) => {
    try {
        const userId = req.session.user || req.user.id;
        const user = await User.findById(userId)

        if (!user) {
            return res.redirect('/login')
        }

        const addressDoc = await Address.findOne({ userId: userId })


        let addresses = [];

        if (addressDoc && addressDoc.address && addressDoc.address.length > 0) {
            addresses = addressDoc.address.map(addr => ({
                _id: addr._id,
                fullName: addr.name,
                phone: addr.phone,
                flat: addr.streetAddress,
                area: addr.landMark || '', // Use landMark as area fallback
                city: addr.city,
                state: addr.state,
                pincode: addr.pincode,
                landmark: addr.landMark || '',
                addressType: addr.addressType,
                isDefault: addr.isDefault || false
            })).reverse()
        }

        user.addresses = addresses

        res.render('address', {
            user: user,
            username: user.name,
            title: 'Manage Addresses'
        })
    } catch (error) {
        console.error('Get address error:', error);
        res.redirect('/pageNotFound')
    }
}




const addAddress = async (req, res) => {
    try {
        const userId = req.session.user;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        const {
            fullName,
            phone,
            flat,
            area,
            pincode,
            landmark,
            city,
            state,
            addressType,
            isDefault
        } = req.body;

        // Validate required fields
        if (!fullName || !phone || !flat || !area || !pincode || !city || !state || !addressType) {
            return res.status(400).json({
                success: false,
                message: 'All required fields must be filled'
            });
        }

        // Validate phone number (10 digits)
        if (!/^\d{10}$/.test(phone)) {
            return res.status(400).json({
                success: false,
                message: 'Phone number must be 10 digits'
            });
        }

        // Validate pincode (6 digits)
        if (!/^\d{6}$/.test(pincode)) {
            return res.status(400).json({
                success: false,
                message: 'Pincode must be 6 digits'
            });
        }

        // Get user email for the address
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const newAddress = {
            name: fullName.trim(),
            phone: phone.trim(),
            streetAddress: flat.trim(),
            area: area.trim(),
            pincode: parseInt(pincode),
            landMark: landmark ? landmark.trim() : '',
            city: city.trim(),
            state: state,
            addressType: addressType,
            isDefault: isDefault || false,
            country: 'India', // Default to India
            email: user.email
        };

        let addressDoc = await Address.findOne({ userId });

        if (!addressDoc) {
            // Create new address document if none exists
            addressDoc = new Address({
                userId,
                address: [newAddress]
            });

            // If this is the first address, make it default
            addressDoc.address[0].isDefault = true;
        } else {
            // If setting as default, remove default from other addresses
            if (isDefault) {
                addressDoc.address.forEach(addr => {
                    addr.isDefault = false;
                });
            }

            // If no default exists and this is being added, make it default
            const hasDefault = addressDoc.address.some(addr => addr.isDefault);
            if (!hasDefault) {
                newAddress.isDefault = true;
            }

            addressDoc.address.push(newAddress);
        }

        await addressDoc.save();

        res.json({
            success: true,
            message: 'Address added successfully',
            address: newAddress
        });

    } catch (error) {
        console.error('Error adding address:', error);
        res.status(500).json({
            success: false,
            message: 'Server error occurred while adding address'
        });
    }
}


const updateAddress = async (req, res) => {
    try {
        const userId = req.session.user || req.user.id;
        const addressId = req.params.id;
        const {
            fullName,
            phone,
            flat,
            area,
            pincode,
            landmark,
            city,
            state,
            addressType,
            isDefault
        } = req.body;

        // Validation
        if (!fullName || !phone || !flat || !area || !pincode || !city || !state || !addressType) {
            return res.status(400).json({
                success: false,
                message: 'Please fill in all required fields'
            });
        }

        // Validate phone number (10 digits)
        if (!/^\d{10}$/.test(phone)) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid 10-digit mobile number'
            });
        }

        // Validate pincode (6 digits)
        if (!/^\d{6}$/.test(pincode)) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid 6-digit PIN code'
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Find the address document
        const addressDoc = await Address.findOne({ userId: userId });
        if (!addressDoc) {
            return res.status(404).json({
                success: false,
                message: 'Address not found'
            });
        }

        // Find the specific address to update
        const addressIndex = addressDoc.address.findIndex(addr => addr._id.toString() === addressId);
        if (addressIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Address not found'
            });
        }

        // If this address is being set as default, unset others
        if (isDefault) {
            addressDoc.address.forEach((addr, index) => {
                if (index !== addressIndex) {
                    addr.isDefault = false;
                }
            });
        }

        // Update the address
        // ✅ Better: Update field by field (no replacement)
        const addrToUpdate = addressDoc.address[addressIndex];

        addrToUpdate.name = fullName.trim();
        addrToUpdate.phone = phone.trim();
        addrToUpdate.streetAddress = flat.trim();
        addrToUpdate.area = area.trim(); // ✅ Required field - this was missing!
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
            message: 'Address updated successfully'
        });

    } catch (error) {
        console.error('Update address error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update address. Please try again.'
        });
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
                message: 'Address not found'
            });
        }

        const addressIndex = addressDoc.address.findIndex(addr => addr._id.toString() === addressId);
        if (addressIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Address not found'
            });
        }

        // Check if we're deleting the default address
        const isDefaultAddress = addressDoc.address[addressIndex].isDefault;

        // Remove the address
        addressDoc.address.splice(addressIndex, 1);

        // If we deleted the default address and there are other addresses, make the first one default
        if (isDefaultAddress && addressDoc.address.length > 0) {
            addressDoc.address[0].isDefault = true;
        }

        await addressDoc.save();

        res.status(200).json({
            success: true,
            message: 'Address deleted successfully'
        });

    } catch (error) {
        console.error('Delete address error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete address. Please try again.'
        });
    }
};
module.exports = {
    getAddress,
    addAddress,
    updateAddress,
    deleteAddress
}