import Product from '../model/productModel.js'
import { calculateFinalPrice } from '../utils/calculateOffer.js';
import Offer from '../model/offerModel.js';


const getHome = async (req, res) => {
    try {
        // Fetch active products with their categories
        const products = await Product.find({ isActive: true })
            .populate('categoriesId')
            .sort({ createdAt: -1 })
            .limit(5);

        // Fetch all active offers
        const offers = await Offer.find({
            status: 'active',
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() }
        });

        // Process each product to include offer prices
        const processedProducts = products.map(product => {
            const productOffer = offers.find(offer => 
                offer.productIds && offer.productIds.some(id => id.equals(product._id))
            );
            
            const categoryOffer = offers.find(offer => 
                offer.categoryId && offer.categoryId.equals(product.categoriesId._id)
            );

            const finalPrice = calculateFinalPrice(product, categoryOffer, productOffer);
            
            return {
                ...product.toObject(),
                discountPrice: finalPrice,
                originalPrice: product.price,
                offerApplied: finalPrice < product.price,
                offerPercentage: productOffer?.discount || categoryOffer?.discount || 0
            };
        });

        res.render('user/home', { 
            products: processedProducts,
            title: 'Home'
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.render('user/home', { 
            products: [],
            title: 'Home'
        });
    }
};

const getShop = async (req, res) => {
    try {
        // Fetch all active products with their categories
        const products = await Product.find({ isActive: true })
            .populate('categoriesId');

        // Fetch all active offers
        const offers = await Offer.find({
            status: 'active',
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() }
        });

        // Process each product to include offer prices
        const processedProducts = products.map(product => {
            // Find applicable offers for this product
            const productOffer = offers.find(offer => 
                offer.productIds && offer.productIds.some(id => id.equals(product._id))
            );
            
            const categoryOffer = offers.find(offer => 
                offer.categoryId && offer.categoryId.equals(product.categoriesId._id)
            );

            // Calculate final price with offers
            const discountPrice = calculateFinalPrice(product, categoryOffer, productOffer);

            return {
                ...product.toObject(),
                price: product.price, // Original price
                discountPrice: discountPrice, // Price after applying offers
                hasDiscount: discountPrice < product.price,
                discountPercentage: Math.round((product.price - discountPrice) / product.price * 100)
            };
        });

        res.render('user/shop', { 
            products: processedProducts,
            title: 'Shop'
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).render('user/shop', { 
            products: [],
            title: 'Shop',
            error: 'Failed to load products'
        });
    }
};


export default {
    getHome,
    getShop, 
}