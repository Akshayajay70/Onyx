import orderSchema from '../model/orderModel.js';
import Wallet from '../model/walletModel.js';
import productSchema from '../model/productModel.js';
import userSchema from '../model/userModel.js';
import PDFDocument from 'pdfkit';



const userOrderController = {
    getOrders: async (req, res) => {
        try {
            const user = await userSchema.findById(req.session.user);

            const userId = req.session.user;
            const page = parseInt(req.query.page) || 1;
            const limit = 5; // Orders per page
            
            // Get total orders count
            const totalOrders = await orderSchema.countDocuments({ userId });
            const totalPages = Math.ceil(totalOrders / limit);
            
            // Get paginated orders
            const orders = await orderSchema.find({ userId })
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .populate('items.product');

            res.render('user/viewOrder', { 
                orders,
                currentPage: page,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
                user
            });
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

            if (!['pending', 'processing'].includes(order.order.status)) {
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
            order.order.status = 'cancelled';
            order.order.statusHistory.push({
                status: 'cancelled',
                date: new Date(),
                comment: 'Order cancelled by user'
            });

            // Process refund if payment was made
            if (['wallet', 'online', 'razorpay'].includes(order.payment.method) && 
                order.payment.paymentStatus === 'completed') {
                
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
                order.payment.paymentStatus = 'refunded';
            } else {
                order.payment.paymentStatus = 'cancelled';
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
            if (order.order.status !== 'delivered') {
                return res.status(400).json({
                    success: false,
                    message: 'Only delivered orders can be returned'
                });
            }

            // Check if return is already requested
            if (order.return.reason) {
                return res.status(400).json({
                    success: false,
                    message: 'Return already requested for this order'
                });
            }

            // Check return window (7 days)
            let deliveryDate;
            const deliveryStatus = order.order.statusHistory.find(h => h.status === 'delivered');
            
            if (deliveryStatus && deliveryStatus.date) {
                deliveryDate = deliveryStatus.date;
            } else {
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
            order.return.reason = reason;
            order.return.requestDate = new Date();
            order.return.status = 'pending';
            order.order.status = 'refund processing';
            order.payment.paymentStatus = 'refund processing';

            // Add to status history
            order.statusHistory.push({
                status: 'refund processing',
                date: new Date(),
                comment: `Return requested: ${reason}`
            });

            // Process refund if payment was made
            if (['wallet', 'online', 'razorpay'].includes(order.payment.method) && 
                order.payment.paymentStatus === 'completed') {
                
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
                    description: `Refund for returned order #${order.orderCode}`,
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
                message: error || 'Error processing return request'
            });
        }
    },

    generateInvoice: async (req, res) => {
        try {
            const orderId = req.params.orderId;
            const order = await orderSchema.findById(orderId)
                .populate('userId')
                .populate('items.product');

            if (!order) {
                return res.status(404).json({ message: 'Order not found' });
            }

            // Create PDF document
            const doc = new PDFDocument({ margin: 50 });

            // Set response headers
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderCode.slice(-6)}.pdf`);

            // Pipe PDF to response
            doc.pipe(res);

            // Add header with company logo and tax invoice text
            doc.fontSize(20)
               .text('TAX INVOICE', 50, 45, { align: 'center' })
               .moveDown();

            // Add company details (left side)
            doc.fontSize(10)
               .text('Sold By:', 50, 100)
               .font('Helvetica-Bold')
               .text('ONYX FASHION STORE', 50, 115)
               .font('Helvetica')
               .text('123 Fashion Street', 50, 130)
               .text('Kerala, India - 682001', 50, 145)
               .text('Phone: +91 9876543210', 50, 160)
               .text('Email: support@onyx.com', 50, 175)
               .text('GSTIN: 32ABCDE1234F1Z5', 50, 190);

            // Add Billing Details (right side)
            doc.fontSize(10)
               .text('Billing Address:', 300, 100)
               .font('Helvetica-Bold')
               .text(`${order.shippingAddress.fullName}`, 300, 115)
               .font('Helvetica')
               .text(order.shippingAddress.addressLine1, 300, 130)
               .text(order.shippingAddress.addressLine2, 300, 145)
               .text(`${order.shippingAddress.city}, ${order.shippingAddress.state}`, 300, 160)
               .text(`PIN: ${order.shippingAddress.pincode}`, 300, 175)
               .text(`Phone: ${order.shippingAddress.mobileNumber}`, 300, 190);

            // Add Order Details
            doc.fontSize(10)
               .text('Order Details:', 50, 230)
               .text(`Order ID: ${order.orderCode}`, 50, 245)
               .text(`Order Date: ${new Date(order.orderDate).toLocaleDateString('en-IN')}`, 50, 260)
               .text(`Payment Method: ${order.payment.method.toUpperCase()}`, 50, 275);

            // Add Items Table
            const tableTop = 320;
            doc.font('Helvetica-Bold');

            // Define column positions and widths
            const columns = {
                item: { x: 50, width: 200 },
                qty: { x: 270, width: 50 },
                gross: { x: 340, width: 70 },
                discount: { x: 420, width: 70 },
                amount: { x: 500, width: 70 }
            };

            // Table Headers
            doc.fontSize(10)
               .text('Item Name', columns.item.x, tableTop, { width: columns.item.width })
               .text('Qty', columns.qty.x, tableTop, { width: columns.qty.width, align: 'center' })
               .text('Gross', columns.gross.x, tableTop, { width: columns.gross.width, align: 'right' })
               .text('Discount', columns.discount.x, tableTop, { width: columns.discount.width, align: 'right' })
               .text('Amount', columns.amount.x, tableTop, { width: columns.amount.width, align: 'right' });

            // Underline
            doc.moveTo(50, tableTop + 15)
               .lineTo(550, tableTop + 15)
               .stroke();

            // Reset font
            doc.font('Helvetica');

            // Add items
            let y = tableTop + 30;
            order.items.forEach((item, index) => {
                // Add new page if needed
                if (y > 700) {
                    doc.addPage();
                    y = 50;
                }

                doc.fontSize(10)
                   .text(item.product.productName, columns.item.x, y, { width: columns.item.width })
                   .text(item.quantity.toString(), columns.qty.x, y, { width: columns.qty.width, align: 'center' })
                   .text(`₹${item.price.toFixed(2)}`, columns.gross.x, y, { width: columns.gross.width, align: 'right' })
                   .text(`₹${(order.coupon.discount || 0).toFixed(2)}`, columns.discount.x, y, { width: columns.discount.width, align: 'right' })
                   .text(`₹${order.totalAmount.toFixed(2)}`, columns.amount.x, y, { width: columns.amount.width, align: 'right' });

                y += 20;
            });

            // Add line for total
            y += 10;
            doc.moveTo(50, y).lineTo(550, y).stroke();
            y += 20;

            // Add Totals section
            doc.fontSize(10);
            let totalY = y;

            // Update totals section alignment
            doc.text('Cart Total:', columns.discount.x, totalY, { width: columns.discount.width, align: 'left' })
               .text(`₹${order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)}`, 
                     columns.amount.x, totalY, { width: columns.amount.width, align: 'right' });
            totalY += 20;

            if (order.coupon.discount) {
                doc.text('Coupon Discount:', columns.discount.x, totalY, { width: columns.discount.width, align: 'left' })
                   .text(`-₹${order.coupon.discount.toFixed(2)}`, columns.amount.x, totalY, { width: columns.amount.width, align: 'right' });
                totalY += 20;
            }

            if (order.discount) {
                doc.text('Other Discounts:', columns.discount.x, totalY, { width: columns.discount.width, align: 'left' })
                   .text(`-₹${order.discount.toFixed(2)}`, columns.amount.x, totalY, { width: columns.amount.width, align: 'right' });
                totalY += 20;
            }

            // Total Amount with right alignment
            doc.font('Helvetica-Bold')
               .text('Total Amount:', columns.discount.x, totalY, { width: columns.discount.width, align: 'left' })
               .text(`₹${order.totalAmount.toFixed(2)}`, columns.amount.x, totalY, { width: columns.amount.width, align: 'right' });

            // Add footer
            doc.fontSize(8)
               .font('Helvetica')
               .text(
                    'This is a computer generated invoice and does not require a physical signature.',
                    50,
                    doc.page.height - 50,
                    { align: 'center' }
                );

            // Add Terms and Conditions
            doc.fontSize(8)
               .text(
                    'Terms & Conditions:',
                    50,
                    doc.page.height - 80,
                    { align: 'left' }
               )
               .text(
                    '1. All items are sold as per our standard terms and conditions.',
                    50,
                    doc.page.height - 70,
                    { align: 'left' }
               )
               .text(
                    '2. This invoice must be produced for any returns or exchanges.',
                    50,
                    doc.page.height - 60,
                    { align: 'left' }
               );

            // Finalize PDF
            doc.end();

        } catch (error) {
            console.error('Generate invoice error:', error);
            res.status(500).json({ 
                message: 'Error generating invoice',
                error: error.message 
            });
        }
    }
};

export default userOrderController; 