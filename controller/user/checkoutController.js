const User = require('../../models/userSchema')
const Cart = require('../../models/cartSchema')
const Product = require('../../models/productSchema')
const Address = require('../../models/addressSchema')



const getSelectAddress = async (req, res) => {
    try {
        const userId = req.session.user;

        if (!userId) {
            return res.redirect('/login'); // if user not logged in
        }

        const addressDoc = await Address.findOne({ userId }); // fetch address doc for this user
        const addresses = addressDoc ? addressDoc.address : []; // handle case when no addresses yet

        res.render('selectAddress', { addresses }); // send to EJS
    } catch (error) {
        console.log('Error loading addresses:', error);
        res.redirect('/cart'); 
    }
}


module.exports = {
    getSelectAddress,
}