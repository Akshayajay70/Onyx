import Product from '../../model/productModel.js'
import { calculateFinalPrice } from '../../utils/calculateOffer.js';
import Offer from '../../model/offerModel.js';


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
        const page = parseInt(req.query.page) || 1;
        const limit = 12;
        const skip = (page - 1) * limit;

        // Build filter query
        const filter = { isActive: true };

        // Add search filter
        if (req.query.search) {
            filter.$or = [
                { productName: { $regex: req.query.search, $options: 'i' } },
                { brand: { $regex: req.query.search, $options: 'i' } }
            ];
        }

        // Add gender filter
        if (req.query.gender) {
            filter.gender = req.query.gender;
        }

        // Add color filter
        if (req.query.color) {
            filter.color = req.query.color;
        }

        // Add price range filter
        if (req.query.minPrice || req.query.maxPrice) {
            filter.price = {};
            if (req.query.minPrice) filter.price.$gte = Number(req.query.minPrice);
            if (req.query.maxPrice) filter.price.$lte = Number(req.query.maxPrice);
        }

        // Add stock filter
        if (req.query.stock === 'inStock') {
            filter.stock = { $gt: 0 };
        } else if (req.query.stock === 'outOfStock') {
            filter.stock = 0;
        }

        // Build sort query
        let sortQuery = {};
        switch (req.query.sort) {
            case 'priceLowToHigh':
                sortQuery = { price: 1 };
                break;
            case 'priceHighToLow':
                sortQuery = { price: -1 };
                break;
            case 'ratingHighToLow':
                sortQuery = { rating: -1 };
                break;
            case 'newArrivals':
                sortQuery = { createdAt: -1 };
                break;
            default:
                sortQuery = { createdAt: -1 };
        }

        // Get total count for pagination
        const totalProducts = await Product.countDocuments(filter);
        const totalPages = Math.ceil(totalProducts / limit);

        // Fetch filtered products
        const products = await Product.find(filter)
            .populate('categoriesId')
            .sort(sortQuery)
            .skip(skip)
            .limit(limit);

        // Fetch active offers
        const offers = await Offer.find({
            status: 'active',
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() }
        });

        // Process products with offers
        const processedProducts = products.map(product => {
            const productOffer = offers.find(offer => 
                offer.productIds && offer.productIds.some(id => id.equals(product._id))
            );
            
            const categoryOffer = offers.find(offer => 
                offer.categoryId && offer.categoryId.equals(product.categoriesId._id)
            );

            const discountPrice = calculateFinalPrice(product, categoryOffer, productOffer);

            return {
                ...product.toObject(),
                price: product.price,
                discountPrice: discountPrice,
                hasDiscount: discountPrice < product.price,
                discountPercentage: Math.round((product.price - discountPrice) / product.price * 100)
            };
        });

        if (req.xhr) {
            return res.json({
                products: processedProducts,
                pagination: {
                    currentPage: page,
                    totalPages,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                }
            });
        }

        res.render('user/shop', {
            products: processedProducts,
            pagination: {
                currentPage: page,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            },
            title: 'Shop'
        });
    } catch (error) {
        console.error('Error in getShop:', error);
        if (req.xhr) {
            return res.status(500).json({ error: 'Failed to load products' });
        }
        res.status(500).render('user/shop', {
            products: [],
            pagination: {
                currentPage: 1,
                totalPages: 1,
                hasNextPage: false,
                hasPrevPage: false
            },
            title: 'Shop',
            error: 'Failed to load products'
        });
    }
};


export default {
    getHome,
    getShop, 
}