import orderSchema from '../model/orderModel.js';
import productSchema from '../model/productModel.js';
import Wallet from '../model/walletModel.js';

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
                .lean()
                .sort({ orderDate: -1 });

            // Format order items with additional details
            orders.forEach(order => {
                order.items = order.items.map(item => ({
                    ...item,
                    order: {
                        couponCode: order.couponCode,
                        couponDiscount: order.couponDiscount,
                        discount: order.discount,
                        totalAmount: order.totalAmount,
                        paymentMethod: order.paymentMethod,
                        paymentStatus: order.paymentStatus,
                        orderStatus: order.orderStatus
                    }
                }));
            });

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
            const { status, returnStatus, adminComment } = req.body;

            const order = await orderSchema.findById(orderId)
                .populate({
                    path: 'userId',
                    select: '_id'
                })
                .populate({
                    path: 'items.product',
                    select: '_id stock'
                });

            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: 'Order not found'
                });
            }

            // Check if order can be cancelled
            if (status === 'cancelled') {
                if (['delivered', 'returned'].includes(order.orderStatus)) {
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
                if (['wallet', 'online', 'razorpay'].includes(order.paymentMethod) && 
                    order.paymentStatus === 'completed') {
                    
                    const userId = order.userId._id || order.userId;
                    let wallet = await Wallet.findOne({ userId });
                    
                    if (!wallet) {
                        wallet = new Wallet({
                            userId,
                            balance: 0,
                            transactions: []
                        });
                    }

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
                    // For COD orders or pending payments
                    order.paymentStatus = 'cancelled';
                }

                order.orderStatus = 'cancelled';
                order.statusHistory.push({
                    status: 'cancelled',
                    date: new Date(),
                    comment: adminComment || 'Order cancelled by admin'
                });
            }
            // Handle return request approval/rejection
            else if (returnStatus) {
                order.returnStatus = returnStatus;
                order.returnAdminComment = adminComment;

                if (returnStatus === 'approved') {
                    try {
                        const userId = order.userId._id || order.userId;

                        // Handle refund
                        const isEligibleForRefund = 
                            order.paymentMethod === 'cod' || 
                            ((['wallet', 'online', 'razorpay'].includes(order.paymentMethod)) && 
                             order.paymentStatus === 'completed');

                        if (isEligibleForRefund) {
                            let wallet = await Wallet.findOne({ userId: userId });
                            if (!wallet) {
                                wallet = new Wallet({
                                    userId: userId,
                                    balance: 0,
                                    transactions: []
                                });
                            }

                            wallet.balance += order.totalAmount;
                            wallet.transactions.push({
                                type: 'credit',
                                amount: order.totalAmount,
                                description: `Refund for returned order #${order._id} (${order.paymentMethod.toUpperCase()})`,
                                orderId: order._id,
                                date: new Date()
                            });

                            await wallet.save();
                            order.paymentStatus = 'refunded';
                        }

                        // Update product stock for returned items
                        for (const item of order.items) {
                            try {
                                const product = await productSchema.findById(item.product._id);
                                if (product) {
                                    product.stock += item.quantity;
                                    await product.save();
                                }
                            } catch (error) {
                                console.error(`Error updating stock for product ${item.product._id}:`, error);
                            }
                        }

                        order.orderStatus = 'returned';
                    } catch (error) {
                        console.error('Return processing error:', error);
                        throw new Error('Failed to process return: ' + error.message);
                    }
                } else if (returnStatus === 'rejected') {
                    order.orderStatus = 'delivered';
                }

                order.statusHistory.push({
                    status: order.orderStatus,
                    date: new Date(),
                    comment: `Return ${returnStatus}: ${adminComment || ''}`
                });
            } 
            // Handle other status updates
            else if (status) {
                order.orderStatus = status;
                
                if (status === 'delivered') {
                    order.paymentStatus = 'completed';
                }

                order.statusHistory.push({
                    status,
                    date: new Date(),
                    comment: adminComment || `Order status updated to ${status}`
                });
            }

            await order.save();

            res.status(200).json({
                success: true,
                message: status === 'cancelled' 
                    ? 'Order cancelled successfully'
                    : returnStatus 
                        ? `Return request ${returnStatus} successfully` 
                        : 'Order status updated successfully'
            });

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