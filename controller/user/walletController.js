const Wallet = require('../../models/walletSchema')
const User = require('../../models/userSchema')
const razorpay = require('../../config/razorpay')
const crypto = require('crypto');





const getWallet = async (req, res) => {
  try {
    const userId = req.session.user;
    const [userDoc, wallet] = await Promise.all([
      User.findById(userId).populate('redeemedUsers'),
      Wallet.findOne({ userId })
    ]);

    if (!userDoc) {
      return res.status(404).render('page-404', {
        isLoggedIn: false,
        username: '',
        message: 'User not found'
      });
    }

    const totalReferrals = userDoc.redeemedUsers.length;

    const totalEarned = wallet?.transactions
  .filter(txn =>
    txn.transactionType === 'credit' &&
    txn.transactionPurpose === 'referrals' &&
    txn.description.includes('Referral reward')
  )
  .reduce((sum, txn) => sum + txn.amount, 0);

    const user = {
      name: userDoc.name,
      image: userDoc.image || '',
      wallet: {
        balance: wallet?.balance || 0
      },
      referrals: userDoc.redeemedUsers
    };

    const transactions = (wallet?.transactions || []).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.render('wallet', {
      user,
      transactions,
      username: user.name,
      isLoggedIn: true,
      totalReferrals:totalReferrals||0,
      totalEarned
    });

  } catch (err) {
    logger.error(err);
    res.status(500).send('Error loading wallet');
  }
};




const createWalletRazorpayOrder = async (req, res) => {
  try {
    const amount = req.body.amount
    const order = await razorpay.orders.create({
      amount: amount * 100, // Razorpay accepts in paise
      currency: "INR",
      receipt: "receipt_" + Date.now(),
      payment_capture: 1
    });


    res.json({
      success: true,
      razorpayOrderId: order.id,
      amountInPaise: order.amount,
      keyId: process.env.RAZORPAY_KEY_ID,
      user: {
        name: req.user.name,
        email: req.user.email
      }
    });
  } catch (err) {
    logger.error("Create Razorpay order error:", err);
    res.json({ success: false });
  }
}


const verifyWalletPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.json({ success: false, message: "Signature mismatch" });
    }

    let wallet = await Wallet.findOne({ userId: req.user._id });

    if (!wallet) {
      wallet = new Wallet({
        userId: req.user._id,
        balance: 0,
        refundAmount: 0,
        totalDebited: 0,
        transactions: []
      });
    }

    wallet.balance += amount;
    wallet.transactions.push({
      amount,
      transactionType: 'credit',
      transactionPurpose: 'add_money',
      description: `Razorpay Payment ID: ${razorpay_payment_id}`,
      createdAt: new Date()
    });

    await wallet.save();

    res.json({ success: true });

  } catch (err) {
    logger.error("Verify payment error:", err);
    res.json({ success: false });
  }
}

const getReferrals = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) return res.redirect('/login');

    const user = await User.findById(userId).populate('redeemedUsers');
    if (!user) {
      return res.status(404).render('page-404', {
        isLoggedIn: false,
        username: '',
        message: 'User not found'
      });
    }

    const totalReferrals = user.redeemedUsers.length;
    const totalEarned = totalReferrals * 220;

    res.render('referrals', {
      isLoggedIn: true,
      username: user.name,
      referralCode: user?.referralCode ?? 'N/A',
      totalReferrals,
      totalEarned,
      referrals: user.redeemedUsers
    });

  } catch (error) {
    logger.error("Error in getReferrals:", error);
    res.status(500).render('page-500', {
      isLoggedIn: true,
      username: '',
      message: 'Internal Server Error'
    });
  }
};


module.exports = {
  getWallet,
  createWalletRazorpayOrder,
  verifyWalletPayment,
  getReferrals
}

