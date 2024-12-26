import orderSchema from '../model/orderModel.js';
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
            const { reason } = req.body;
            const userId = req.session.user;

            const order = await orderSchema.findOne({ _id: orderId, userId });

            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: 'Order not found'
                });
            }

            // Check if order can be cancelled
            if (!['pending', 'processing'].includes(order.orderStatus)) {
                return res.status(400).json({
                    success: false,
                    message: 'Order cannot be cancelled at this stage'
                });
            }

            // Update order status and history
            order.orderStatus = 'cancelled';
            order.cancellationReason = reason;
            order.statusHistory.push({
                status: 'cancelled',
                date: new Date(),
                comment: reason
            });

            // Restore product stock
            for (const item of order.items) {
                await productSchema.findByIdAndUpdate(
                    item.product,
                    { $inc: { stock: item.quantity } }
                );
            }

            await order.save();

            // If payment was made, initiate refund process here
            if (order.paymentMethod === 'online' && order.paymentStatus === 'completed') {
                // Implement refund logic
            }

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

            // Check if order can be returned
            if (order.orderStatus !== 'delivered') {
                return res.status(400).json({
                    success: false,
                    message: 'Only delivered orders can be returned'
                });
            }

            // Initialize status history if it doesn't exist
            if (!order.statusHistory) {
                order.statusHistory = [];
            }

            // Find the most recent delivery status
            const deliveryStatus = order.statusHistory.find(h => h.status === 'delivered') || {
                date: order.updatedAt // fallback to order update time if no delivery status found
            };

            // Check return window (7 days)
            const returnWindow = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
            if (Date.now() - deliveryStatus.date.getTime() > returnWindow) {
                return res.status(400).json({
                    success: false,
                    message: 'Return window has expired (7 days from delivery)'
                });
            }

            // Update order status and history
            order.orderStatus = 'returned';
            order.returnReason = reason;
            order.returnRequestDate = new Date();
            order.statusHistory.push({
                status: 'returned',
                date: new Date(),
                comment: reason
            });

            await order.save();

            res.json({
                success: true,
                message: 'Return request submitted successfully'
            });

        } catch (error) {
            console.error('Return request error:', error);
            res.status(500).json({
                success: false,
                message: 'Error submitting return request'
            });
        }
    }
};

export default userOrderController; 