import cartSchema from '../model/cartModel.js';
import productSchema from '../model/productModel.js';
import couponSchema from '../model/couponModel.js';

const getCart = async (req, res) => {
    try {
        const userId = req.session.user;
        const cart = await cartSchema.findOne({ userId }).populate('items.productId');
        
        if (!cart) {
            return res.render('user/cart', { 
                cartItems: [],
                total: 0
            });
        }

        const cartItems = cart.items.map(item => ({
            product: {
                _id: item.productId._id,
                productName: item.productId.productName,
                imageUrl: item.productId.imageUrl,
                color: item.productId.color,
                stock: item.productId.stock
            },
            quantity: item.quantity,
            price: item.price,
            subtotal: item.quantity * item.price
        }));

        const total = cartItems.reduce((sum, item) => sum + item.subtotal, 0);

        res.render('user/cart', { 
            cartItems,
            total
        });
    } catch (error) {
        console.error('Error fetching cart:', error);
        res.status(500).render('user/cart', { 
            cartItems: [],
            total: 0,
            error: 'Failed to load cart'
        });
    }
};

const addToCart = async (req, res) => {
    try {
        const { productId, quantity } = req.body;
        const userId = req.session.user;

        // Check if product exists and is in stock
        const product = await productSchema.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // Check if user already has a cart
        let cart = await cartSchema.findOne({ userId });

        if (!cart) {
            // Create new cart if doesn't exist
            cart = new cartSchema({
                userId,
                items: [{
                    productId,
                    quantity,
                    price: product.discountPrice
                }]
            });
        } else {
            // Check if product already exists in cart
            const existingItem = cart.items.find(item => 
                item.productId.toString() === productId
            );

            if (existingItem) {
                // Calculate new quantity
                const newQuantity = existingItem.quantity + quantity;
                
                // Check if new quantity exceeds limit
                if (newQuantity > 3) {
                    return res.status(400).json({ 
                        message: `Cannot add more items. Maximum limit is 3 (Current quantity: ${existingItem.quantity})`
                    });
                }

                // Check if new quantity exceeds stock
                if (newQuantity > product.stock) {
                    return res.status(400).json({ 
                        message: 'Not enough stock available'
                    });
                }

                // Update quantity if within limits
                existingItem.quantity = newQuantity;
            } else {
                // Add new item if product doesn't exist in cart
                cart.items.push({
                    productId,
                    quantity,
                    price: product.discountPrice
                });
            }
        }

        await cart.save();

        // Calculate updated cart totals
        const updatedCart = await cartSchema.findOne({ userId }).populate('items.productId');
        const cartItems = updatedCart.items.map(item => ({
            product: item.productId,
            quantity: item.quantity,
            price: item.price,
            subtotal: item.quantity * item.price
        }));

        const total = cartItems.reduce((sum, item) => sum + item.subtotal, 0);

        res.status(200).json({ 
            message: 'Product added to cart successfully',
            cartCount: cart.items.length,
            total: total
        });

    } catch (error) {
        console.error('Error adding to cart:', error);
        res.status(500).json({ message: 'Failed to add product to cart' });
    }
};

// Update quantity in cart
const updateQuantity = async (req, res) => {
    try {
        const { productId, quantity } = req.body;
        const userId = req.session.user;

        if (quantity < 1) {
            return res.status(400).json({ message: 'Quantity must be at least 1' });
        }

        const product = await productSchema.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        if (product.stock < quantity) {
            return res.status(400).json({ message: 'Not enough stock available' });
        }

        const cart = await cartSchema.findOne({ userId });
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        const cartItem = cart.items.find(item => item.productId.toString() === productId);
        if (!cartItem) {
            return res.status(404).json({ message: 'Product not found in cart' });
        }

        cartItem.quantity = quantity;
        await cart.save();

        // Calculate new totals
        const updatedCart = await cartSchema.findOne({ userId }).populate('items.productId');
        const cartItems = updatedCart.items.map(item => ({
            product: item.productId,
            quantity: item.quantity,
            price: item.price,
            subtotal: item.quantity * item.price
        }));

        const total = cartItems.reduce((sum, item) => sum + item.subtotal, 0);

        res.status(200).json({ 
            message: 'Quantity updated successfully',
            quantity: quantity,
            subtotal: quantity * cartItem.price,
            total: total
        });

    } catch (error) {
        console.error('Error updating quantity:', error);
        res.status(500).json({ message: 'Failed to update quantity' });
    }
};

