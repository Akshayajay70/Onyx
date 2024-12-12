import cartSchema from '../model/cartModel.js';
import orderSchema from '../model/orderModel.js';
import addressSchema from '../model/addressModel.js';

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
                    select: 'productName imageUrl price'
                });

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

            // Validate address
            const selectedAddress = await addressSchema.findOne({
                _id: addressId,
                userId: userId
            });

            if (!selectedAddress) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Invalid address selected' 
                });
            }

            // Get cart items
            const cart = await cartSchema.findOne({ userId })
                .populate('items.productId');

            if (!cart || cart.items.length === 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Cart is empty' 
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

            // Format shipping address
            const shippingAddress = {
                fullName: selectedAddress.fullName,
                mobileNumber: selectedAddress.mobileNumber,
                addressLine1: selectedAddress.addressLine1,
                addressLine2: selectedAddress.addressLine2,
                city: selectedAddress.city,
                state: selectedAddress.state,
                pincode: selectedAddress.pincode
            };

            // Create new order
            const newOrder = new orderSchema({
                userId,
                items: orderItems,
                totalAmount: total,
                shippingAddress,
                paymentMethod,
                paymentStatus: 'pending',
                orderStatus: 'pending',
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
