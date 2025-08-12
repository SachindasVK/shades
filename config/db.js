const mongoose = require('mongoose');
const logger = require('../helpers/logger');
require('dotenv').config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('DB Connected!');
  } catch (error) {
    logger.error('DB Connection error', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
