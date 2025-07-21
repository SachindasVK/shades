const Product = require('../../models/productSchema')
const Category = require('../../models/categorySchema')
const mongoose = require('mongoose');
const Brand = require('../../models/brandSchema')
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const getProductsAddPage = async (req, res) => {
  try {

    const shapes = await Category.distinct("shape", {
      shape: { $ne: null },
      isDeleted: false
    });
    const categoryList = await Category.find({ isActive: true })
    const brandList = await Brand.find({ isActive: true })
    res.render('addProducts', {
      pageTitle: 'Add Products',
      category: categoryList,
      brand: brandList,
      shape: shapes
    })
  } catch (error) {
    res.redirect('/admin/error')
  }
}

const addProducts = async (req, res) => {
  try {
    const { productName, description, shape, brand, category, regularPrice, salePrice, quantity, color } = req.body;
    const files = req.files;

    // Log the incoming data for debugging
    console.log("Product submission data:", {
      productName, description, brand, category,
      regularPrice, salePrice, quantity, color, shape,
      fileCount: files ? Object.keys(files).length : 0
    });

    // Validate required fields
    if (!productName || !description || !brand || !category || !regularPrice || !quantity || !color || !shape) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    // Validate that exactly 4 images are uploaded with the correct keys
    const expectedKeys = ["image1", "image2", "image3", "image4"];
    if (!files || Object.keys(files).length !== 4 || !expectedKeys.every(key => files[key] && files[key].length === 1)) {
      return res.status(400).json({ success: false, message: "Please upload exactly 4 images with keys image1, image2, image3, and image4" });
    }

    // Check if product already exists
    const productExists = await Product.findOne({ productName });
    if (productExists) {
      return res.status(400).json({ success: false, message: "Product already exists, try another name" });
    }

    // Ensure upload directory exists
    const uploadDir = path.join(__dirname, "../../public/uploads/product-images");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Process images using Sharp
    const imageFilenames = [];

    // Process each image file
    for (let key of expectedKeys) {
      const file = files[key][0]; // Get the file for each expected key
      const filename = `${Date.now()}-${key}.webp`;
      const filePath = path.join(uploadDir, filename);

      // Resize the image while preserving its aspect ratio
      await sharp(file.buffer)
        .resize({
          width: 1200, // Maximum width
          height: 600, // Maximum height
          fit: "contain", // Preserve aspect ratio, no cropping
          background: { r: 255, g: 255, b: 255, alpha: 1 } // White background for letterboxing
        })
        .webp({ quality: 80 })
        .toFile(filePath);

      imageFilenames.push(`uploads/product-images/${filename}`);
    }

    // Validate all images were processed
    if (imageFilenames.length !== 4) {
      return res.status(400).json({ success: false, message: "Failed to process all 4 product images" });
    }

    // Find category by ID or name
    let categoryId;
    if (category.match(/^[0-9a-fA-F]{24}$/)) {
      // If category is a valid ObjectId
      const foundCategory = await Category.findById(category);
      if (!foundCategory) {
        return res.status(400).json({ success: false, message: "Category not found" });
      }
      categoryId = foundCategory._id;
    } else {
      // Otherwise, find category by name
      const foundCategory = await Category.findOne({ name: category });
      if (!foundCategory) {
        return res.status(400).json({ success: false, message: "Category not found" });
      }
      categoryId = foundCategory._id;
    }

    // Find brand by ID or name
    let brandId;
    if (brand.match(/^[0-9a-fA-F]{24}$/)) {
      // If brand is a valid ObjectId
      const foundBrand = await Brand.findById(brand);
      if (!foundBrand) {
        return res.status(400).json({ success: false, message: "Brand not found" });
      }
      brandId = foundBrand._id;
    } else {
      // Otherwise, find brand by name
      const foundBrand = await Brand.findOne({ name: brand });
      if (!foundBrand) {
        return res.status(400).json({ success: false, message: "Brand not found" });
      }
      brandId = foundBrand._id;
    }

    // Validate numeric fields
    const parsedRegularPrice = parseFloat(regularPrice);
    const parsedSalePrice = parseFloat(salePrice || regularPrice); // Default to regularPrice if not provided
    const parsedQuantity = parseInt(quantity);

    if (isNaN(parsedRegularPrice) || parsedRegularPrice <= 0) {
      return res.status(400).json({ success: false, message: "Regular price must be a positive number" });
    }
    if (isNaN(parsedSalePrice) || parsedSalePrice <= 0) {
      return res.status(400).json({ success: false, message: "Sale price must be a positive number" });
    }
    if (isNaN(parsedQuantity) || parsedQuantity < 0) {
      return res.status(400).json({ success: false, message: "Quantity must be a non-negative integer" });
    }

    // Create and save new product
    const newProduct = new Product({
      productName,
      description,
      brand: brandId,
      category: categoryId,
      regularPrice: parsedRegularPrice,
      salePrice: parsedSalePrice,
      quantity: parsedQuantity,
      color,
      shape,
      productImage: imageFilenames,
      status: "available",
      isActive: true
    });

    console.log("About to save product:", newProduct);
    await newProduct.save();
    console.log("Product saved successfully");

    return res.status(200).json({ success: true, message: "Product added successfully" });
  } catch (error) {
    console.error("Error saving product:", error);
    return res.status(500).json({ success: false, message: "Error saving product: " + error.message });
  }
};


