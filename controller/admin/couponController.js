const Coupon = require('../../models/couponSchema')

const getCoupon = async(req,res)=>{
    try {
        const searchTerm = req.query.search || ''
        const page = parseInt(req.query.page)||1
        const limit = 4
        const skip = (page - 1)*limit

        let filter = {};

        if (searchTerm) {
            filter.name = { $regex: new RegExp(searchTerm, 'i') };
        }

        const totalCoupons = await Coupon.countDocuments(filter);

        const coupons = await Coupon.find(filter)
            .sort({ createdOn: -1 })
            .skip(skip)
            .limit(limit);

        const totalPages = Math.ceil(totalCoupons / limit);
        
        return res.render('coupon', {
            pageTitle: 'Coupon Management',
            searchTerm,
            data: coupons,
            currentPage: page,
            totalPages,
            totalItems: totalCoupons,
            limit
        });
    } catch (error) {
        console.error('Get coupons error:', error);
        return res.redirect('/admin/error');
    }
};


const createCoupon = async (req, res) => {
    try {
        console.log('Coupon form submitted:', req.body); 
        const { name, startDate, endDate, offerPrice, minimumPrice } = req.body;

        // Input validation
        if (!name || !startDate || !endDate || !offerPrice || !minimumPrice) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        // Validation: Start date should be before end date
        if (new Date(startDate) > new Date(endDate)) {
            return res.status(400).json({
                success: false,
                message: 'Start date cannot be after end date'
            });
        }

        // Validation: Offer price should be positive
        if (parseFloat(offerPrice) <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Offer price must be greater than 0'
            });
        }

        // Validation: Minimum price should be positive
        if (parseFloat(minimumPrice) <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Minimum price must be greater than 0'
            });
        }

        // Check if coupon with same name already exists (case-insensitive)
        const existingCoupon = await Coupon.findOne({ 
            name: { $regex: new RegExp(`^${name}$`, 'i') }
        });
        
        if (existingCoupon) {
            return res.status(409).json({
                success: false,
                message: 'Coupon with this name already exists'
            });
        }

        // Create new coupon
        const newCoupon = new Coupon({
            name: name.trim(),
            createdOn: new Date(startDate),
            expireOn: new Date(endDate),
            offerPrice: parseFloat(offerPrice),
            minimumPrice: parseFloat(minimumPrice),
            isDeleted: false
        });

        await newCoupon.save();

        return res.status(201).json({
            success: true,
            message: 'Coupon created successfully',
            data: newCoupon
        });
    } catch (error) {
        console.error('Create coupon error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error while creating coupon'
        });
    }
};


const updateCoupon = async (req, res) => {
    try {
        const couponId = req.params.id;
        const { name, startDate, endDate, offerPrice, minimumPrice } = req.body;

        // Input validation
        if (!name || !startDate || !endDate || !offerPrice || !minimumPrice) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        // Validation: Start date should be before end date
        if (new Date(startDate) > new Date(endDate)) {
            return res.status(400).json({
                success: false,
                message: 'Start date cannot be after end date'
            });
        }

        // Validation: Offer price should be positive
        if (parseFloat(offerPrice) <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Offer price must be greater than 0'
            });
        }

        // Validation: Minimum price should be positive
        if (parseFloat(minimumPrice) <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Minimum price must be greater than 0'
            });
        }

        // Check if coupon exists
        const existingCoupon = await Coupon.findById(couponId);
        if (!existingCoupon) {
            return res.status(404).json({
                success: false,
                message: 'Coupon not found'
            });
        }

        // Check if another coupon with same name exists (excluding current coupon)
        const duplicateCoupon = await Coupon.findOne({ 
            _id: { $ne: couponId },
            name: { $regex: new RegExp(`^${name}$`, 'i') }
        });
        
        if (duplicateCoupon) {
            return res.status(409).json({
                success: false,
                message: 'Coupon with this name already exists'
            });
        }

        // Update coupon
        const updatedCoupon = await Coupon.findByIdAndUpdate(
            couponId,
            {
                name: name.trim(),
                createdOn: new Date(startDate),
                expireOn: new Date(endDate),
                offerPrice: parseFloat(offerPrice),
                minimumPrice: parseFloat(minimumPrice)
            },
            { new: true, runValidators: true }
        );

        return res.status(200).json({
            success: true,
            message: 'Coupon updated successfully',
            data: updatedCoupon
        });
    } catch (error) {
        console.error('Update coupon error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error while updating coupon'
        });
    }
};


const toggleCouponStatus = async (req, res) => {
    try {
        const couponId = req.params.id;
        const { action } = req.body;

        // Validate action
        if (!action || !['delete', 'recover'].includes(action)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid action. Use "delete" or "recover"'
            });
        }

        // Check if coupon exists
        const coupon = await Coupon.findById(couponId);
        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: 'Coupon not found'
            });
        }

        // Determine new status
        const newStatus = action === 'delete' ? true : false;
        
        // Check if status is already what we want to set
        if (coupon.isDeleted === newStatus) {
            const statusText = newStatus ? 'deleted' : 'active';
            return res.status(400).json({
                success: false,
                message: `Coupon is already ${statusText}`
            });
        }

        // Update status
        const updatedCoupon = await Coupon.findByIdAndUpdate(
            couponId,
            { isDeleted: newStatus },
            { new: true }
        );

        const actionText = action === 'delete' ? 'deleted' : 'recovered';
        const message = `Coupon "${updatedCoupon.name}" has been ${actionText} successfully`;

        return res.status(200).json({
            success: true,
            message: message,
            data: updatedCoupon
        });
    } catch (error) {
        console.error('Toggle coupon status error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error while updating coupon status'
        });
    }
};


const deleteCoupon = async (req, res) => {
    try {
        const couponId = req.params.id;

        // Check if coupon exists
        const coupon = await Coupon.findById(couponId);
        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: 'Coupon not found'
            });
        }

        // Permanently delete coupon
        await Coupon.findByIdAndDelete(couponId);

        return res.status(200).json({
            success: true,
            message: `Coupon "${coupon.name}" has been permanently deleted`
        });
    } catch (error) {
        console.error('Delete coupon error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error while deleting coupon'
        });
    }
};


const getCouponById = async (req, res) => {
    try {
        const couponId = req.params.id;

        const coupon = await Coupon.findById(couponId);
        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: 'Coupon not found'
            });
        }

        return res.status(200).json({
            success: true,
            data: coupon
        });
    } catch (error) {
        console.error('Get coupon by ID error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error while fetching coupon'
        });
    }
};
module.exports = {
    getCoupon,
    createCoupon,
    updateCoupon,
    toggleCouponStatus,
    deleteCoupon,
    getCouponById

}
