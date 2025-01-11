import orderSchema from '../model/orderModel.js';
import Wallet from '../model/walletModel.js';
import productSchema from '../model/productModel.js';

const adminOrderController = {
    getOrders: async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = 10;
            const skip = (page - 1) * limit;

            // Get filter parameters
            const status = req.query.status;
            const dateFrom = req.query.dateFrom;
            const dateTo = req.query.dateTo;

            // Build filter object
            let filter = {};
            
            // Exclude pending status by default
            filter['items.order.status'] = { $ne: 'pending' };
            
            // Add additional status filter if provided
            if (status) {
                filter['items.order.status'] = status;
            }
            
            if (dateFrom || dateTo) {
                filter.orderDate = {};
                if (dateFrom) filter.orderDate.$gte = new Date(dateFrom);
                if (dateTo) filter.orderDate.$lte = new Date(dateTo);
            }

            const totalOrders = await orderSchema.countDocuments(filter);
            const totalPages = Math.ceil(totalOrders / limit);

            const orders = await orderSchema.find(filter)
                .populate('userId', 'firstName lastName email')
                .populate('items.product')
                .sort({ orderDate: -1 })
                .skip(skip)
                .limit(limit);

            res.render('admin/orders', {
                orders,
                currentPage: page,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
                admin: req.session.admin
            });
        } catch (error) {
            console.error('Get orders error:', error);
            res.status(500).render('admin/error', { 
                message: 'Error fetching orders',
                error,
                admin: req.session.admin
            });
        }
    },

    updateOrderStatus: async (req, res) => {
        try {
            const { orderId } = req.params;
            const { status } = req.body;

            const order = await orderSchema.findById(orderId)
                .populate('items.product');

            if (!order) {
                return res.status(404).json({ success: false, message: 'Order not found' });
            }

            // Update all items' status
            order.items.forEach(item => {
                item.order.status = status;
                item.order.statusHistory.push({
                    status,
                    date: new Date(),
                    comment: `Status updated to ${status} by admin`
                });
            });

            // Handle stock updates and refunds if needed
            if (status === 'cancelled') {
                // Restore stock
                for (const item of order.items) {
                    await productSchema.findByIdAndUpdate(
                        item.product._id,
                        { $inc: { stock: item.quantity } }
                    );
                }

                // Process refund if payment was made
                if (['wallet', 'online', 'razorpay'].includes(order.payment.method)) {
                    await processRefund(order);
                }
            }

            await order.save();
            res.json({ success: true, message: 'Order status updated successfully' });

        } catch (error) {
            console.error('Update order status error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to update order status'
            });
        }
    },

    updateItemStatus: async (req, res) => {
        try {
            const { orderId, productId } = req.params;
            const { status } = req.body;

            const order = await orderSchema.findById(orderId)
                .populate('items.product');

            if (!order) {
                return res.status(404).json({ success: false, message: 'Order not found' });
            }

            const item = order.items.find(item => 
                item.product._id.toString() === productId
            );

            if (!item) {
                return res.status(404).json({ success: false, message: 'Item not found' });
            }

            item.order.status = status;
            item.order.statusHistory.push({
                status,
                date: new Date(),
                comment: `Status updated to ${status} by admin`
            });

            if (status === 'cancelled') {
                // Restore stock
                await productSchema.findByIdAndUpdate(
                    item.product._id,
                    { $inc: { stock: item.quantity } }
                );

                // Calculate refund amount for single item
                if (['wallet', 'online', 'razorpay'].includes(order.payment.method)) {
                    await processItemRefund(order, item);
                }
            }

             // Update payment status for COD orders when delivered
             if (status === 'delivered' && order.payment.method === 'cod') {
                order.payment.paymentStatus = 'completed';
            }

            await order.save();
            res.json({ success: true, message: 'Item status updated successfully' });

        } catch (error) {
            console.error('Update item status error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to update item status'
            });
        }
    },

    handleReturnRequest: async (req, res) => {
        try {
            const { orderId, productId } = req.params;
            const { returnStatus, adminComment } = req.body;

            const order = await orderSchema.findById(orderId)
                .populate('items.product');

            if (!order) {
                return res.status(404).json({ success: false, message: 'Order not found' });
            }

            const item = order.items.find(item => 
                item.product._id.toString() === productId
            );

            if (!item) {
                return res.status(404).json({ success: false, message: 'Item not found' });
            }

            item.return.status = returnStatus;
            item.return.adminComment = adminComment;
            item.return.isReturnAccepted = returnStatus === 'approved';

            if (returnStatus === 'approved') {
                item.order.status = 'returned';
                item.order.statusHistory.push({
                    status: 'returned',
                    date: new Date(),
                    comment: `Return approved by admin: ${adminComment}`
                });

                // Restore stock
                await productSchema.findByIdAndUpdate(
                    item.product._id,
                    { $inc: { stock: item.quantity } }
                );

                // Update payment status for both online and COD orders
                order.payment.paymentStatus = 'refunded';

                // Process refund for online payments
                if (order.payment.method !== 'cod') {
                    await processItemRefund(order, item);
                }
            }

            await order.save();
            res.json({ success: true, message: 'Return request handled successfully' });

        } catch (error) {
            console.error('Handle return request error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to handle return request'
            });
        }
    }
};

// Helper function to process refund
async function processRefund(order) {
    const wallet = await Wallet.findOne({ userId: order.userId });
    
    if (!wallet) {
        throw new Error('User wallet not found');
    }

    wallet.balance += order.totalAmount;
    wallet.transactions.push({
        type: 'credit',
        amount: order.totalAmount,
        description: `Refund for order #${order.orderCode}`,
        orderId: order._id
    });

    await wallet.save();
    order.payment.paymentStatus = 'refunded';
}

// Helper function to process item refund
async function processItemRefund(order, item) {
    const wallet = await Wallet.findOne({ userId: order.userId });
    
    if (!wallet) {
        throw new Error('User wallet not found');
    }

    const refundAmount = item.subtotal;
    wallet.balance += refundAmount;
    wallet.transactions.push({
        type: 'credit',
        amount: refundAmount,
        description: `Refund for item in order #${order.orderCode}`,
        orderId: order._id
    });

    await wallet.save();
    order.payment.paymentStatus = 'refunded';
}

export default adminOrderController; 