import Wallet from '../../model/walletModel.js';
import userSchema from '../../model/userModel.js';

const walletController = {
    getWallet: async (req, res) => {
        try {
            const userId = req.session.user;
            const user = await userSchema.findById(userId);

            // Find or create wallet
            let wallet = await Wallet.findOne({ userId });
            if (!wallet) {
                wallet = await Wallet.create({ userId });
            }

            // Get recent transactions
            const transactions = wallet.transactions.sort((a, b) => b.date - a.date);

            res.render('user/wallet', {
                wallet,
                transactions,
                user
            });

        } catch (error) {
            console.error('Get wallet error:', error);
            res.status(500).render('error', {
                message: 'Error fetching wallet details',
                user: req.session.user
            });
        }
    },

    addFunds: async (req, res) => {
        try {
            const { amount } = req.body;
            const userId = req.session.user;

            if (!amount || amount <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid amount'
                });
            }

            let wallet = await Wallet.findOne({ userId });
            if (!wallet) {
                wallet = await Wallet.create({ userId });
            }

            // Add transaction record
            wallet.transactions.push({
                type: 'credit',
                amount: amount,
                description: 'Added funds to wallet'
            });

            // Update balance
            wallet.balance += amount;
            await wallet.save();

            res.json({
                success: true,
                message: 'Funds added successfully',
                newBalance: wallet.balance
            });

        } catch (error) {
            console.error('Add funds error:', error);
            res.status(500).json({
                success: false,
                message: 'Error adding funds'
            });
        }
    },

    useWalletBalance: async (req, res) => {
        try {
            const { amount } = req.body;
            const userId = req.session.user;

            const wallet = await Wallet.findOne({ userId });
            if (!wallet || wallet.balance < amount) {
                return res.status(400).json({
                    success: false,
                    message: 'Insufficient wallet balance'
                });
            }

            // Deduct from wallet
            wallet.balance -= amount;
            wallet.transactions.push({
                type: 'debit',
                amount: amount,
                description: 'Used for order payment'
            });

            await wallet.save();

            res.json({
                success: true,
                message: 'Payment successful',
                newBalance: wallet.balance
            });

        } catch (error) {
            console.error('Use wallet balance error:', error);
            res.status(500).json({
                success: false,
                message: 'Error processing payment'
            });
        }
    }
};

export default walletController; 