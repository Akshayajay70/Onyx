import orderSchema from '../model/orderModel.js';

const userOrderController = {
    getOrders: async (req, res) => {
        try {
            const orders = await orderSchema.find({ userId: req.session.userId })
                .populate({
                    path: 'items.product',
                    select: 'productName imageUrl'
                })
                .sort({ orderDate: -1 }); // Most recent orders first

            res.render('user/viewOrder', {
                orders,
                user: req.session.user
            });
        } catch (error) {
            console.error('Get orders error:', error);
            res.status(500).render('error', {
                message: 'Error loading orders',
                user: req.session.user
            });
        }
    },

    cancelOrder: async (req, res) => {
        try {
            const orderId = req.params.orderId;
            const order = await orderSchema.findOne({ 
                _id: orderId,
                userId: req.session.userId
            });

            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: 'Order not found'
                });
            }

            // Only allow cancellation if order is pending or processing
            if (!['pending', 'processing'].includes(order.orderStatus)) {
                return res.status(400).json({
                    success: false,
                    message: 'Order cannot be cancelled at this stage'
                });
            }

            order.orderStatus = 'cancelled';
            await order.save();

            res.status(200).json({
                success: true,
                message: 'Order cancelled successfully'
            });
        } catch (error) {
            console.error('Cancel order error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to cancel order'
            });
        }
    }
};

export default userOrderController; 