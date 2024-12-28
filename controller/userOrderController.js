import orderSchema from '../model/orderModel.js';
import Wallet from '../model/walletModel.js';

const userOrderController = {
    getOrders: async (req, res) => {
        try {
            const userId = req.session.user;
            const orders = await orderSchema.find({ userId })
                .sort({ createdAt: -1 })
                .populate('items.product');

            res.render('user/viewOrder', { orders });
        } catch (error) {
            console.error('Get orders error:', error);
            res.status(500).render('error', { message: 'Error fetching orders' });
        }
    },

    cancelOrder: async (req, res) => {
        try {
            const { orderId } = req.params;
            const userId = req.session.user;

            const order = await orderSchema.findOne({ _id: orderId, userId });

            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: 'Order not found'
                });
            }

            if (!['pending', 'processing'].includes(order.orderStatus)) {
                return res.status(400).json({
                    success: false,
                    message: 'Order cannot be cancelled at this stage'
                });
            }

            // Update order status
            order.orderStatus = 'cancelled';
            order.statusHistory.push({
                status: 'cancelled',
                date: new Date(),
                comment: 'Order cancelled by user'
            });

            // Process refund if payment was made
            if (['wallet', 'online', 'razorpay'].includes(order.paymentMethod) && order.paymentStatus === 'completed') {
                // Find or create wallet
                let wallet = await Wallet.findOne({ userId });
                if (!wallet) {
                    wallet = await Wallet.create({ userId, balance: 0 });
                }

                // Add refund to wallet
                wallet.balance += order.totalAmount;
                wallet.transactions.push({
                    type: 'credit',
                    amount: order.totalAmount,
                    description: `Refund for cancelled order #${order._id}`,
                    orderId: order._id,
                    date: new Date()
                });

                await wallet.save();
                
                order.paymentStatus = 'refunded';
            }

            await order.save();

            res.json({
                success: true,
                message: 'Order cancelled successfully'
            });

        } catch (error) {
            console.error('Cancel order error:', error);
            res.status(500).json({
                success: false,
                message: 'Error cancelling order'
            });
        }
    },

    requestReturn: async (req, res) => {
        try {
            const { orderId } = req.params;
            const { reason } = req.body;
            const userId = req.session.user;

            const order = await orderSchema.findOne({ _id: orderId, userId });

            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: 'Order not found'
                });
            }

            if (order.orderStatus !== 'delivered') {
                return res.status(400).json({
                    success: false,
                    message: 'Only delivered orders can be returned'
                });
            }

            // Check return window (e.g., 7 days)
            const deliveryDate = order.statusHistory.find(h => h.status === 'delivered')?.date;
            if (!deliveryDate || Date.now() - new Date(deliveryDate) > 7 * 24 * 60 * 60 * 1000) {
                return res.status(400).json({
                    success: false,
                    message: 'Return window has expired'
                });
            }

            // Update order status
            order.orderStatus = 'returned';
            order.statusHistory.push({
                status: 'returned',
                date: new Date(),
                comment: reason || 'Return requested by user'
            });

            // Process refund if payment was made
            if (['wallet', 'online', 'razorpay'].includes(order.paymentMethod) && order.paymentStatus === 'completed') {
                // Find or create wallet
                let wallet = await Wallet.findOne({ userId });
                if (!wallet) {
                    wallet = await Wallet.create({ userId, balance: 0 });
                }

                // Add refund to wallet
                wallet.balance += order.totalAmount;
                wallet.transactions.push({
                    type: 'credit',
                    amount: order.totalAmount,
                    description: `Refund for returned order #${order._id}`,
                    orderId: order._id,
                    date: new Date()
                });

                await wallet.save();
                
                order.paymentStatus = 'refunded';
            }

            await order.save();

            res.json({
                success: true,
                message: 'Return request processed successfully'
            });

        } catch (error) {
            console.error('Return request error:', error);
            res.status(500).json({
                success: false,
                message: 'Error processing return request'
            });
        }
    }
};

export default userOrderController; 