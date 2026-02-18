import cartSchema from '../../model/cartModel.js';
import productSchema from '../../model/productModel.js';
import Offer from '../../model/offerModel.js';
import { calculateFinalPrice } from '../../utils/calculateOffer.js';
import Category from '../../model/categoryModel.js';

const getCart = async (req, res) => {
    try {
        const userId = req.session.user;
        
        // Get active categories
        const activeCategories = await Category.find({ isActive: true }).distinct('_id');
        
        const cart = await cartSchema.findOne({ userId }).populate({
            path: 'items.productId',
            populate: {
                path: 'categoriesId',
                match: { isActive: true }
            }
        });

        if (!cart) {
            return res.render('user/cart', { 
                cartItems: [],
                total: 0
            });
        }

        // Filter out items with inactive categories or products
        const validItems = cart.items.filter(item => 
            item.productId && 
            item.productId.categoriesId && 
            item.productId.isActive &&
            activeCategories.some(catId => catId.equals(item.productId.categoriesId._id))
        );

        // Update cart if invalid items were removed
        if (validItems.length !== cart.items.length) {
            cart.items = validItems;
            await cart.save();
        }

        // Process remaining items with current offers
        const updatedItems = await Promise.all(validItems.map(async item => {
            const product = item.productId;
            
            // Get active offers
            const offers = await Offer.find({
                status: 'active',
                startDate: { $lte: new Date() },
                endDate: { $gte: new Date() },
                $or: [
                    { productIds: product._id },
                    { categoryId: product.categoriesId._id }
                ]
            });

            const productOffer = offers.find(offer => 
                offer.productIds && offer.productIds.some(id => id.equals(product._id))
            );
            
            const categoryOffer = offers.find(offer => 
                offer.categoryId && offer.categoryId.equals(product.categoriesId._id)
            );

            // Calculate current price
            const currentPrice = calculateFinalPrice(product, categoryOffer, productOffer);
            const quantity = parseInt(item.quantity) || 1;
            const subtotal = currentPrice * quantity;

            // Update item in cart
            item.price = currentPrice;
            item.subtotal = subtotal;

            return {
                product: {
                    _id: product._id,
                    productName: product.productName,
                    imageUrl: product.imageUrl,
                    stock: product.stock,
                    color: product.color
                },
                quantity: quantity,
                price: currentPrice,
                subtotal: subtotal
            };
        }));

        // Calculate total
        const total = updatedItems.reduce((sum, item) => {
            return sum + (parseFloat(item.subtotal) || 0);
        }, 0);

        // Update cart in database
        cart.items = cart.items.map((item, index) => ({
            ...item,
            price: updatedItems[index].price,
            subtotal: updatedItems[index].subtotal
        }));
        cart.total = total;
        await cart.save();

        res.render('user/cart', { 
            cartItems: updatedItems,
            total: total
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

        // Check if product exists, is active, and has an active category
        const product = await productSchema.findById(productId).populate({
            path: 'categoriesId',
            match: { isActive: true }
        });

        if (!product || !product.isActive || !product.categoriesId) {
            return res.status(400).json({
                success: false,
                message: 'Product is not available'
            });
        }

        // Get active offers for the product and its category
        const offers = await Offer.find({
            status: 'active',
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() },
            $or: [
                { productIds: productId },
                { categoryId: product.categoriesId._id }
            ]
        });

        const productOffer = offers.find(offer => 
            offer.productIds && offer.productIds.some(id => id.equals(product._id))
        );
        
        const categoryOffer = offers.find(offer => 
            offer.categoryId && offer.categoryId.equals(product.categoriesId._id)
        );

        // Calculate discounted price
        const discountPrice = calculateFinalPrice(product, categoryOffer, productOffer);

        // Check if user already has a cart
        let cart = await cartSchema.findOne({ userId });

        if (!cart) {
            // Create new cart if doesn't exist
            cart = new cartSchema({
                userId,
                items: [{
                    productId,
                    quantity,
                    price: discountPrice,
                    subtotal: quantity * discountPrice
                }],
                total: quantity * discountPrice
            });
        } else {
            // Check if product already exists in cart
            const existingItem = cart.items.find(item => 
                item.productId.toString() === productId
            );

            if (existingItem) {
                // Calculate new quantity
                const newQuantity = existingItem.quantity + parseInt(quantity);
                
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

                // Update quantity and price
                existingItem.quantity = newQuantity;
                existingItem.price = discountPrice;
                existingItem.subtotal = newQuantity * discountPrice;
            } else {
                // Add new item if product doesn't exist in cart
                cart.items.push({
                    productId,
                    quantity,
                    price: discountPrice,
                    subtotal: quantity * discountPrice
                });
            }

            // Update cart total
            cart.total = cart.items.reduce((sum, item) => sum + item.subtotal, 0);
        }

        await cart.save();

        res.status(200).json({ 
            message: 'Product added to cart successfully',
            cartCount: cart.items.length,
            total: cart.total
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

        // Check product availability and stock
        const product = await productSchema.findById(productId).populate({
            path: 'categoriesId',
            match: { isActive: true }
        });

        if (!product || !product.isActive || !product.categoriesId) {
            return res.status(400).json({ message: 'Product is not available' });
        }

        if (product.stock < quantity) {
            return res.status(400).json({ message: 'Not enough stock available' });
        }

        // Find and update cart
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
            success: true,
            message: 'Quantity updated successfully',
            quantity: quantity,
            subtotal: quantity * cartItem.price,
            total: total
        });

    } catch (error) {
        console.error('Error updating quantity:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to update quantity' 
        });
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

export default {
    getCart,
    addToCart,
    updateQuantity,
    removeFromCart,
};