const Wallet = require('../../models/walletSchema')
const User = require('../../models/userSchema')

const getWallet = async(req,res)=>{
    try {

        res.render('wallet',{
            username:null,
            transactions:null,
            
        })
    } catch (error) {
        
    }
}

module.exports = {
    getWallet
}