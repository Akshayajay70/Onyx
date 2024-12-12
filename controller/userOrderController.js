import orderSchema from '../model/orderModel.js';

const userOrderController = {
    getOrders: async (req, res) => {
        try {
            const orders = await orderSchema.find({ userId: req.session.user })
                .populate({
                    path: 'items.product',
                    select: 'productName imageUrl price'
                })
                .sort({ orderDate: -1 });

            const formattedOrders = orders.map(order => {
                return {
                    _id: order._id,
                    orderDate: order.orderDate,
                    totalAmount: order.totalAmount,
                    orderStatus: order.orderStatus,
                    paymentStatus: order.paymentStatus,
                    paymentMethod: order.paymentMethod,
                    shippingAddress: {
                        fullName: order.shippingAddress.fullName,
                        addressLine1: order.shippingAddress.addressLine1,
                        addressLine2: order.shippingAddress.addressLine2,
                        city: order.shippingAddress.city,
                        state: order.shippingAddress.state,
                        pincode: order.shippingAddress.pincode,
                        phone: order.shippingAddress.mobileNumber
                    },
                    items: order.items.map(item => ({
                        product: {
                            _id: item.product._id,
                            productName: item.product.productName,
                            imageUrl: item.product.imageUrl
                        },
                        quantity: item.quantity,
                        price: item.price,
                        subtotal: item.subtotal
                    }))
                };
            });

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