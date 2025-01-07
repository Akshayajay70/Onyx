import orderSchema from '../model/orderModel.js';
import Wallet from '../model/walletModel.js';
import productSchema from '../model/productModel.js';
import userSchema from '../model/userModel.js';
import PDFDocument from 'pdfkit';
import razorpay from '../config/razorpay.js';
import crypto from 'crypto';



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
            if (order.return.isReturnRequested) {
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
            order.return = {
                isReturnRequested: true,
                reason: reason,
                requestDate: new Date(),
                status: 'pending',
                adminComment: null,
                isReturnAccepted: false
            };

            // Add to status history
            order.order.statusHistory.push({
                status: 'return requested',
                date: new Date(),
                comment: `Return requested: ${reason}`
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
                message: error.message || 'Error processing return request'
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

            // Only allow invoice download for delivered or returned orders
            if (!['delivered', 'returned'].includes(order.order.status)) {
                return res.status(400).json({ 
                    message: 'Invoice is only available for delivered or returned orders' 
                });
            }

            // Create PDF document
            const doc = new PDFDocument({ margin: 50 });

            // Set response headers
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderCode}.pdf`);

            // Pipe PDF to response
            doc.pipe(res);

            // Generate separate invoice for each item
            order.items.forEach((item, index) => {
                if (index > 0) {
                    doc.addPage();
                }

                // Calculate base prices and taxes
                const TAX_RATE = 0.18;
                const CGST_RATE = 0.09;
                const SGST_RATE = 0.09;

                // Pre-tax calculations
                const preTaxPrice = item.price / (1 + TAX_RATE);
                const preTaxTotal = preTaxPrice * item.quantity;
                
                // Tax calculations
                const cgstAmount = preTaxTotal * CGST_RATE;
                const sgstAmount = preTaxTotal * SGST_RATE;
                const totalTax = cgstAmount + sgstAmount;

                // Discount calculations (if applicable)
                const originalTotal = preTaxTotal + totalTax;
                const finalAmount = item.subtotal; // This is already the discounted total
                const totalDiscount = originalTotal - finalAmount;

                // Add header with company logo and tax invoice text
                doc.fontSize(20)
                   .text('TAX INVOICE', { align: 'center' })
                   .moveDown();

                // Add company details (left side)
                doc.fontSize(10)
                   .text('Sold By:', 50)
                   .font('Helvetica-Bold')
                   .text('ONYX FASHION STORE')
                   .font('Helvetica')
                   .text('123 Fashion Street')
                   .text('Kerala, India - 682001')
                   .text('Phone: +91 9876543210')
                   .text('Email: support@onyx.com')
                   .text('GSTIN: 32ABCDE1234F1Z5');

                // Add Invoice Details (right side)
                doc.fontSize(10)
                   .text(`Invoice Number: ${order.orderCode}-${index + 1}`, 300, doc.y - 90)
                   .text(`Order Date: ${new Date(order.orderDate).toLocaleDateString('en-IN')}`, 300)
                   .text(`Invoice Date: ${new Date().toLocaleDateString('en-IN')}`, 300);

                // Add Billing Details
                doc.moveDown()
                   .text('Billing Address:')
                   .font('Helvetica-Bold')
                   .text(`${order.shippingAddress.fullName}`)
                   .font('Helvetica')
                   .text(order.shippingAddress.addressLine1)
                   .text(order.shippingAddress.addressLine2 || '')
                   .text(`${order.shippingAddress.city}, ${order.shippingAddress.state}`)
                   .text(`PIN: ${order.shippingAddress.pincode}`)
                   .text(`Phone: ${order.shippingAddress.mobileNumber}`)
                   .moveDown();

                // Product Details Table
                doc.font('Helvetica-Bold');
                const tableTop = doc.y + 20;

                // Table Headers
                doc.text('Product Details', 50, tableTop)
                    .text('HSN', 200, tableTop)
                    .text('Qty', 250, tableTop)
                    .text('Pre-tax Rate', 300, tableTop)
                    .text('Taxable Amount', 400, tableTop)
                    .text('Total', 500, tableTop);

                // Underline
                doc.moveTo(50, tableTop + 15)
                    .lineTo(550, tableTop + 15)
                    .stroke();

                // Product Details
                doc.font('Helvetica')
                    .text(item.product.productName, 50, tableTop + 30)
                    .text('6203', 200, tableTop + 30)
                    .text(item.quantity.toString(), 250, tableTop + 30)
                    .text(`₹${preTaxPrice.toFixed(2)}`, 300, tableTop + 30)
                    .text(`₹${preTaxTotal.toFixed(2)}`, 400, tableTop + 30)
                    .text(`₹${originalTotal.toFixed(2)}`, 500, tableTop + 30);

                // Price Breakdown
                const summaryTop = tableTop + 80;
                doc.moveTo(50, summaryTop).lineTo(550, summaryTop).stroke()
                    .font('Helvetica-Bold')
                    .text('Price Breakdown', 50, summaryTop + 20)
                    .font('Helvetica');

                // Detailed Summary
                let currentY = summaryTop + 40;
                
                // Pre-tax amount
                doc.text('Pre-tax Amount:', 350, currentY)
                    .text(`₹${preTaxTotal.toFixed(2)}`, 500, currentY);
                currentY += 20;

                // Tax details
                doc.text('CGST @ 9%:', 350, currentY)
                    .text(`₹${cgstAmount.toFixed(2)}`, 500, currentY);
                currentY += 20;

                doc.text('SGST @ 9%:', 350, currentY)
                    .text(`₹${sgstAmount.toFixed(2)}`, 500, currentY);
                currentY += 20;

                // Subtotal after tax
                doc.text('Total (Inc. Tax):', 350, currentY)
                    .text(`₹${originalTotal.toFixed(2)}`, 500, currentY);
                currentY += 20;

                // Discount (if applicable)
                if (totalDiscount > 0) {
                    doc.text('Discount Applied:', 350, currentY)
                        .text(`-₹${totalDiscount.toFixed(2)}`, 500, currentY);
                    currentY += 20;
                }

                // Final amount
                doc.moveTo(350, currentY).lineTo(550, currentY).stroke();
                currentY += 10;
                doc.font('Helvetica-Bold')
                    .text('Final Amount:', 350, currentY)
                    .text(`₹${finalAmount.toFixed(2)}`, 500, currentY);

                // Amount in words
                currentY += 40;
                doc.font('Helvetica')
                    .text('Amount in Words:', 50, currentY)
                    .text(`${numberToWords(Math.round(finalAmount))} Rupees Only`, 150, currentY);

                // Add Footer (within the page)
                const footerTop = doc.page.height - 120;
                
                // Footer Border Top
                doc.moveTo(50, footerTop).lineTo(550, footerTop).stroke();

                // Footer Content
                doc.fontSize(8)
                   .font('Helvetica')
                   .text('Terms & Conditions:', 50, footerTop + 10)
                   .text('1. This is a computer generated invoice.', 50, footerTop + 25)
                   .text('2. All disputes are subject to Kerala jurisdiction.', 50, footerTop + 35)
                   .text('3. E. & O. E.', 50, footerTop + 45);

                // Company Details in Footer
                doc.fontSize(8)
                   .text('ONYX FASHION STORE', 350, footerTop + 10)
                   .text('123 Fashion Street, Kerala - 682001', 350, footerTop + 25)
                   .text('Email: support@onyx.com | Phone: +91 9876543210', 350, footerTop + 35)
                   .text('GSTIN: 32ABCDE1234F1Z5', 350, footerTop + 45);

                // Footer Border Bottom
                doc.moveTo(50, footerTop + 70).lineTo(550, footerTop + 70).stroke();

            });

            // Finalize PDF
            doc.end();

        } catch (error) {
            console.error('Generate invoice error:', error);
            res.status(500).json({ 
                message: 'Error generating invoice',
                error: error.message 
            });
        }
    },

    retryPayment: async (req, res) => {
        try {
            const { orderId } = req.params;
            const userId = req.session.user;

            // Find the order with pending status
            const order = await orderSchema.findOne({
                _id: orderId,
                userId,
                'payment.method': 'razorpay',
                'order.status': 'pending',
                'payment.paymentStatus': 'failed'
            });

            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: 'Order not found or payment retry not available'
                });
            }

            // Create new Razorpay order
            const razorpayOrder = await razorpay.orders.create({
                amount: Math.round(order.totalAmount * 100), // Convert to paise
                currency: "INR",
                receipt: `retry_${orderId}`
            });

            // Store order details in session for verification
            req.session.pendingOrder = {
                orderId: order._id,
                razorpayOrderId: razorpayOrder.id,
                orderData: {
                    userId,
                    items: order.items,
                    totalAmount: order.totalAmount,
                    coupon: order.coupon || {},
                    shippingAddress: order.shippingAddress
                }
            };

            // Update order with new Razorpay order ID
            await orderSchema.findByIdAndUpdate(orderId, {
                'payment.razorpayTransaction.razorpayOrderId': razorpayOrder.id,
                'payment.paymentStatus': 'failed',
                'order.statusHistory': [
                    ...order.order.statusHistory,
                    {
                        status: 'pending',
                        date: new Date(),
                        comment: 'Payment retry initiated'
                    }
                ]
            });

            res.json({
                success: true,
                key: process.env.RAZORPAY_KEY_ID,
                order: razorpayOrder,
                orderDetails: {
                    amount: order.totalAmount,
                    email: order.userId.email,
                    contact: order.shippingAddress.mobileNumber,
                    name: order.shippingAddress.fullName
                }
            });

        } catch (error) {
            console.error('Retry payment error:', error);
            res.status(500).json({
                success: false,
                message: 'Error processing payment retry'
            });
        }
    },

    verifyRetryPayment: async (req, res) => {
        try {
            const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId, error } = req.body;
            const userId = req.session.user;

            // If there's a payment error, update order with failed status
            if (error) {
                await orderSchema.findByIdAndUpdate(orderId, {
                    'payment.paymentStatus': 'failed',
                    'order.status': 'pending',
                    $push: {
                        'order.statusHistory': {
                            status: 'pending',
                            date: new Date(),
                            comment: 'Payment retry failed: ' + (error.description || 'Payment was not completed')
                        }
                    }
                });

                return res.status(400).json({
                    success: false,
                    message: 'Payment failed',
                    error: error.description || 'Payment was not completed'
                });
            }

            // Verify the Razorpay signature
            const sign = razorpay_order_id + "|" + razorpay_payment_id;
            const expectedSign = crypto
                .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
                .update(sign.toString())
                .digest("hex");

            if (razorpay_signature !== expectedSign) {
                await orderSchema.findByIdAndUpdate(orderId, {
                    'payment.paymentStatus': 'failed',
                    'order.status': 'pending',
                    $push: {
                        'order.statusHistory': {
                            status: 'pending',
                            date: new Date(),
                            comment: 'Invalid payment signature'
                        }
                    }
                });

                return res.status(400).json({
                    success: false,
                    message: 'Invalid payment signature'
                });
            }

            // Find the order and populate product details
            const order = await orderSchema.findOne({ 
                _id: orderId,
                userId,
                'payment.method': 'razorpay'
            }).populate({
                path: 'items.product',
                model: 'Product'
            });

            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: 'Order not found'
                });
            }

            // Update product stock
            try {
                for (const item of order.items) {
                    const product = await productSchema.findById(item.product._id);
                    if (!product) {
                        throw new Error(`Product not found: ${item.product._id}`);
                    }
                    
                    if (product.stock < item.quantity) {
                        throw new Error(`Insufficient stock for ${product.productName}`);
                    }

                    product.stock = product.stock - item.quantity;
                    await product.save();
                }
            } catch (error) {
                // If stock update fails, maintain failed payment status
                await orderSchema.findByIdAndUpdate(orderId, {
                    'payment.paymentStatus': 'failed',
                    'order.status': 'pending',
                    $push: {
                        'order.statusHistory': {
                            status: 'pending',
                            date: new Date(),
                            comment: `Stock update failed: ${error.message}`
                        }
                    }
                });

                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }

            // Update order status on successful payment
            const updatedOrder = await orderSchema.findByIdAndUpdate(
                orderId,
                {
                    $set: {
                        'payment.paymentStatus': 'completed',
                        'payment.razorpayTransaction.razorpayPaymentId': razorpay_payment_id,
                        'payment.razorpayTransaction.razorpaySignature': razorpay_signature,
                        'order.status': 'processing',
                    },
                    $push: {
                        'order.statusHistory': {
                            status: 'processing',
                            date: new Date(),
                            comment: 'Payment completed successfully'
                        }
                    }
                },
                { new: true }
            );

            if (!updatedOrder) {
                throw new Error('Failed to update order status');
            }

            res.json({
                success: true,
                message: 'Payment successful'
            });

        } catch (error) {
            console.error('Verify retry payment error:', error);
            
            // Update order with failed status on any other error
            await orderSchema.findByIdAndUpdate(orderId, {
                'payment.paymentStatus': 'failed',
                'order.status': 'pending',
                $push: {
                    'order.statusHistory': {
                        status: 'pending',
                        date: new Date(),
                        comment: `Payment verification failed: ${error.message}`
                    }
                }
            });

            res.status(500).json({
                success: false,
                message: error.message || 'Error verifying payment'
            });
        }
    }
};

// Helper function to convert number to words
function numberToWords(number) {
    // Add your number to words conversion logic here
    // You can use a library like 'number-to-words' or implement your own
    return number.toString(); // Placeholder return
}

export default userOrderController; 