const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const mongoose = require('mongoose');
const Brand = require('../../models/brandSchema');
const logger = require('../../helpers/logger');
const { cloudinary } = require('../../config/cloudinary');

const getProductsAddPage = async (req, res) => {
  try {
    const shapes = await Category.distinct('shape', {
      shape: { $ne: null },
      isDeleted: false,
    });
    const categoryList = await Category.find({ isActive: true });
    const brandList = await Brand.find({ isActive: true });
    res.render('addProducts', {
      pageTitle: 'Add Products',
      category: categoryList,
      brand: brandList,
      shape: shapes,
    });
  } catch (error) {
    res.redirect('/admin/error');
  }
};

const addProducts = async (req, res) => {
  try {
    const {
      productName,
      description,
      shape,
      brand,
      category,
      regularPrice,
      salePrice,
      quantity,
      color,
    } = req.body;
    const files = req.files;

    if (
      !productName ||
      !description ||
      !brand ||
      !category ||
      !regularPrice ||
      !quantity ||
      !color ||
      !shape
    ) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const expectedKeys = ['image1', 'image2', 'image3', 'image4'];
    if (
      !files ||
      Object.keys(files).length !== 4 ||
      !expectedKeys.every((key) => files[key] && files[key].length === 1)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Please upload exactly 4 images with keys image1, image2, image3, and image4',
      });
    }

    const productExists = await Product.findOne({ productName });
    if (productExists) {
      return res.status(400).json({
        success: false,
        message: 'Product already exists, try another name',
      });
    }

    // Convert category & brand (name or ID to ObjectId)
    let categoryId;
    if (category.match(/^[0-9a-fA-F]{24}$/)) {
      const foundCategory = await Category.findById(category);
      if (!foundCategory)
        return res.status(400).json({ success: false, message: 'Category not found' });
      categoryId = foundCategory._id;
    } else {
      const foundCategory = await Category.findOne({ name: category });
      if (!foundCategory)
        return res.status(400).json({ success: false, message: 'Category not found' });
      categoryId = foundCategory._id;
    }

    let brandId;
    if (brand.match(/^[0-9a-fA-F]{24}$/)) {
      const foundBrand = await Brand.findById(brand);
      if (!foundBrand) return res.status(400).json({ success: false, message: 'Brand not found' });
      brandId = foundBrand._id;
    } else {
      const foundBrand = await Brand.findOne({ name: brand });
      if (!foundBrand) return res.status(400).json({ success: false, message: 'Brand not found' });
      brandId = foundBrand._id;
    }

    // Price & quantity validations
    const parsedRegularPrice = parseFloat(regularPrice);
    const parsedSalePrice = parseFloat(salePrice || regularPrice);
    const parsedQuantity = parseInt(quantity);
    if (isNaN(parsedRegularPrice) || parsedRegularPrice <= 0)
      return res.status(400).json({ success: false, message: 'Regular price must be positive' });
    if (isNaN(parsedSalePrice) || parsedSalePrice <= 0)
      return res.status(400).json({ success: false, message: 'Sale price must be positive' });
    if (isNaN(parsedQuantity) || parsedQuantity < 0)
      return res.status(400).json({ success: false, message: 'Quantity must be non-negative' });

    // Upload each image to Cloudinary with transformations
    const imageFilenames = [];
    for (const key of expectedKeys) {
      const file = files[key][0];
      const uploadedImage = await cloudinary.uploader.upload(file.path, {
        folder: 'uploads/products',
        transformation: [
          { width: 1200, height: 600, crop: 'pad', background: 'white' },
          { fetch_format: 'webp', quality: 'auto' },
        ],
      });
      imageFilenames.push(uploadedImage.secure_url);
    }

    // Save product
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
      status: 'available',
      isActive: true,
    });

    await newProduct.save();
    return res.status(200).json({ success: true, message: 'Product added successfully' });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error saving product: ' + error.message,
    });
  }
};

const getAllProducts = async (req, res) => {
  try {
    logger.info('Getting all products...');
    const search = req.query.search || '';
    const page = parseInt(req.query.page) || 1;
    const limit = 5;

    const searchQuery = {};

    if (search) {
      searchQuery.$or = [
        { productName: { $regex: new RegExp('.*' + search + '.*', 'i') } },
        { name: { $regex: new RegExp('.*' + search + '.*', 'i') } },
      ];
    }

    if (req.query.showAll !== 'true') {
      searchQuery.status = { $ne: 'deleted' };
    }

    const products = await Product.find(searchQuery)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit)
      .populate('category')
      .populate('brand')
      .exec();

    logger.info(`Found ${products.length} products`);

    const totalItems = await Product.countDocuments(searchQuery);

    const categories = await Category.find({ isActive: true });
    const brands = await Brand.find({ isActive: true });

    res.render('products', {
      products: products,
      totalItems: totalItems,
      currentPage: page,
      totalPages: Math.ceil(totalItems / limit),
      limit: limit,
      searchTerm: search,
      categories: categories,
      brands: brands,
      pageTitle: 'Product Management',
    });
  } catch (error) {
    logger.error('Error fetching products:', error);
    res.status(500).render('error', {
      message: 'Failed to fetch products',
      error: error.message,
    });
  }
};

