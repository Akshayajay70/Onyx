import orderSchema from '../model/orderModel.js';
import productSchema from '../model/productModel.js';
import Wallet from '../model/walletModel.js';

const adminOrderController = {
    getOrders: async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = 10; // Orders per page
            const skip = (page - 1) * limit;

            // Get total orders count
            const totalOrders = await orderSchema.countDocuments();
            const totalPages = Math.ceil(totalOrders / limit);

            // Get paginated orders
            const orders = await orderSchema.find()
                .populate('userId', 'firstName lastName email')
                .populate('items.product', 'productName imageUrl price')
                .lean()
                .sort({ orderDate: -1 })
                .skip(skip)
                .limit(limit);

            // Add a default user object for deleted users
            orders.forEach(order => {
                if (!order.userId) {
                    order.userId = {
                        firstName: 'Deleted',
                        lastName: 'User',
                        email: 'N/A'
                    };
                }
                order.items = order.items.map(item => ({
                    ...item,
                    order: {
                        couponCode: order.coupon?.code || null,
                        couponDiscount: order.coupon?.discount || 0,
                        totalAmount: order.totalAmount,
                        paymentMethod: order.payment.method,
                        paymentStatus: order.payment.paymentStatus,
                        orderStatus: order.order.status
                    }
                }));
            });

            res.render('admin/orders', { 
                orders, 
                admin: req.session.admin,
                pagination: {
                    currentPage: page,
                    totalPages,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1,
                    nextPage: page + 1,
                    prevPage: page - 1
                }
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
            const { status, returnStatus, adminComment } = req.body;

            const order = await orderSchema.findById(orderId)
                .populate('userId')
                .populate('items.product');

            if (!order) {
                return res.status(404).json({ success: false, message: 'Order not found' });
            }

            // Handle cancellation
            if (status === 'cancelled') {
                if (['delivered', 'returned'].includes(order.order.status)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Cannot cancel order in current status'
                    });
                }

                // Update product stock
                for (const item of order.items) {
                    const product = await productSchema.findById(item.product);
                    if (product) {
                        product.stock += item.quantity;
                        await product.save();
                    }
                }

                // Process refund if payment was made
                if (['wallet', 'online', 'razorpay'].includes(order.payment.method) && 
                    order.payment.paymentStatus === 'completed') {
                    
                    let wallet = await Wallet.findOne({ userId: order.userId });
                    if (!wallet) {
                        wallet = new Wallet({ userId: order.userId, balance: 0, transactions: [] });
                    }

                    wallet.balance += order.totalAmount;
                    wallet.transactions.push({
                        type: 'credit',
                        amount: order.totalAmount,
                        description: `Refund for cancelled order #${order.orderCode}`,
                        orderId: order._id,
                        date: new Date()
                    });

                    await wallet.save();
                    order.payment.paymentStatus = 'refunded';
                }

                order.order.status = 'cancelled';
                order.order.statusHistory.push({
                    status: 'cancelled',
                    date: new Date(),
                    comment: adminComment || 'Order cancelled by admin'
                });
            }
            // Handle return request
            else if (returnStatus) {
                order.return.status = returnStatus;
                order.return.adminComment = adminComment;

                if (returnStatus === 'approved') {
                    // Process refund
                    let wallet = await Wallet.findOne({ userId: order.userId });
                    if (!wallet) {
                        wallet = new Wallet({ userId: order.userId, balance: 0, transactions: [] });
                    }

                    wallet.balance += order.totalAmount;
                    wallet.transactions.push({
                        type: 'credit',
                        amount: order.totalAmount,
                        description: `Refund for returned order #${order.orderCode}`,
                        orderId: order._id,
                        date: new Date()
                    });

                    await wallet.save();
                    order.payment.paymentStatus = 'refunded';
                    order.order.status = 'returned';
                    order.return.isReturnAccepted = true;
                } else {
                    order.order.status = 'delivered';
                    order.return.isReturnAccepted = false;
                }

                order.order.statusHistory.push({
                    status: order.order.status,
                    date: new Date(),
                    comment: `Return ${returnStatus}: ${adminComment || ''}`
                });
            }
            // Handle other status updates
            else if (status) {
                order.order.status = status;
                if (status === 'delivered') {
                    order.payment.paymentStatus = 'completed';
                }

                order.order.statusHistory.push({
                    status,
                    date: new Date(),
                    comment: adminComment || `Order status updated to ${status}`
                });
            }

            await order.save();
            res.status(200).json({ success: true, message: 'Order updated successfully' });

        } catch (error) {
            console.error('Update order status error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update order status: ' + error.message
            });
        }
    }
};

export default adminOrderController; 