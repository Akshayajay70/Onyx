import Cart from '../model/cartModel.js';

const cartCount = async (req, res, next) => {
    try {
        if (req.session.user) {
            const cart = await Cart.findOne({ userId: req.session.user });
            // Set cart count to number of items in cart
            res.locals.cartCount = cart ? cart.items.length : 0;
        } else {
            res.locals.cartCount = 0;
        }
        next();
    } catch (error) {
        console.error('Error getting cart count:', error);
        res.locals.cartCount = 0;
        next();
    }
};

export default cartCount;
