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
            const { status, returnStatus, adminComment } = req.body;

            const order = await orderSchema.findById(orderId)
                .populate({
                    path: 'userId',
                    select: '_id'
                });

            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: 'Order not found'
                });
            }

            // Handle return request approval/rejection
            if (returnStatus) {
                order.returnStatus = returnStatus;
                order.returnAdminComment = adminComment;

                if (returnStatus === 'approved') {
                    try {
                        // Get the actual user ID from the populated field
                        const userId = order.userId._id || order.userId;

                        // Simplified condition for refund eligibility
                        const isEligibleForRefund = 
                            order.paymentMethod === 'cod' || 
                            ((['wallet', 'online', 'razorpay'].includes(order.paymentMethod)) && 
                             order.paymentStatus === 'completed');

                        if (isEligibleForRefund) {
                            // Find or create wallet
                            let wallet = await Wallet.findOne({ userId: userId });
                            
                            if (!wallet) {
                                wallet = new Wallet({
                                    userId: userId,
                                    balance: 0,
                                    transactions: []
                                });
                            }

                            // Add refund amount to wallet
                            wallet.balance += order.totalAmount;

                            // Add transaction record
                            wallet.transactions.push({
                                type: 'credit',
                                amount: order.totalAmount,
                                description: `Refund for returned order #${order._id} (${order.paymentMethod.toUpperCase()})`,
                                orderId: order._id,
                                date: new Date()
                            });

                            await wallet.save();
                            
                            // Update order payment status
                            order.paymentStatus = 'refunded';
                        }

                        // Update product stock
                        for (const item of order.items) {
                            const product = await productSchema.findById(item.product);
                            if (product) {
                                product.stock += item.quantity;
                                await product.save();
                            }
                        }

                        // Update order status to reflect return approval
                        order.orderStatus = 'returned';

                    } catch (error) {
                        console.error('Return processing error:', error);
                        throw new Error('Failed to process return: ' + error.message);
                    }
                } else if (returnStatus === 'rejected') {
                    order.orderStatus = 'delivered';
                }

                // Add to status history
                order.statusHistory.push({
                    status: order.orderStatus,
                    date: new Date(),
                    comment: `Return ${returnStatus}: ${adminComment || ''}`
                });
            } 
            // Handle regular status updates
            else if (status) {
                order.orderStatus = status;
                
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

                // Add to status history
                order.statusHistory.push({
                    status: status,
                    date: new Date(),
                    comment: adminComment || `Order status updated to ${status}`
                });
            }

            await order.save();

            res.status(200).json({
                success: true,
                message: returnStatus 
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