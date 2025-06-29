const Wallet = require('../../models/walletSchema')
const User = require('../../models/userSchema')
const razorpay = require('../../config/razorpay')
const crypto = require('crypto');





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
      referrals: userDoc?.referrals || []
    };

    const transactions = (wallet?.transactions || []).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.render('wallet', {
      user,
      transactions,
      username: user.name
    });

  } catch (err) {
    console.error(err);
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
    console.error("Create Razorpay order error:", err);
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
    // Add amount to wallet
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
    console.error("Verify payment error:", err);
    res.json({ success: false });
  }
}
module.exports = {
  getWallet,
  createWalletRazorpayOrder,
  verifyWalletPayment
}