const User = require('../models/userSchema')

const userAuth = async (req, res, next) => {
  try {
    res.locals.isLoggedIn = false;
    res.locals.user = null;

    if (!req.session.user) {
      return res.redirect('/login');
    }

    const userId = req.session.user?._id || req.session.user;
    const user = await User.findById(userId);

    if (!user) {
      req.session.destroy((err) => {
        if (err) console.log('Error destroying session:', err);
        res.redirect('/login');
      });
      return;
    }

    if (user.isBlocked) {
      req.session.message = 'Access denied. Your account has been blocked.';
      req.session.destroy((err) => {
        if (err) console.log('Error destroying session:', err);
        res.redirect('/login');
      });
      return;
    }

    req.user = user;
    res.locals.user = user;
    res.locals.isLoggedIn = true;

    next();
  } catch (error) {
    console.log('Error in userAuth middleware:', error);
    req.session.destroy((err) => {
      if (err) console.log('Error destroying session:', err);
      res.status(500).send('Internal server error');
    });
  }
};




const adminAuth = (req,res,next)=>{
    User.findOne({isAdmin:true})
    .then(data=>{
        if(data){
            next()
        }else{
            res.redirect('/admin/login')
        }
    })
    .catch(error=>{
        console.log('Error in admin Auth middleware',error)
        res.status(500).send('Internal server Error!')
    })
}

module.exports = {
    userAuth,
    adminAuth
}