// Keeping this function for backward compatibility with other parts of the app
const saveImage = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: "No image file provided" });
    }

    // Generate unique filename
    const filename = Date.now() + '-' + file.originalname.replace(/\s/g, "");
    const filepath = path.join(__dirname, "../../public/uploads/product-images", filename);

    // Resize & convert to WebP
    await sharp(file.buffer)
      .resize(1200, 600, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(filepath);

    return res.status(200).json({
      success: true,
      message: "Image saved successfully",
      filename: `uploads/product-images/${filename}`
    });
  } catch (error) {
    console.error("Error saving image:", error);
    return res.status(500).json({ success: false, message: "Error saving image" });
  }
};



// get All products
const getAllProducts = async (req, res) => {
  try {
    console.log("Getting all products...");
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 10;

    // Create search query - adjust for your schema
    const searchQuery = {};

    // Add search criteria if provided
    if (search) {
      searchQuery.$or = [
        { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
        { name: { $regex: new RegExp(".*" + search + ".*", "i") } }
      ];
    }

    if (req.query.showAll !== 'true') {
      searchQuery.status = { $ne: "deleted" }; // Assuming "deleted" is a status value
    }

    console.log("Search query:", searchQuery);

    // Fetch products with pagination
    const products = await Product.find(searchQuery)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit)
      .populate("category")
      .populate("brand")
      .exec();

    console.log(`Found ${products.length} products`);

    // Count total matching products
    const totalItems = await Product.countDocuments(searchQuery);

    // Fetch categories and brands for dropdowns
    const categories = await Category.find({ isActive: true });
    const brands = await Brand.find({ isActive: true });

    // Render the products page with data
    res.render("products", {
      products: products,
      totalItems: totalItems,
      currentPage: page,
      totalPages: Math.ceil(totalItems / limit),
      limit: limit,
      searchTerm: search,
      categories: categories,
      brands: brands,
      pageTitle: 'Product Management'
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).render("error", {
      message: "Failed to fetch products",
      error: error.message
    });
  }
};



// Add Category Offer
const addProductOffer = async (req, res) => {
  try {
    const productId = req.params.id;
    const { offerPercentage } = req.body;

    // Validate inputs
    if (!productId) {
      return res.json({ success: false, message: "Product ID is required" });
    }
    if (offerPercentage === undefined) {
      return res.json({ success: false, message: "Offer details required" });
    }

    const percentage = parseFloat(offerPercentage);
    if (isNaN(percentage) || percentage < 1 || percentage > 99) {
      return res.json({ success: false, message: "Offer percentage must be between 1 and 99" });
    }

    const product = await Product.findById(productId).populate('category');
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // Set product offer flags
    product.productOffer = percentage;
    product.offerPercentage = percentage;
    product.hasOffer = true;

    // Check category offer
    const category = product.category;
    const now = new Date();
    let categoryOffer = 0;

    if (
      category?.hasOffer &&
      category.offerStartDate <= now &&
      category.offerEndDate >= now
    ) {
      categoryOffer = category.offerPercentage || 0;
    }

    const maxOffer = Math.max(percentage, categoryOffer);
    const discountAmount = Math.floor((product.regularPrice * maxOffer) / 100);
    product.salePrice = product.regularPrice - discountAmount;

    await product.save();

    return res.json({ success: true, message: "Product offer added successfully" });
  } catch (error) {
    console.error("Error in addProductOffer:", error);
    return res.status(500).render('error', {
      pageTitle: 'Error',
      message: 'Something went wrong while adding product offer'
    });
  }
};


// Remove Product Offer
const removeProductOffer = async (req, res) => {
  try {
    const productId = req.params.id;

    // Validate input
    if (!productId) {
      return res.status(400).json({ success: false, message: "Product ID is required" });
    }

    // Find product
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // Update product to remove offer
    await Product.updateOne(
      { _id: productId },
      {
        $set: {
          hasOffer: false,
          offerPercentage: 0,
          salePrice: product.regularPrice, // Reset sale price to regular price
          productOffer: 0
        }
      }
    );

    return res.status(200).json({ success: true, message: "Offer removed successfully" });
  } catch (error) {
    console.error("Error in removeProductOffer:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};



// DELETE AND RECOVER 
const updateProductStatus = async (req, res) => {
  try {
    const id = req.params.id;
    const { action } = req.body;

    let updateData = {};
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
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
    const result = await Product.updateOne({ _id: id }, { $set: updateData });
    console.log('Update Result:', result);

    if (result.modifiedCount === 0) {
      return res.status(404).json({ success: false, message: 'Product not found or already in desired state' });
    }

    res.json({ success: true, message: `Product ${action}d successfully!` });
  } catch (error) {
    console.error('Update Status Error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const getEditProduct = async (req, res) => {
  try {
    const shapes = await Category.distinct("shape", {
      shape: { $ne: null },
      isDeleted: false
    });
    const id = req.params.id;
    const product = await Product.findOne({ _id: id });

    if (!product) {
      return res.redirect('/admin/products');
    }

    const categoryList = await Category.find({ isActive: true });
    const brandList = await Brand.find({ isActive: true });

    // Changed from 'admin/productEdit' to 'productEdit' to match your file structure
    res.render('productEdit', {
      pageTitle: 'Edit Products',
      category: categoryList,
      brand: brandList,
      shape: shapes,
      product: product
    });
  } catch (error) {
    console.error('Error loading edit product page:', error);
    res.redirect('/admin/error');
  }
};

const editProduct = async (req, res) => {
  try {
    const id = req.params.id;
    const product = await Product.findOne({ _id: id });

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const data = req.body;
    console.log("Updating product:", id);
    console.log("New product data:", data);
    console.log("Files received:", req.files ? Object.keys(req.files) : 'No files');

    // Check if product name exists on another product
    const existingProduct = await Product.findOne({
      productName: data.productName,
      _id: { $ne: id }
    });

    if (existingProduct) {
      return res.status(400).json({
        success: false,
        message: "Product with this name already exists. Please try another name"
      });
    }

    // Prepare update fields
    const updateFields = {
      productName: data.productName,
      description: data.description || '', // Add default empty string if description is missing
      regularPrice: parseFloat(data.regularPrice),
      salePrice: parseFloat(data.salePrice),
      quantity: parseInt(data.quantity),
      shape: data.shape,
      color: data.color
    };

    // Handle category - ensure it's a valid ObjectId
    if (data.category) {
      if (mongoose.Types.ObjectId.isValid(data.category)) {
        updateFields.category = new mongoose.Types.ObjectId(data.category);
      } else {
        const category = await Category.findOne({ name: data.category });
        if (category) {
          updateFields.category = category._id;
        } else {
          return res.status(400).json({
            success: false,
            message: "Category not found. Please select a valid category."
          });
        }
      }
    }

    // Handle brand - ensure it's a valid ObjectId
    if (data.brand) {
      if (mongoose.Types.ObjectId.isValid(data.brand)) {
        updateFields.brand = new mongoose.Types.ObjectId(data.brand);
      } else {
        const brand = await Brand.findOne({ name: data.brand });
        if (brand) {
          updateFields.brand = brand._id;
        } else {
          return res.status(400).json({
            success: false,
            message: "Brand not found. Please select a valid brand."
          });
        }
      }
    }

    // Handle image updates
    const existingImages = product.productImage || [];
    const newProductImages = [];

    // Process each image slot 
    for (let i = 1; i <= 4; i++) {
      // Check if there's a new file uploaded for this slot
      if (req.files && req.files[`image${i}`] && req.files[`image${i}`][0]) {
        // New image uploaded - process it
        const file = req.files[`image${i}`][0];
        const filename = `${Date.now()}-image${i}.webp`;
        const uploadDir = path.join(__dirname, "../../public/uploads/product-images");
        const filePath = path.join(uploadDir, filename);

        // Ensure directory exists
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        // Process image with sharp
        await sharp(file.buffer)
          .resize({
            width: 1200,
            height: 600,
            fit: "contain",
            background: { r: 255, g: 255, b: 255, alpha: 1 }
          })
          .webp({ quality: 80 })
          .toFile(filePath);

        newProductImages.push(`uploads/product-images/${filename}`);

        // Delete old image if it exists
        if (existingImages[i - 1]) {
          const oldImagePath = path.join(__dirname, "../../public", existingImages[i - 1]);
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        }
      } else if (existingImages[i - 1]) {
        // No new image uploaded, keep existing image
        newProductImages.push(existingImages[i - 1]);
      }
      // If no new image and no existing image, skip (empty slot)
    }

    // Ensure at least one image exists
    if (newProductImages.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Product must have at least one image"
      });
    }

    // Update the product images array
    updateFields.productImage = newProductImages;

    console.log("Update fields:", updateFields);

    // Update the product
    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      updateFields,
      {
        new: true,
        runValidators: true 
      }
    );

    if (!updatedProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found during update"
      });
    }

    console.log("Product updated successfully:", updatedProduct._id);
    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product: updatedProduct
    });

  } catch (error) {
    console.error('Error updating product:', error);

    // More specific error handling
    if (error.name === 'ValidationError') {
      const errorMessages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: `Validation error: ${errorMessages.join(', ')}`
      });
    }

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: "Invalid data format provided"
      });
    }

    res.status(500).json({
      success: false,
      message: "An error occurred while updating the product",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


const updateProductQuantity = async (req, res) => {
  try {
    const productId = req.params.id;
    const { quantity } = req.body;

    await Product.findByIdAndUpdate(productId, { quantity: parseInt(quantity) });

    res.json({ success: true });
  } catch (error) {
    console.error("Error updating quantity:", error);
    res.status(500).json({ success: false });
  }
};


module.exports = {
  getProductsAddPage,
  addProducts,
  saveImage,
  getAllProducts,
  addProductOffer,
  removeProductOffer,
  updateProductStatus,
  getEditProduct,
  editProduct,
  updateProductQuantity
}