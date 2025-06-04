const User = require('../../models/userSchema');
const Order = require('../../models/orderSchema');

const getOrders = async (req, res) => {
    try {
        const userId = req.session.user;

        const userData = await User.findById(userId); 

        const orders = await Order.find({ userId }).sort({ createdAt: -1}); 

        res.render('order', {
            orders,
            username: userData.name
        });

    } catch (error) {
        console.log(error);
        res.redirect('/pageNotFound');
    }
};

module.exports = {
    getOrders
};
