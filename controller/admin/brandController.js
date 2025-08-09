const Brand = require('../../models/brandSchema');
const path = require('path');
const logger = require('../../helpers/logger')

function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

const getBrand = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 3;
        const skip = (page - 1) * limit;
        const searchTerm = req.query.search || "";
        let filter = {};
        if (searchTerm) {
            filter.name = { $regex: new RegExp(searchTerm, 'i') };
        }


        const brandData = await Brand.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);


        const totalBrands = await Brand.countDocuments(filter);
        const totalPages = Math.ceil(totalBrands / limit);

        res.render('brand', {
            pageTitle: 'Brand Management',
            data: brandData,
            currentPage: page,
            totalPages: totalPages,
            totalItems: totalBrands,
            searchTerm: searchTerm,
            limit: limit
        });
    } catch (error) {
        logger.error('Error in Brand management:', error.message);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};

const addBrand = async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) {
            return res.status(400).json({ success: false, message: 'Brand name is required' });
        }

        const escapedName = escapeRegex(name);
        const existingBrand = await Brand.findOne({ name: { $regex: new RegExp(`^${escapedName}$`, 'i') } });

        if (existingBrand) {
            return res.status(400).json({ success: false, message: 'Brand already exists' });
        }

        const brand = new Brand({
            name,
            description,
        });

        await brand.save();
        res.json({ success: true, message: 'Brand added successfully' });
    } catch (error) {
        logger.error('Error adding brand:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error });
    }
};

const editBrand = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, message: 'Brand name is required' });
        }

        const brand = await Brand.findById(id);
        if (!brand) {
            return res.status(404).json({ success: false, message: 'Brand not found' });
        }
        const escapedName = escapeRegex(name);
        const existingBrand = await Brand.findOne({
            name: { $regex: new RegExp(`^${escapedName}$`, 'i') },
            _id: { $ne: id }
        });

        if (existingBrand) {
            return res.status(400).json({ success: false, message: 'Brand name already exists' });
        }



        brand.name = name;
        brand.description = description;
        await brand.save();
        res.json({ success: true, message: 'Brand updated successfully' });
    } catch (error) {
        logger.error('Error editing brand:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error });
    }
};



const updateBrandStatus = async (req, res) => {
    try {
        const id = req.params.id;
        const { action } = req.body;

        let updateData = {};
        const brand = await Brand.findById(id);
        if (!brand) {
            return res.status(404).json({ success: false, message: 'Brand not found' });
        }
        if (action === 'delete') {
            updateData = {
                isDeleted: true,
                deletedAt: new Date(),
                isActive: false,
                status: 'Unavailable'
            };
        } else if (action === 'recover') {
            updateData = {
                isDeleted: false,
                deletedAt: null,
                isActive: true,
                status: 'available'
            };
        } else {
            return res.status(400).json({ success: false, message: 'Invalid action' });
        }
        const result = await Brand.updateOne({ _id: id }, { $set: updateData });
        logger.info(`Update Result: ${result}`);

        if (result.modifiedCount === 0) {
            return res.status(404).json({ success: false, message: 'Category not found or already in desired state' });
        }

        res.json({ success: true, message: `Category ${action}d successfully!` });
    } catch (error) {
        logger.error('Update Status Error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};


module.exports = {
    getBrand,
    addBrand,
    editBrand,
    updateBrandStatus
};