const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const session = require('express-session');
const passport = require('./config/passport');
const db = require('./config/db');
const logger = require('./helpers/logger');
const userRouter = require('./routes/userRouter');
const adminRouter = require('./routes/adminRouter');

dotenv.config();
db();
const app = express();

app.use(express.urlencoded({ extended: true })); //convert querystring data
app.use(express.json()); //form data convert into json
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 72 * 60 * 60 * 1000,
    },
  })
);
app.use(passport.initialize()); // authentication
app.use(passport.session());
app.use((req, res, next) => {
  res.set('cache-control', 'no-store');
  next();
});
app.use(express.static('public',{
  maxAge:'1d'
}));
app.use('/', userRouter);
app.use('/admin', adminRouter);

app.set('view engine', 'ejs');
app.set('views', [path.join(__dirname, 'views/user'), path.join(__dirname, 'views/admin')]);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server Running http://localhost:${PORT}`);
});

module.exports = app;
