import Product from '../model/productModel.js';

const getProductDetails = async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await Product.findById(productId)
            .populate('categoriesId');

        if (!product) {
            return res.status(404).redirect('/home'); // Redirect to home if product not found
        }

        // Find related products (same category, excluding current product)
        const relatedProducts = await Product.find({
            categoriesId: product.categoriesId,
            _id: { $ne: productId },
        })
        .populate('productId')
        .limit(4); // Show 4 related products

        res.render('user/viewProduct', { 
            product, 
            relatedProducts,
            title: product.productName // For the page title
        });
    } catch (error) {
        console.error('Error fetching product details:', error);
        res.status(500).redirect('/home');
    }
};


export default {
    getProductDetails,
}; 