const Brand = require('../../models/brandSchema');
const Product = require('../../models/productSchema');
const path = require('path');
const fs = require('fs');

// Utility function to escape special characters in regex
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

        // Sort by createdAt in descending order (-1) to get newest brands first
        const brandData = await Brand.find(filter)
            .sort({ createdAt: -1 })  // newest brands first
            .skip(skip)
            .limit(limit);
        

        const totalBrands = await Brand.countDocuments(filter);
        const totalPages = Math.ceil(totalBrands / limit);

        // Remove this line - no need to reverse the already sorted data
        // const reverseBrand = brandData.reverse();

        res.render('brand', {
            pageTitle: 'Brand Management',
            data: brandData,  // Pass the correctly sorted data directly
            currentPage: page,
            totalPages: totalPages,
            totalItems: totalBrands,
            searchTerm: searchTerm,
            limit: limit
        });
    } catch (error) {
        console.error('Error in Brand management:', error.message, error.stack);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};

const addBrand = async (req, res) => {
    try {
        const { name, description } = req.body;
        
        // Debug log to check if file is attached
        console.log('Received file:', req.file);
        
        const logo = req.file ? req.file.filename : null;

        if (!name) {
            return res.status(400).json({ success: false, message: 'Brand name is required' });
        }

        // Escape the brand name to avoid regex issues
        const escapedName = escapeRegex(name);
        const existingBrand = await Brand.findOne({ name: { $regex: new RegExp(`^${escapedName}$`, 'i') } });
        
        if (existingBrand) {
            return res.status(400).json({ success: false, message: 'Brand already exists' });
        }

        const brand = new Brand({
            name,
            description,
            logo,
        });

        await brand.save();
        res.json({ success: true, message: 'Brand added successfully' });
    } catch (error) {
        console.error('Error adding brand:', error.message, error.stack);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};

const editBrand = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;
        const logo = req.file ? req.file.filename : null;

        if (!name) {
            return res.status(400).json({ success: false, message: 'Brand name is required' });
        }

        const brand = await Brand.findById(id);
        if (!brand) {
            return res.status(404).json({ success: false, message: 'Brand not found' });
        }

        // Escape the brand name to avoid regex issues
        const escapedName = escapeRegex(name);
        const existingBrand = await Brand.findOne({ 
            name: { $regex: new RegExp(`^${escapedName}$`, 'i') },
            _id: { $ne: id }
        });
        
        if (existingBrand) {
            return res.status(400).json({ success: false, message: 'Brand name already exists' });
        }

        if (logo && brand.logo) {
            const oldLogoPath = path.join(__dirname, '../../public/Uploads/brands', brand.logo);
            if (fs.existsSync(oldLogoPath)) {
                fs.unlinkSync(oldLogoPath);
            }
        }

        brand.name = name;
        brand.description = description;
        if (logo) brand.logo = logo;

        await brand.save();
        res.json({ success: true, message: 'Brand updated successfully' });
    } catch (error) {
        console.error('Error editing brand:', error.message, error.stack);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};


// DELETE AND RECOVER 
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
    console.log('Update Result:', result);

    if (result.modifiedCount === 0) {
      return res.status(404).json({ success: false, message: 'Category not found or already in desired state' });
    }

    res.json({ success: true, message: `Category ${action}d successfully!` });
  } catch (error) {
    console.error('Update Status Error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};


module.exports = {
    getBrand,
    addBrand,
    editBrand,
    updateBrandStatus
};