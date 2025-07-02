const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema')

const categoryInfo = async (req, res) => {
    try {
        // Get search term from query parameters
        const searchTerm = req.query.search || '';
        
        // Access page
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page - 1) * limit;
        let filter = {}
        if (searchTerm) {
            filter.name = { $regex: new RegExp(searchTerm, 'i') };
        }
        
        // Access categories from database with optional search filter
        const categoryData = await Category.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        
        const totalCategories = await Category.countDocuments()
        const totalPages = Math.ceil(totalCategories / limit);
        
        res.render('category', {
            pageTitle: 'Category Management',
            category: categoryData,
            currentPage: page,
            totalPages: totalPages,
            limit: limit,
            totalItems: totalCategories,
            searchTerm: searchTerm
        });
    } catch (error) {
        console.error('Error in Category management:', error);
        res.redirect('/admin/error')
    }
};






// Add Category
const addCategory = async (req, res) => {
    try {
        const { name, shape, description } = req.body;
       
         //name validation
    const trimmedName = name.trim()
    const trimmedShape = shape.trim()
    if (!trimmedName || trimmedName.length === 0) {
      console.log("Invalid input: name is empty or contains only whitespace")
      return res.status(400).json({
         success: false,
         message: "Category name cannot be empty"
         })
    }

     if (!trimmedShape || trimmedShape.length === 0) {
      console.log("Invalid input: shape Field is empty or contains only whitespace")
      return res.status(400).json({
         success: false,
         message: "Category shape cannot be empty"
         })
    }
      // Check if category with the same name already exists
    const existingCategory = await Category.findOne({ name: new RegExp(`^${trimmedName}$`, "i") })
     if (existingCategory) {
      console.log("Category already exists:", trimmedName)
      return res.status(400).json({ 
        success: false, 
        message: "Category with this name already exists"
     })
    }

    if (!description) {
      console.log("Invalid input: description is missing")
      return res.status(400).json({ 
        success: false,
        message: "Description is required" 
    })
    }

        
   
        
        // Create new category
        const newCategory = new Category({ 
            name: trimmedName, 
            shape,
            description
        })
        const savedCategory = await newCategory.save()
        console.log("New category added:", savedCategory)
        
        return res.status(201).json({
            success: true,
            message: 'Category added successfully',
            category: savedCategory 
        });
    } catch (error) {
        console.error('Error adding category:', error);
        return res.status(500).json({
            success: false,
            message: "Failed to add category", error: error.message
        });
    }
};





// Add Category Offer
const addCategoryOffer = async (req, res) => {
  try {
    const categoryId = req.params.id;
    const { offerStartDate, offerEndDate, offerPercentage } = req.body;

    if (!categoryId || !offerStartDate || !offerEndDate || offerPercentage === undefined) {
      return res.json({ success: false, message: "All offer details are required" });
    }

    const percentage = parseFloat(offerPercentage);
    if (isNaN(percentage) || percentage < 1 || percentage > 99) {
      return res.json({ success: false, message: "Offer percentage must be between 1 and 99" });
    }

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    // Update category offer
    category.hasOffer = true;
    category.offerPercentage = percentage;
    category.offerStartDate = new Date(offerStartDate);
    category.offerEndDate = new Date(offerEndDate);
    await category.save();

    const products = await Product.find({ category: categoryId });

    const now = new Date();
    const isCategoryOfferActive =
      category.hasOffer &&
      category.offerStartDate <= now &&
      category.offerEndDate >= now;

    for (let product of products) {
      const productOffer = product.productOffer || 0;

      const maxOffer = isCategoryOfferActive
        ? Math.max(productOffer, percentage)
        : productOffer;

      const discount = (product.regularPrice * maxOffer) / 100;

      product.salePrice = product.regularPrice - discount;

      await product.save();
    }

    return res.json({ success: true, message: "Category offer applied successfully" });
  } catch (error) {
    console.error("Error in addCategoryOffer:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};


// Remove Category Offer
const removeCategoryOffer = async (req, res) => {
  try {
    const categoryId = req.params.id;
    
    // Validate input
    if (!categoryId) {
      return res.json({ success: false, message: "Category ID is required" });
    }
    
    // Find category
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    const percentage = category.offerPercentage;
    const products = await Product.find({category:category._id})

    if(products.length > 0){
        for(const product of products){
            product.salePrice = product.regularPrice;
            product.productOffer = 0

            await product.save()
        }
    }
    
    // Remove offer
    await Category.updateOne(
      { _id: categoryId }, 
      { 
        $set: { 
          hasOffer: false,
          offerPercentage: 0,
          offerStartDate: null,
          offerEndDate: null
        } 
      }
    );
    console.log('Offer removed',category)
    return res.json({ success: true, message: "Offer removed successfully" });
  } catch (error) {
    console.error("Error in removeCategoryOffer:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// DELETE AND RECOVER 
const updateCategoryStatus = async (req, res) => {
  try {
    const id = req.params.id;
    const { action } = req.body;

    let updateData = {};
    const category = await Category.findById(id);
    if (!category) {
    return res.status(404).json({ success: false, message: 'Category not found' });
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
    const result = await Category.updateOne({ _id: id }, { $set: updateData });
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



//edit Category
const editCategory = async (req, res) => {
  try {
    const categoryId = req.params.id
    const { name, description,shape } = req.body
    const updatedCategory = await Category.findByIdAndUpdate(categoryId, { name, description,shape }, { new: true })
    if (!updatedCategory) {
      return res.status(404).json({ success: false, message: "Category not found" })
    }
    res.json({ success: true, message: "Category updated successfully" })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, message: "Failed to update category" })
  }
}

module.exports = {
    categoryInfo,
    addCategory,
    addCategoryOffer,
    removeCategoryOffer,
    updateCategoryStatus,
    editCategory
};