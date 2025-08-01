const multer = require('multer');
const path = require('path');
const fs = require('fs');

const ensureDirectoryExists = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Storage product images
const productStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../public/uploads/product-images');
    ensureDirectoryExists(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Storage brand logos
const brandStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../public/uploads/brands');
    ensureDirectoryExists(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

//storage user images
const userStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../public/uploads/userProfileimages');
    ensureDirectoryExists(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter to allow only images
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'image/jpg') {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file format. Only JPEG, JPG and PNG are allowed.'), false);
  }
};

// Create multer instances
const productUpload = multer({
  storage: productStorage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: fileFilter
});

const brandUpload = multer({
  storage: brandStorage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: fileFilter
});




const userUpload = multer({
  storage: userStorage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: fileFilter
});

module.exports = {
  productUpload,
  brandUpload,
  userUpload,
}