import orderSchema from '../model/orderModel.js';
import Wallet from '../model/walletModel.js';
import productSchema from '../model/productModel.js';

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

            const order = await orderSchema.findOne({ _id: orderId, userId })
                .populate('items.product');

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

            // Update product stock
            try {
                for (const item of order.items) {
                    const product = await productSchema.findById(item.product._id);
                    if (product) {
                        product.stock += item.quantity;
                        await product.save();
                    }
                }
            } catch (error) {
                console.error('Error updating product stock:', error);
                throw new Error('Failed to update product stock');
            }

            // Update order status
            order.orderStatus = 'cancelled';
            order.statusHistory.push({
                status: 'cancelled',
                date: new Date(),
                comment: 'Order cancelled by user'
            });

            // Process refund if payment was made
            if (['wallet', 'online', 'razorpay'].includes(order.paymentMethod) && 
                order.paymentStatus === 'completed') {
                
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
            } else {
                order.paymentStatus = 'cancelled';
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
                message: error.message || 'Error cancelling order'
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

            // Validate order status
            if (order.orderStatus !== 'delivered') {
                return res.status(400).json({
                    success: false,
                    message: 'Only delivered orders can be returned'
                });
            }

            // Check if return is already requested
            if (order.returnReason) {
                return res.status(400).json({
                    success: false,
                    message: 'Return already requested for this order'
                });
            }

            // Check return window (7 days)
            // First, try to get delivery date from status history
            let deliveryDate;
            const deliveryStatus = order.statusHistory.find(h => h.status === 'delivered');
            
            if (deliveryStatus && deliveryStatus.date) {
                deliveryDate = deliveryStatus.date;
            } else {
                // Fallback to order's last update date if status history is not available
                deliveryDate = order.updatedAt;
            }

            const daysSinceDelivery = Math.floor((Date.now() - new Date(deliveryDate)) / (1000 * 60 * 60 * 24));
            if (daysSinceDelivery > 7) {
                return res.status(400).json({
                    success: false,
                    message: 'Return window has expired (7 days from delivery)'
                });
            }

            // Update order with return details
            order.returnReason = reason;
            order.returnRequestDate = new Date();
            order.returnStatus = 'pending';
            order.orderStatus = 'refund processing';
            order.paymentStatus = 'refund processing';

            // Add to status history
            order.statusHistory.push({
                status: 'refund processing',
                date: new Date(),
                comment: `Return requested: ${reason}`
            });

            // Process refund if payment was made
            if (['wallet', 'online', 'razorpay'].includes(order.paymentMethod) && 
                order.paymentStatus === 'completed') {
                
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
                message: 'Return request submitted successfully'
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