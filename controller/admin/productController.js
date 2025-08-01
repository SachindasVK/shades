const Product = require('../../models/productSchema')
const Category = require('../../models/categorySchema')
const mongoose = require('mongoose');
const Brand = require('../../models/brandSchema')
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')
const logger = require('../../helpers/logger')

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

    console.log("Product submission data:", {
      productName, description, brand, category,
      regularPrice, salePrice, quantity, color, shape,
      fileCount: files ? Object.keys(files).length : 0
    });


    if (!productName || !description || !brand || !category || !regularPrice || !quantity || !color || !shape) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    const expectedKeys = ["image1", "image2", "image3", "image4"];
    if (!files || Object.keys(files).length !== 4 || !expectedKeys.every(key => files[key] && files[key].length === 1)) {
      return res.status(400).json({ success: false, message: "Please upload exactly 4 images with keys image1, image2, image3, and image4" });
    }


    const productExists = await Product.findOne({ productName });
    if (productExists) {
      return res.status(400).json({ success: false, message: "Product already exists, try another name" });
    }


    const uploadDir = path.join(__dirname, "../../public/uploads/product-images");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }


    const imageFilenames = [];

    for (let key of expectedKeys) {
      const file = files[key][0];
      const filename = `${Date.now()}-${key}.webp`;
      const filePath = path.join(uploadDir, filename);


      await sharp(file.buffer)
        .resize({
          width: 1200,
          height: 600,
          fit: "contain",
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .webp({ quality: 80 })
        .toFile(filePath);

      imageFilenames.push(`uploads/product-images/${filename}`);
    }


    if (imageFilenames.length !== 4) {
      return res.status(400).json({ success: false, message: "Failed to process all 4 product images" });
    }


    let categoryId;
    if (category.match(/^[0-9a-fA-F]{24}$/)) {

      const foundCategory = await Category.findById(category);
      if (!foundCategory) {
        return res.status(400).json({ success: false, message: "Category not found" });
      }
      categoryId = foundCategory._id;
    } else {

      const foundCategory = await Category.findOne({ name: category });
      if (!foundCategory) {
        return res.status(400).json({ success: false, message: "Category not found" });
      }
      categoryId = foundCategory._id;
    }


    let brandId;
    if (brand.match(/^[0-9a-fA-F]{24}$/)) {

      const foundBrand = await Brand.findById(brand);
      if (!foundBrand) {
        return res.status(400).json({ success: false, message: "Brand not found" });
      }
      brandId = foundBrand._id;
    } else {

      const foundBrand = await Brand.findOne({ name: brand });
      if (!foundBrand) {
        return res.status(400).json({ success: false, message: "Brand not found" });
      }
      brandId = foundBrand._id;
    }


    const parsedRegularPrice = parseFloat(regularPrice);
    const parsedSalePrice = parseFloat(salePrice || regularPrice);
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

    logger.info(`About to save product: ${newProduct}`);
    await newProduct.save();
    logger.info("Product saved successfully");

    return res.status(200).json({ success: true, message: "Product added successfully" });
  } catch (error) {
    logger.error("Error saving product:", error);
    return res.status(500).json({ success: false, message: "Error saving product: " + error.message });
  }
};



const saveImage = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: "No image file provided" });
    }


    const filename = Date.now() + '-' + file.originalname.replace(/\s/g, "");
    const filepath = path.join(__dirname, "../../public/uploads/product-images", filename);


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
    logger.error("Error saving image:", error);
    return res.status(500).json({ success: false, message: "Error saving image" });
  }
};





