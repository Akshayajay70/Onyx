import cartSchema from '../model/cartModel.js';
import orderSchema from '../model/orderModel.js';
import addressSchema from '../model/addressModel.js';
import productSchema from '../model/productModel.js';
import Coupon from '../model/couponModel.js';
import razorpay from '../utils/razorpay.js';
import crypto from 'crypto';
import Wallet from '../model/walletModel.js';

// Helper function (keep this at the top of the file)
function calculateProportionalDiscounts(items, totalDiscount) {
    const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    return items.map(item => {
        const itemTotal = item.price * item.quantity;
        const proportionalRatio = itemTotal / totalAmount;
        const itemDiscount = totalDiscount * proportionalRatio;
        const discountPerUnit = itemDiscount / item.quantity;
        return {
            ...item,
            discountedPrice: Number((item.price - discountPerUnit).toFixed(2)),
            subtotal: Number((item.quantity * (item.price - discountPerUnit)).toFixed(2))
        };
    });
}

const userCheckoutController = {
    getCheckoutPage: async (req, res) => {
        try {
            // Get user's addresses
            const addresses = await addressSchema.find({ userId: req.session.user });

            // Get cart items with populated product details
            const cart = await cartSchema.findOne({ userId: req.session.user });
            
            if (!cart || cart.items.length === 0) {
                return res.redirect('/cart');
            }

            // Populate product details and calculate subtotals
            const populatedCart = await cartSchema.findOne({ userId: req.session.user })
                .populate({
                    path: 'items.productId',
                    model: 'Product',
                    select: 'productName imageUrl price stock'
                });

            // Check stock availability
            const stockCheck = populatedCart.items.every(item => 
                item.productId.stock >= item.quantity
            );

            if (!stockCheck) {
                return res.redirect('/cart?error=stock');
            }

            // Format cart items for the template
            const cartItems = populatedCart.items.map(item => ({
                product: {
                    _id: item.productId._id,
                    productName: item.productId.productName,
                    imageUrl: item.productId.imageUrl,
                },
                quantity: item.quantity,
                price: item.price,
                subtotal: item.quantity * item.price
            }));

            // Calculate total
            const total = cartItems.reduce((sum, item) => sum + item.subtotal, 0);

            let wallet = await Wallet.findOne({ userId: req.session.user });
            if (!wallet) {
                wallet = await Wallet.create({ 
                    userId: req.session.user,
                    balance: 0,
                    transactions: []
                });
            }

            // Calculate total after any applied coupon
            let couponDiscount = 0;
            const appliedCouponCode = req.session.appliedCoupon;
            if (appliedCouponCode) {
                const coupon = await Coupon.findOne({ code: appliedCouponCode });
                if (coupon) {
                    couponDiscount = Math.min(
                        (total * coupon.discountPercentage) / 100,
                        coupon.maximumDiscount || Infinity
                    );
                }
            }
            const finalTotal = total - couponDiscount;

            res.render('user/checkout', {
                addresses,
                cartItems,
                total,
                finalTotal,
                user: req.session.user,
                wallet,
                appliedCouponCode
            });
        } catch (error) {
            console.error('Checkout page error:', error);
            res.status(500).render('error', { 
                message: 'Error loading checkout page',
                user: req.session.user
            });
        }
    },

    placeOrder: async (req, res) => {
        try {
            const { addressId, paymentMethod, couponCode } = req.body;
            const userId = req.session.user;

            // Get cart and validate
            const cart = await cartSchema.findOne({ userId })
                .populate('items.productId');

            if (!cart || cart.items.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Cart is empty'
                });
            }

            // Calculate total amount with coupon discount
            const cartTotal = cart.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
            let couponDiscount = 0;
            if (couponCode) {
                const coupon = await Coupon.findOne({ code: couponCode });
                if (coupon) {
                    couponDiscount = Math.min(
                        (cartTotal * coupon.discountPercentage) / 100,
                        coupon.maximumDiscount || Infinity
                    );
                }
            }
            const finalAmount = cartTotal - couponDiscount;

            // Validate COD payment method
            if (paymentMethod === 'cod' && finalAmount > 1000) {
                return res.status(400).json({
                    success: false,
                    message: 'Cash on Delivery is not available for orders above ₹1,000. Please choose a different payment method.'
                });
            }

            // Prepare initial items with basic info
            const initialItems = cart.items.map(item => ({
                product: item.productId._id,
                quantity: item.quantity,
                price: item.price
            }));

            // Calculate proportional discounts
            const discountedItems = calculateProportionalDiscounts(initialItems, couponDiscount);

            const totalAmount = discountedItems.reduce((sum, item) => sum + item.subtotal, 0);
            // Add order status and return fields to each item
            const orderItems = discountedItems.map(item => ({
                ...item,
                order: {
                    status: paymentMethod === 'cod' ? 'processing' : 'pending',
                    statusHistory: [{
                        status: paymentMethod === 'cod' ? 'processing' : 'pending',
                        date: new Date(),
                        comment: paymentMethod === 'cod' ? 
                            'Order confirmed with Cash on Delivery' : 
                            'Order placed, awaiting payment'
                    }]
                },
                return: {
                    isReturnRequested: false,
                    reason: null,
                    requestDate: null,
                    status: null,
                    adminComment: null,
                    isReturnAccepted: false
                }
            }));

            // Get address
            const address = await addressSchema.findOne({
                _id: addressId,
                userId
            });

            if (!address) {
                return res.status(400).json({
                    success: false,
                    message: 'Delivery address not found'
                });
            }
            
            const order = await orderSchema.create({
                userId,
                items: orderItems,
                totalAmount: Math.round(totalAmount),
                coupon: couponCode ? {
                    code: couponCode,
                    discount: couponDiscount
                } : {},
                shippingAddress: {
                    fullName: address.fullName,
                    mobileNumber: address.mobileNumber,
                    addressLine1: address.addressLine1,
                    addressLine2: address.addressLine2,
                    city: address.city,
                    state: address.state,
                    pincode: address.pincode
                },
                payment: {
                    method: paymentMethod,
                    paymentStatus: paymentMethod === 'cod' ? 'processing' : 'completed'
                }
            });

            // Update product stock
            for (const item of orderItems) {
                await productSchema.findByIdAndUpdate(
                    item.product,
                    { $inc: { stock: -item.quantity } }
                );
            }

            // Clear cart
            await cartSchema.findByIdAndUpdate(cart._id, {
                items: [],
                totalAmount: 0
            });

            // Update coupon usage if applicable
            if (couponCode) {
                await Coupon.findOneAndUpdate(
                    { code: couponCode },
                    {
                        $inc: { usedCouponCount: 1 },
                        $push: {
                            usedBy: {
                                userId,
                                orderId: order._id
                            }
                        }
                    }
                );
            }

            res.json({
                success: true,
                message: 'Order placed successfully',
                orderId: order.orderCode
            });

        } catch (error) {
            console.error('Place order error:', error);
            res.status(500).json({
                success: false,
                message: 'Error placing order'
            });
        }
    },

    applyCoupon: async (req, res) => {
        try {
            const { code } = req.body;
            const userId = req.session.user;

            // Find the coupon
            const coupon = await Coupon.findOne({ 
                code: code.toUpperCase(),
                isActive: true,
                startDate: { $lte: new Date() },
                expiryDate: { $gte: new Date() }
            });

            if (!coupon) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Invalid or expired coupon code' 
                });
            }

            // Check if coupon limit is reached
            if (coupon.totalCoupon && coupon.usedCouponCount >= coupon.totalCoupon) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Coupon limit has been reached' 
                });
            }

            // Check user usage limit
            const userUsageCount = coupon.usedBy.filter(
                usage => usage.userId.toString() === userId.toString()
            ).length;

            if (userUsageCount >= coupon.userUsageLimit) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'You have already used this coupon' 
                });
            }

            // Get cart total
            const cart = await cartSchema.findOne({ userId })
                .populate('items.productId');

            const cartTotal = cart.items.reduce(
                (sum, item) => sum + (item.quantity * item.price), 
                0
            );

            // Check minimum purchase requirement
            if (cartTotal < coupon.minimumPurchase) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Minimum purchase of ₹${coupon.minimumPurchase} required` 
                });
            }

            // Calculate discount
            let discount = (cartTotal * coupon.discountPercentage) / 100;
            if (coupon.maximumDiscount) {
                discount = Math.min(discount, coupon.maximumDiscount);
            }

            res.json({
                success: true,
                discount,
                couponCode: coupon.code,
                message: 'Coupon applied successfully'
            });

        } catch (error) {
            console.error('Apply coupon error:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Error applying coupon' 
            });
        }
    },

    removeCoupon: async (req, res) => {
        try {
            res.json({
                success: true,
                message: 'Coupon removed successfully'
            });
        } catch (error) {
            console.error('Remove coupon error:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Error removing coupon' 
            });
        }
    },

    getAvailableCoupons: async (req, res) => {
        try {
            const userId = req.session.user;

            // Get only active coupons within valid date range
            const coupons = await Coupon.find({
                isActive: true,
                startDate: { $lte: new Date() },
                expiryDate: { $gte: new Date() }
            }).select('-usedBy');

            // Get user's cart total for minimum purchase validation
            const cart = await cartSchema.findOne({ userId })
                .populate('items.productId');

            const cartTotal = cart.items.reduce(
                (sum, item) => sum + (item.quantity * item.price), 
                0
            );

            // Add validation info to each coupon
            const processedCoupons = await Promise.all(coupons.map(async (coupon) => {
                const userUsageCount = await Coupon.countDocuments({
                    code: coupon.code,
                    'usedBy.userId': userId
                });

                return {
                    ...coupon.toObject(),
                    isApplicable: 
                        cartTotal >= coupon.minimumPurchase &&
                        (!coupon.totalCoupon || coupon.usedCouponCount < coupon.totalCoupon) &&
                        userUsageCount < coupon.userUsageLimit
                };
            }));

            res.json({
                success: true,
                coupons: processedCoupons
            });

        } catch (error) {
            console.error('Get available coupons error:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Error fetching available coupons' 
            });
        }
    },

    createRazorpayOrder: async (req, res) => {
        try {
            const userId = req.session.user;
            const { addressId, couponCode } = req.body;

            // Get cart and validate
            const cart = await cartSchema.findOne({ userId })
                .populate('items.productId');

            if (!cart || cart.items.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Cart is empty'
                });
            }

            // Get address
            const address = await addressSchema.findOne({
                _id: addressId,
                userId
            });

            if (!address) {
                return res.status(400).json({
                    success: false,
                    message: 'Delivery address not found'
                });
            }

            // Calculate total with coupon discount
            const cartTotal = cart.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
            let couponDiscount = 0;
            if (couponCode) {
                const coupon = await Coupon.findOne({ code: couponCode });
                if (coupon) {
                    couponDiscount = Math.min(
                        (cartTotal * coupon.discountPercentage) / 100,
                        coupon.maximumDiscount || Infinity
                    );
                }
            }
            const finalAmount = cartTotal - couponDiscount;

            // Create Razorpay order
            const razorpayOrder = await razorpay.orders.create({
                amount: Math.round(finalAmount * 100), // Convert to paise
                currency: "INR",
                receipt: `order_${Date.now()}`
            });

            // Prepare initial items with basic info
            const initialItems = cart.items.map(item => ({
                product: item.productId._id,
                quantity: item.quantity,
                price: item.price
            }));

            // Calculate proportional discounts and prepare order items
            const discountedItems = calculateProportionalDiscounts(initialItems, couponDiscount);
            const orderItems = discountedItems.map(item => ({
                ...item,
                order: {
                    status: 'processing',
                    statusHistory: [{
                        status: 'processing',
                        date: new Date(),
                        comment: 'payment completed successfully'
                    }]
                }
            }));

            // Store order details in session
            req.session.pendingOrder = {
                razorpayOrderId: razorpayOrder.id,
                orderData: {
                    userId,
                    items: orderItems,
                    totalAmount: finalAmount,
                    coupon: couponCode ? {
                        code: couponCode,
                        discount: couponDiscount
                    } : {},
                    shippingAddress: {
                        fullName: address.fullName,
                        mobileNumber: address.mobileNumber,
                        addressLine1: address.addressLine1,
                        addressLine2: address.addressLine2,
                        city: address.city,
                        state: address.state,
                        pincode: address.pincode
                    }
                }
            };

            res.json({
                success: true,
                key: process.env.RAZORPAY_KEY_ID,
                order: razorpayOrder
            });

        } catch (error) {
            console.error('Create Razorpay order error:', error);
            res.status(500).json({
                success: false,
                message: 'Error creating payment order'
            });
        }
    },

    verifyPayment: async (req, res) => {
        try {
            const userId = req.session.user;
            const {
                razorpay_order_id,
                razorpay_payment_id,
                razorpay_signature,
                orderId
            } = req.body;

            // Verify signature
            const sign = razorpay_order_id + "|" + razorpay_payment_id;
            const expectedSign = crypto
                .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
                .update(sign.toString())
                .digest("hex");

            if (razorpay_signature !== expectedSign) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid payment signature'
                });
            }

            // Handle payment retry case
            if (orderId) {
                const order = await orderSchema.findOne({ 
                    _id: orderId,
                    userId,
                    'payment.method': 'razorpay'
                });

                if (!order) {
                    return res.status(404).json({
                        success: false,
                        message: 'Order not found or already processed'
                    });
                }

                // Update order with payment details
                order.payment.paymentStatus = 'completed';
                order.payment.razorpayTransaction = {
                    razorpayOrderId: razorpay_order_id,
                    razorpayPaymentId: razorpay_payment_id,
                    razorpaySignature: razorpay_signature
                };

                // Update status for all items
                order.items.forEach(item => {
                    item.order.status = 'processing';
                    item.order.statusHistory.push({
                        status: 'processing',
                        date: new Date(),
                        comment: 'Payment completed successfully'
                    });
                });

                await order.save();

                return res.json({
                    success: true,
                    message: 'Payment verified successfully',
                    orderId: order.orderCode
                });
            }

            // Handle new order case
            const pendingOrder = req.session.pendingOrder;
            if (!pendingOrder || pendingOrder.razorpayOrderId !== razorpay_order_id) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid order session'
                });
            }

            // Get cart and validate
            const cart = await cartSchema.findOne({ userId })
                .populate('items.productId');

            if (!cart || cart.items.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Cart is empty'
                });
            }

            // Create order with completed payment status
            const order = await orderSchema.create({
                ...pendingOrder.orderData,
                payment: {
                    method: 'razorpay',
                    paymentStatus: 'completed',
                    razorpayTransaction: {
                        razorpayOrderId: razorpay_order_id,
                        razorpayPaymentId: razorpay_payment_id,
                        razorpaySignature: razorpay_signature
                    }
                }
            });

            // Update product stock
            for (const item of cart.items) {
                await productSchema.findByIdAndUpdate(
                    item.productId._id,
                    { $inc: { stock: -item.quantity } }
                );
            }

            // Clear cart
            await cartSchema.findByIdAndUpdate(cart._id, {
                items: [],
                totalAmount: 0
            });

            // Clear session data
            delete req.session.pendingOrder;
            delete req.session.appliedCoupon;

            res.json({
                success: true,
                message: 'Order placed successfully',
                orderId: order.orderCode
            });

        } catch (error) {
            console.error('Verify payment error:', error);
            res.status(500).json({
                success: false,
                message: 'Error verifying payment'
            });
        }
    },

    walletPayment: async (req, res) => {
        try {
            const userId = req.session.user;
            const { addressId, couponCode } = req.body;

            // Get cart and validate
            const cart = await cartSchema.findOne({ userId })
                .populate('items.productId');

            if (!cart || cart.items.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Cart is empty'
                });
            }

            // Calculate cart total and coupon discount
            const cartTotal = cart.items.reduce(
                (sum, item) => sum + (item.quantity * item.price), 
                0
            );
            
            let couponDiscount = 0;
            if (couponCode) {
                const coupon = await Coupon.findOne({ code: couponCode });
                if (coupon) {
                    couponDiscount = (cartTotal * coupon.discountPercentage) / 100;
                    if (coupon.maximumDiscount) {
                        couponDiscount = Math.min(couponDiscount, coupon.maximumDiscount);
                    }
                }
            }

            // Prepare initial items
            const initialItems = cart.items.map(item => ({
                product: item.productId._id,
                quantity: item.quantity,
                price: item.price
            }));

            // Calculate proportional discounts
            const discountedItems = calculateProportionalDiscounts(initialItems, couponDiscount);

            // Add order status and return fields to each item
            const orderItems = discountedItems.map(item => ({
                ...item,
                order: {
                    status: 'processing',
                    statusHistory: [{
                        status: 'processing',
                        date: new Date(),
                        comment: 'Order placed using wallet payment'
                    }]
                },
                return: {
                    isReturnRequested: false,
                    reason: null,
                    requestDate: null,
                    status: null,
                    adminComment: null,
                    isReturnAccepted: false
                }
            }));

            // Calculate final total amount
            const totalAmount = orderItems.reduce((sum, item) => sum + item.subtotal, 0);

            // Get wallet and check balance
            const wallet = await Wallet.findOne({ userId });
            if (!wallet || wallet.balance < totalAmount) {
                return res.status(400).json({
                    success: false,
                    message: 'Insufficient wallet balance'
                });
            }

            // Get address details
            const address = await addressSchema.findOne({
                _id: addressId,
                userId
            });

            if (!address) {
                return res.status(400).json({
                    success: false,
                    message: 'Delivery address not found'
                });
            }

            // Create order
            const order = await orderSchema.create({
                userId,
                items: orderItems,
                totalAmount: Math.round(totalAmount),
                coupon: couponCode ? {
                    code: couponCode,
                    discount: couponDiscount
                } : {},
                shippingAddress: {
                    fullName: address.fullName,
                    mobileNumber: address.mobileNumber,
                    addressLine1: address.addressLine1,
                    addressLine2: address.addressLine2,
                    city: address.city,
                    state: address.state,
                    pincode: address.pincode
                },
                payment: {
                    method: 'wallet',
                    paymentStatus: 'completed',
                    walletTransaction: {
                        amount: totalAmount
                    }
                }
            });

            // Update product stock
            for (const item of orderItems) {
                await productSchema.findByIdAndUpdate(
                    item.product,
                    { $inc: { stock: -item.quantity } }
                );
            }

            // Clear cart
            await cartSchema.findByIdAndUpdate(cart._id, {
                items: [],
                totalAmount: 0
            });

            // Update wallet balance and add transaction
            const walletTransaction = {
                type: 'debit',
                amount: totalAmount,
                description: `Payment for order #${order.orderCode}`,
                orderId: order._id,
                date: new Date()
            };

            wallet.balance -= totalAmount;
            wallet.transactions.push(walletTransaction);
            await wallet.save();

            // Update coupon usage if applicable
            if (couponCode) {
                await Coupon.findOneAndUpdate(
                    { code: couponCode },
                    {
                        $inc: { usedCouponCount: 1 },
                        $push: {
                            usedBy: {
                                userId,
                                orderId: order._id
                            }
                        }
                    }
                );
            }

            res.json({
                success: true,
                message: 'Order placed successfully',
                orderId: order.orderCode
            });

        } catch (error) {
            console.error('Wallet payment error:', error);
            res.status(500).json({
                success: false,
                message: 'Error processing wallet payment'
            });
        }
    },

    handlePaymentFailure: async (req, res) => {
        try {
            const { error, razorpay_order_id } = req.body;
            const userId = req.session.user;
            const pendingOrder = req.session.pendingOrder;

            if (!pendingOrder) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid order session'
                });
            }

            // Update order items with pending status
            const orderItems = pendingOrder.orderData.items.map(item => ({
                ...item,
                order: {
                    status: 'pending',
                    statusHistory: [{
                        status: 'pending',
                        date: new Date(),
                        comment: 'Payment failed: ' + (error.description || 'Payment was not completed')
                    }]
                }
            }));

            // Create or update order with failed status
            const orderData = {
                ...pendingOrder.orderData,
                items: orderItems,
                payment: {
                    method: 'razorpay',
                    paymentStatus: 'failed',
                    razorpayTransaction: {
                        razorpayOrderId: razorpay_order_id
                    }
                }
            };

            let order;
            if (pendingOrder.orderId) {
                // Update existing failed order
                order = await orderSchema.findByIdAndUpdate(
                    pendingOrder.orderId,
                    orderData,
                    { new: true }
                );
            } else {
                // Create new failed order
                order = await orderSchema.create(orderData);
            }

            // Clear the cart after creating the order
            const cart = await cartSchema.findOne({ userId });
            if (cart) {
                await cartSchema.findByIdAndUpdate(cart._id, {
                    items: [],
                    totalAmount: 0
                });
            }

            // Clear the pending order from session
            delete req.session.pendingOrder;

            res.json({
                success: false,
                message: 'Payment failed',
                orderId: order.orderCode,
                error: error.description || 'Payment was not completed'
            });

        } catch (error) {
            console.error('Handle payment failure error:', error);
            res.status(500).json({
                success: false,
                message: 'Error handling payment failure'
            });
        }
    }
};

export default userCheckoutController;