const removeFromCart = async (req, res) => {
    try {
        const { productId } = req.params;
        const userId = req.session.user;

        // Find the cart
        const cart = await cartSchema.findOne({ userId });
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        // Remove the item
        cart.items = cart.items.filter(item => 
            item.productId.toString() !== productId
        );

        await cart.save();

        // Calculate new totals
        const updatedCart = await cartSchema.findOne({ userId }).populate('items.productId');
        const cartItems = updatedCart.items.map(item => ({
            product: item.productId,
            quantity: item.quantity,
            price: item.price,
            subtotal: item.quantity * item.price
        }));

        const total = cartItems.reduce((sum, item) => sum + item.subtotal, 0);

        res.status(200).json({ 
            message: 'Item removed from cart',
            total,
            itemCount: cart.items.length
        });

    } catch (error) {
        console.error('Error removing item from cart:', error);
        res.status(500).json({ message: 'Failed to remove item from cart' });
    }
};

const getAvailableCoupons = async (req, res) => {
    try {
        const userId = req.session.user;
        const cart = await cartSchema.findOne({ userId }).populate('items.productId');
        
        if (!cart) {
            return res.json([]);
        }

        // Calculate cart total
        const cartTotal = cart.items.reduce((sum, item) => 
            sum + (item.quantity * item.price), 0
        );

        // Get all active coupons
        const coupons = await couponSchema.find({
            isActive: true,
            expiryDate: { $gt: new Date() },
            startDate: { $lte: new Date() }
        });

        // Process coupons to check applicability
        const processedCoupons = coupons.map(coupon => {
            // Check if user has already used this coupon
            const userUsage = coupon.usedBy.filter(usage => 
                usage.userId.toString() === userId
            ).length;

            const isApplicable = 
                cartTotal >= coupon.minimumPurchase && // Meets minimum purchase
                (!coupon.totalCoupon || coupon.usedCouponCount < coupon.totalCoupon) && // Coupon still available
                userUsage < coupon.userUsageLimit; // User hasn't exceeded usage limit

            return {
                code: coupon.code,
                description: coupon.description,
                discountPercentage: coupon.discountPercentage,
                minimumPurchase: coupon.minimumPurchase,
                maximumDiscount: coupon.maximumDiscount,
                expiryDate: coupon.expiryDate,
                isApplicable
            };
        });

        res.json(processedCoupons);
    } catch (error) {
        console.error('Error fetching available coupons:', error);
        res.status(500).json({ message: 'Error fetching coupons' });
    }
};

const applyCoupon = async (req, res) => {
    try {
        const { code } = req.body;
        const userId = req.session.user;

        // Find the coupon
        const coupon = await couponSchema.findOne({ 
            code: code.toUpperCase(),
            isActive: true,
            expiryDate: { $gt: new Date() },
            startDate: { $lte: new Date() }
        });

        if (!coupon) {
            return res.status(400).json({ message: 'Invalid or expired coupon' });
        }

        // Get cart and calculate total
        const cart = await cartSchema.findOne({ userId }).populate('items.productId');
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        const cartTotal = cart.items.reduce((sum, item) => 
            sum + (item.quantity * item.price), 0
        );

        // Validate minimum purchase
        if (cartTotal < coupon.minimumPurchase) {
            return res.status(400).json({ 
                message: `Minimum purchase of ₹${coupon.minimumPurchase} required` 
            });
        }

        // Check if coupon has reached its total usage limit
        if (coupon.totalCoupon && coupon.usedCouponCount >= coupon.totalCoupon) {
            return res.status(400).json({ message: 'Coupon limit reached' });
        }

        // Check user's usage of this coupon
        const userUsage = coupon.usedBy.filter(usage => 
            usage.userId.toString() === userId
        ).length;

        if (userUsage >= coupon.userUsageLimit) {
            return res.status(400).json({ 
                message: 'You have already used this coupon the maximum number of times' 
            });
        }

        // Calculate discount
        let discount = (cartTotal * coupon.discountPercentage) / 100;
        
        // Apply maximum discount limit if set
        if (coupon.maximumDiscount) {
            discount = Math.min(discount, coupon.maximumDiscount);
        }

        // Calculate final total
        const total = cartTotal - discount;

        // Store coupon information in cart
        cart.appliedCoupon = coupon.code;
        cart.couponDiscount = discount;
        await cart.save();

        res.json({
            message: 'Coupon applied successfully',
            subtotal: cartTotal,
            discount,
            total,
            code: coupon.code
        });

    } catch (error) {
        console.error('Error applying coupon:', error);
        res.status(500).json({ message: 'Error applying coupon' });
    }
};

export default {
    getCart,
    addToCart,
    updateQuantity,
    removeFromCart,
    getAvailableCoupons,
    applyCoupon
};