const getAllProducts = async (req, res) => {
  try {
    logger.info("Getting all products...");
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 10;

    const searchQuery = {};


    if (search) {
      searchQuery.$or = [
        { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
        { name: { $regex: new RegExp(".*" + search + ".*", "i") } }
      ];
    }

    if (req.query.showAll !== 'true') {
      searchQuery.status = { $ne: "deleted" };
    }


    const products = await Product.find(searchQuery)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit)
      .populate("category")
      .populate("brand")
      .exec();

    logger.info(`Found ${products.length} products`);

    const totalItems = await Product.countDocuments(searchQuery);


    const categories = await Category.find({ isActive: true });
    const brands = await Brand.find({ isActive: true });


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
    logger.error("Error fetching products:", error);
    res.status(500).render("error", {
      message: "Failed to fetch products",
      error: error.message
    });
  }
};



// Category Offer
const addProductOffer = async (req, res) => {
  try {
    const productId = req.params.id;
    const { offerPercentage } = req.body;

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

    product.productOffer = percentage;
    product.offerPercentage = percentage;
    product.hasOffer = true;


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
    logger.error("Error in addProductOffer:", error);
    return res.status(500).render('error', {
      pageTitle: 'Error',
      message: 'Something went wrong while adding product offer'
    });
  }
};




const removeProductOffer = async (req, res) => {
  try {
    const productId = req.params.id;
    if (!productId) {
      return res.status(400).json({ success: false, message: "Product ID is required" });
    }
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }
    await Product.updateOne(
      { _id: productId },
      {
        $set: {
          hasOffer: false,
          offerPercentage: 0,
          salePrice: product.regularPrice,
          productOffer: 0
        }
      }
    );

    return res.status(200).json({ success: true, message: "Offer removed successfully" });
  } catch (error) {
    logger.error("Error in removeProductOffer:", error);
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
    logger.info(`Update Result: ${result}`);

    if (result.modifiedCount === 0) {
      return res.status(404).json({ success: false, message: 'Product not found or already in desired state' });
    }

    res.json({ success: true, message: `Product ${action}d successfully!` });
  } catch (error) {
    logger.error('Update Status Error:', error);
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

    res.render('productEdit', {
      pageTitle: 'Edit Products',
      category: categoryList,
      brand: brandList,
      shape: shapes,
      product: product
    });
  } catch (error) {
    logger.error('Error loading edit product page:', error);
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
   logger.info(`Updating product: ${id}`);
   logger.info(`New product data: ${data}`);

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


    const updateFields = {
      productName: data.productName,
      description: data.description || '',
      regularPrice: parseFloat(data.regularPrice),
      salePrice: parseFloat(data.salePrice),
      quantity: parseInt(data.quantity),
      shape: data.shape,
      color: data.color
    };


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


    const existingImages = product.productImage || [];
    const newProductImages = [];


    for (let i = 1; i <= 4; i++) {

      if (req.files && req.files[`image${i}`] && req.files[`image${i}`][0]) {

        const file = req.files[`image${i}`][0];
        const filename = `${Date.now()}-image${i}.webp`;
        const uploadDir = path.join(__dirname, "../../public/uploads/product-images");
        const filePath = path.join(uploadDir, filename);


        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }


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


        if (existingImages[i - 1]) {
          const oldImagePath = path.join(__dirname, "../../public", existingImages[i - 1]);
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        }
      } else if (existingImages[i - 1]) {

        newProductImages.push(existingImages[i - 1]);
      }

    }


    if (newProductImages.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Product must have at least one image"
      });
    }


    updateFields.productImage = newProductImages;

    logger.info(`Update fields: ${updateFields}`);


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

    logger.info(`Product updated successfully: ${updatedProduct._id}`);
    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product: updatedProduct
    });

  } catch (error) {
    logger.error('Error updating product:', error);


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
    logger.error("Error updating quantity:", error);
    res.status(500).json({ success: false });
  }
};


const loadProductDetails = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('category').populate('brand');
    if (!product) {
      return res.render('admin/productDetails', { product: null });
    }
    res.render('product-details', { product ,pageTitle:'Product-details'});
  } catch (error) {
    logger.error(error);
    res.render('admin/productDetails', { product: null });
  }
}

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
  updateProductQuantity,
  loadProductDetails
}