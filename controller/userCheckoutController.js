import cartSchema from '../model/cartModel.js';
import orderSchema from '../model/orderModel.js';
import addressSchema from '../model/addressModel.js';
import productSchema from '../model/productModel.js';

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

            res.render('user/checkout', {
                addresses,
                cartItems,
                total,
                user: req.session.user
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
            const { addressId, paymentMethod } = req.body;
            const userId = req.session.user;

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
                totalAmount: total,
                shippingAddress: {
                    fullName: address.fullName,
                    phone: address.mobileNumber,
                    addressLine1: address.addressLine1,
                    addressLine2: address.addressLine2,
                    city: address.city,
                    state: address.state,
                    pincode: address.pincode
                },
                paymentMethod,
                paymentStatus: 'pending',
                orderStatus: 'processing',
                orderDate: new Date()
            });

            await newOrder.save();

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
    }
};

export default userCheckoutController;