// Category Offer
const addProductOffer = async (req, res) => {
  try {
    const productId = req.params.id;
    const { offerPercentage } = req.body;

    if (!productId) {
      return res.json({ success: false, message: 'Product ID is required' });
    }
    if (offerPercentage === undefined) {
      return res.json({ success: false, message: 'Offer details required' });
    }

    const percentage = parseFloat(offerPercentage);
    if (isNaN(percentage) || percentage < 1 || percentage > 99) {
      return res.json({
        success: false,
        message: 'Offer percentage must be between 1 and 99',
      });
    }

    const product = await Product.findById(productId).populate('category');
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    product.productOffer = percentage;
    product.offerPercentage = percentage;
    product.hasOffer = true;

    const category = product.category;
    const now = new Date();
    let categoryOffer = 0;

    if (category?.hasOffer && category.offerStartDate <= now && category.offerEndDate >= now) {
      categoryOffer = category.offerPercentage || 0;
    }

    const maxOffer = Math.max(percentage, categoryOffer);
    const discountAmount = Math.floor((product.regularPrice * maxOffer) / 100);
    product.salePrice = product.regularPrice - discountAmount;

    await product.save();

    return res.json({
      success: true,
      message: 'Product offer added successfully',
    });
  } catch (error) {
    logger.error('Error in addProductOffer:', error);
    return res.status(500).render('error', {
      pageTitle: 'Error',
      message: 'Something went wrong while adding product offer',
    });
  }
};

const removeProductOffer = async (req, res) => {
  try {
    const productId = req.params.id;
    if (!productId) {
      return res.status(400).json({ success: false, message: 'Product ID is required' });
    }
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    await Product.updateOne(
      { _id: productId },
      {
        $set: {
          hasOffer: false,
          offerPercentage: 0,
          salePrice: product.regularPrice,
          productOffer: 0,
        },
      }
    );

    return res.status(200).json({ success: true, message: 'Offer removed successfully' });
  } catch (error) {
    logger.error('Error in removeProductOffer:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
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
        status: 'Unavailable',
      };
    } else if (action === 'recover') {
      updateData = {
        isDeleted: false,
        deletedAt: null,
        isActive: true,
        status: 'available',
      };
    } else {
      return res.status(400).json({ success: false, message: 'Invalid action' });
    }
    const result = await Product.updateOne({ _id: id }, { $set: updateData });
    logger.info(`Update Result: ${result}`);

    if (result.modifiedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or already in desired state',
      });
    }

    res.json({ success: true, message: `Product ${action}d successfully!` });
  } catch (error) {
    logger.error('Update Status Error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const getEditProduct = async (req, res) => {
  try {
    const shapes = await Category.distinct('shape', {
      shape: { $ne: null },
      isDeleted: false,
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
      product: product,
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
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const data = req.body;
    logger.info(`Updating product: ${id}`);
    logger.info(`New product data: ${JSON.stringify(data)}`);
    const existingProduct = await Product.findOne({
      productName: data.productName,
      _id: { $ne: id },
    });

    if (existingProduct) {
      return res.status(400).json({
        success: false,
        message: 'Product with this name already exists. Please try another name',
      });
    }

    const updateFields = {
      productName: data.productName,
      description: data.description || '',
      regularPrice: parseFloat(data.regularPrice),
      salePrice: parseFloat(data.salePrice),
      quantity: parseInt(data.quantity),
      shape: data.shape,
      color: data.color,
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
            message: 'Category not found. Please select a valid category.',
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
            message: 'Brand not found. Please select a valid brand.',
          });
        }
      }
    }

    const existingImages = product.productImage || [];
    const newProductImages = [];

    for (let i = 1; i <= 4; i++) {
      if (req.files && req.files[`image${i}`] && req.files[`image${i}`][0]) {
        const file = req.files[`image${i}`][0];

        const uploadedImage = await cloudinary.uploader.upload(file.path, {
          folder: 'uploads/products',
          transformation: [
            { width: 1200, height: 600, crop: 'pad', background: 'white' },
            { fetch_format: 'webp', quality: 'auto' },
          ],
        });

        newProductImages.push(uploadedImage.secure_url);
      } else if (existingImages[i - 1]) {
        newProductImages.push(existingImages[i - 1]);
      }
    }

    if (newProductImages.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Product must have at least one image',
      });
    }

    updateFields.productImage = newProductImages;

    logger.info(`Update fields: ${updateFields}`);

    const updatedProduct = await Product.findByIdAndUpdate(id, updateFields, {
      new: true,
      runValidators: true,
    });

    if (!updatedProduct) {
      return res.status(404).json({
        success: false,
        message: 'Product not found during update',
      });
    }

    logger.info(`Product updated successfully: ${updatedProduct._id}`);
    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      product: updatedProduct,
    });
  } catch (error) {
    logger.error('Error updating product:', error);

    res.status(500).json({
      success: false,
      message: 'An error occurred while updating the product',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

const updateProductQuantity = async (req, res) => {
  try {
    const productId = req.params.id;
    const { quantity } = req.body;

    await Product.findByIdAndUpdate(productId, {
      quantity: parseInt(quantity),
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Error updating quantity:', error);
    res.status(500).json({ success: false });
  }
};

const loadProductDetails = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('category').populate('brand');
    if (!product) {
      return res.render('admin/productDetails', { product: null });
    }
    res.render('product-details', { product, pageTitle: 'Product-details' });
  } catch (error) {
    logger.error(error);
    res.render('admin/productDetails', { product: null });
  }
};

module.exports = {
  getProductsAddPage,
  addProducts,
  getAllProducts,
  addProductOffer,
  removeProductOffer,
  updateProductStatus,
  getEditProduct,
  editProduct,
  updateProductQuantity,
  loadProductDetails,
};
