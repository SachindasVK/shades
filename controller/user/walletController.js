const Wallet = require('../../models/walletSchema')
const User = require('../../models/userSchema')

const getWallet = async (req, res) => {
  try {
    const userId = req.session.user;

    const [userDoc, wallet] = await Promise.all([
      User.findById(userId),
      Wallet.findOne({ userId })
    ]);

    const user = {
      name: userDoc?.name || '',
      image: userDoc?.image || '',
      wallet: {
        balance: wallet?.balance || 0
      },
      referrals: userDoc?.referrals || [] // or however you're storing them
    };

    const transactions = wallet?.transactions || [];

    res.render('wallet', { 
        user,
         transactions,
        username:user.name
        });

  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading wallet');
  }
};



module.exports = {
    getWallet
}