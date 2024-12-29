import cartSchema from '../model/cartModel.js';
import orderSchema from '../model/orderModel.js';
import addressSchema from '../model/addressModel.js';
import productSchema from '../model/productModel.js';
import Coupon from '../model/couponModel.js';
import razorpay from '../config/razorpay.js';
import crypto from 'crypto';
import Wallet from '../model/walletModel.js';

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

            res.render('user/checkout', {
                addresses,
                cartItems,
                total,
                user: req.session.user,
                wallet
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

            // Find coupon if code exists
            let coupon = null;
            let discount = 0;
            if (couponCode) {
                coupon = await Coupon.findOne({ code: couponCode });
                if (coupon) {
                    // Get cart total for discount calculation
                    const cart = await cartSchema.findOne({ userId })
                        .populate('items.productId');
                    const cartTotal = cart.items.reduce(
                        (sum, item) => sum + (item.quantity * item.price), 
                        0
                    );
                    
                    // Calculate discount
                    discount = (cartTotal * coupon.discountPercentage) / 100;
                    if (coupon.maximumDiscount) {
                        discount = Math.min(discount, coupon.maximumDiscount);
                    }
                }
            }

            // Get cart with populated product details
            const cart = await cartSchema.findOne({ userId })
                .populate('items.productId');

            if (!cart || cart.items.length === 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Cart is empty' 
                });
            }

            // Check stock availability and update stock
            for (const item of cart.items) {
                const product = await productSchema.findById(item.productId);
                
                if (!product || product.stock < item.quantity) {
                    return res.status(400).json({ 
                        success: false, 
                        message: `Insufficient stock for ${product ? product.productName : 'a product'}`
                    });
                }

                // Update product stock
                product.stock -= item.quantity;
                await product.save();
            }

            // Get shipping address
            const address = await addressSchema.findOne({
                _id: addressId,
                userId: userId
            });

            if (!address) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Invalid address' 
                });
            }

            // Create order items array
            const orderItems = cart.items.map(item => ({
                product: item.productId._id,
                quantity: item.quantity,
                price: item.price,
                subtotal: item.quantity * item.price
            }));

            // Calculate total
            const total = orderItems.reduce((sum, item) => sum + item.subtotal, 0);

            // Create new order
            const newOrder = new orderSchema({
                userId,
                items: orderItems,
                totalAmount: total - discount,
                shippingAddress: {
                    fullName: address.fullName,
                    mobileNumber: address.mobileNumber,
                    addressLine1: address.addressLine1,
                    addressLine2: address.addressLine2,
                    city: address.city,
                    state: address.state,
                    pincode: address.pincode
                },
                paymentMethod,
                paymentStatus: 'pending',
                orderStatus: 'processing',
                orderDate: new Date(),
                couponCode: couponCode,
                couponDiscount: discount,
            });

            await newOrder.save();

            // Update coupon usage after order is created
            if (coupon) {
                coupon.usedCouponCount += 1;
                coupon.usedBy.push({
                    userId,
                    orderId: newOrder._id
                });
                await coupon.save();
            }

            // Clear cart
            await cartSchema.findOneAndUpdate(
                { userId },
                { $set: { items: [] } }
            );

            res.status(200).json({ 
                success: true, 
                message: 'Order placed successfully',
                orderId: newOrder._id 
            });

        } catch (error) {
            console.error('Place order error:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to place order' 
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
            const { addressId, amount, couponCode } = req.body;

            // Validate amount limits
            if (!amount || amount < 1) {
                return res.status(400).json({
                    success: false,
                    message: 'Minimum order amount should be ₹1'
                });
            }

            if (amount > 500000) {
                return res.status(400).json({
                    success: false,
                    message: 'Maximum order amount cannot exceed ₹5,00,000'
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

            // Convert to paise and ensure it's an integer
            const amountInPaise = Math.round(amount * 100);

            // Create Razorpay order
            const options = {
                amount: amountInPaise,
                currency: "INR",
                receipt: `ord_${Date.now()}`
            };

            const razorpayOrder = await razorpay.orders.create(options);

            // Store cart details in session for verification
            req.session.pendingOrder = {
                cartId: cart._id,
                addressId,
                amount,
                couponCode,
                razorpayOrderId: razorpayOrder.id
            };

            res.json({
                success: true,
                order: razorpayOrder,
                key: process.env.RAZORPAY_KEY_ID
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
                razorpay_signature
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

            // Get pending order details from session
            const pendingOrder = req.session.pendingOrder;
            if (!pendingOrder || pendingOrder.razorpayOrderId !== razorpay_order_id) {
                return res.status(400).json({
                    success: false,
                    message: 'Order details not found'
                });
            }

            // Get cart details
            const cart = await cartSchema.findOne({ userId })
                .populate('items.productId');

            if (!cart || cart.items.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Cart is empty'
                });
            }

            // Check stock availability and update stock
            for (const item of cart.items) {
                const product = await productSchema.findById(item.productId._id);
                if (!product || product.stock < item.quantity) {
                    return res.status(400).json({
                        success: false,
                        message: `Insufficient stock for ${product ? product.productName : 'a product'}`
                    });
                }
                // Update stock
                product.stock -= item.quantity;
                await product.save();
            }

            // Get address
            const address = await addressSchema.findOne({
                _id: pendingOrder.addressId,
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
                items: cart.items.map(item => ({
                    product: item.productId._id,
                    quantity: item.quantity,
                    price: item.price,
                    subtotal: item.quantity * item.price,
                })),
                totalAmount: pendingOrder.amount,
                shippingAddress: {
                    fullName: address.fullName,
                    mobileNumber: address.mobileNumber,
                    addressLine1: address.addressLine1,
                    addressLine2: address.addressLine2,
                    city: address.city,
                    state: address.state,
                    pincode: address.pincode
                },
                paymentMethod: 'online',
                paymentStatus: 'completed',
                orderStatus: 'processing',
                couponCode: pendingOrder.couponCode,
                couponDiscount: cart.items.reduce((sum, item) => sum + (item.quantity * item.price), 0) - pendingOrder.amount,
                razorpayOrderId: razorpay_order_id,
                razorpayPaymentId: razorpay_payment_id
            });

            // Update coupon usage if applicable
            if (pendingOrder.couponCode) {
                await Coupon.findOneAndUpdate(
                    { code: pendingOrder.couponCode },
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

            // Clear cart
            await cartSchema.findByIdAndUpdate(cart._id, {
                $set: { items: [] }
            });

            // Clear pending order from session
            delete req.session.pendingOrder;

            res.json({
                success: true,
                message: 'Payment verified and order placed successfully',
                orderId: order._id
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
            const { addressId, amount, couponCode } = req.body;

            // Validate amount
            if (!amount || amount < 1) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid order amount'
                });
            }

            const coupon = await Coupon.findOne({ code: couponCode });
            if (coupon) {
                var couponDiscountPercentage = coupon.discountPercentage;
            }

            // Get cart details
            const cart = await cartSchema.findOne({ userId })
                .populate('items.productId');

            if (!cart || cart.items.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Cart is empty'
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

            // Check stock availability
            for (const item of cart.items) {
                const product = await productSchema.findById(item.productId);
                if (!product || product.stock < item.quantity) {
                    return res.status(400).json({
                        success: false,
                        message: `Insufficient stock for ${product ? product.productName : 'a product'}`
                    });
                }
            }

            // Get wallet
            const wallet = await Wallet.findOne({ userId });
            if (!wallet || wallet.balance < amount) {
                return res.status(400).json({
                    success: false,
                    message: 'Insufficient wallet balance'
                });
            }

            // Create order items array
            const orderItems = cart.items.map(item => ({
                product: item.productId._id,
                quantity: item.quantity,
                price: item.price,
                subtotal: item.quantity * item.price,
                couponDiscountPercentage: couponDiscountPercentage
            }));

            // Create order with discounted amount and shipping details
            const order = await orderSchema.create({
                userId,
                items: orderItems,
                totalAmount: amount,
                shippingAddress: {
                    fullName: address.fullName,
                    mobileNumber: address.mobileNumber,
                    addressLine1: address.addressLine1,
                    addressLine2: address.addressLine2,
                    city: address.city,
                    state: address.state,
                    pincode: address.pincode
                },
                paymentMethod: 'wallet',
                paymentStatus: 'completed',
                orderStatus: 'pending',
                couponCode: couponCode,
                couponDiscount: orderItems.reduce((sum, item) => sum + item.subtotal, 0) - amount,
                statusHistory: [{
                    status: 'pending',
                    date: new Date(),
                    comment: 'Order placed using wallet payment'
                }]
            });

            // Update product stock
            for (const item of cart.items) {
                await productSchema.findByIdAndUpdate(
                    item.productId,
                    { $inc: { stock: -item.quantity } }
                );
            }

            // Update wallet balance
            wallet.balance -= amount;
            wallet.transactions.push({
                type: 'debit',
                amount: amount,
                description: `Payment for order #${order._id}`,
                orderId: order._id,
                date: new Date()
            });
            await wallet.save();

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
                orderId: order._id
            });

        } catch (error) {
            console.error('Wallet payment error:', error);
            res.status(500).json({
                success: false,
                message: 'Error processing wallet payment'
            });
        }
    }
};

export default userCheckoutController;
