import orderSchema from '../model/orderModel.js';
import productSchema from '../model/productModel.js';

const adminOrderController = {
    getOrders: async (req, res) => {
        try {
            const orders = await orderSchema.find()
                .populate({
                    path: 'userId',
                    select: 'firstName lastName email'
                })
                .populate({
                    path: 'items.product',
                    select: 'productName imageUrl price'
                })
                .sort({ orderDate: -1 });

            res.render('admin/orders', {
                orders,
                admin: req.session.admin
            });
        } catch (error) {
            console.error('Admin get orders error:', error);
            res.status(500).render('error', {
                message: 'Error loading orders',
                admin: req.session.admin
            });
        }
    },

    updateOrderStatus: async (req, res) => {
        try {
            const { orderId } = req.params;
            const { status } = req.body;

            const order = await orderSchema.findById(orderId);
            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: 'Order not found'
                });
            }

            // Update order status
            order.orderStatus = status;
            
            // Update payment status based on order status
            if (status === 'delivered') {
                order.paymentStatus = 'completed';
            } else if (status === 'cancelled') {
                order.paymentStatus = 'cancelled';
                
                // Restore stock for cancelled orders
                for (const item of order.items) {
                    const product = await productSchema.findById(item.product);
                    if (product) {
                        product.stock += item.quantity;
                        await product.save();
                    }
                }
            }

            await order.save();

            res.status(200).json({
                success: true,
                message: 'Order status updated successfully'
            });
        } catch (error) {
            console.error('Update order status error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update order status'
            });
        }
    }
};

export default adminOrderController; 