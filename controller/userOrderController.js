import orderSchema from '../model/orderModel.js';
import productSchema from '../model/productModel.js';

const userOrderController = {
    getOrders: async (req, res) => {
        try {
            const orders = await orderSchema.find({ userId: req.session.user })
                .populate({
                    path: 'items.product',
                    select: 'productName imageUrl price'
                })
                .sort({ orderDate: -1 });

            const formattedOrders = orders.map(order => ({
                _id: order._id,
                orderDate: order.orderDate,
                totalAmount: order.totalAmount,
                orderStatus: order.orderStatus,
                paymentStatus: order.paymentStatus,
                paymentMethod: order.paymentMethod,
                shippingAddress: order.shippingAddress,
                items: order.items
            }));

            res.render('user/viewOrder', {
                orders: formattedOrders,
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
            
            // Find the order
            const order = await orderSchema.findOne({ 
                _id: orderId,
                userId: req.session.user
            });

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

            // Update stock for each product
            try {
                for (const item of order.items) {
                    console.log('Updating stock for product:', item.product);
                    
                    const product = await productSchema.findById(item.product);
                    if (product) {
                        product.stock += item.quantity;
                        await product.save();
                        console.log('Stock updated successfully for product:', item.product);
                    }
                }
            } catch (stockError) {
                console.error('Error updating stock:', stockError);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to update product stock'
                });
            }

            // Update order status
            order.orderStatus = 'cancelled';
            order.paymentStatus = 'cancelled';
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
    },

    updateOrderStatus: async (orderId, newStatus) => {
        try {
            const order = await orderSchema.findById(orderId);
            if (!order) {
                throw new Error('Order not found');
            }

            order.orderStatus = newStatus;
            if (newStatus === 'delivered') {
                order.paymentStatus = 'completed';
            }

            await order.save();
            return true;
        } catch (error) {
            console.error('Update order status error:', error);
            return false;
        }
    }
};

export default userOrderController; 