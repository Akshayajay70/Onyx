import Product from '../model/productModel.js';
import Category from '../model/categoryModel.js';
import path from 'path';
import fs from 'fs';
import upload from '../utils/multer.js'

// Render Product Management Page
const renderProductPage = async (req, res) => {
    try {
        // Fetch products with populated references
        const products = await Product.find()
            .populate('categoriesId')
            .sort({ createdAt: -1 });

        // Fetch active categories for the dropdown
        const categories = await Category.find();

        res.render('admin/product', {
            products,
            categories
        });
    } catch (error) {
        console.error('Error rendering product page:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Add New Product
const addProduct = async (req, res) => {
    const uploadMultiple = upload.array('images', 3);

    uploadMultiple(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ message: err.message });
        }

        try {
            const {
                productName,
                brand,
                gender,
                categoriesId,
                color,
                description,
                price,
                discountPrice,
                stock
            } = req.body;

            // Validate product description
            if (!description || description.length < 10 || description.length > 25) {
                return res.status(400).json({ 
                    message: 'Variant description must be between 10 and 25 characters' 
                });
            }

            // Process and save the cropped images
            const imageUrls = req.files.map(file => `/uploads/products/${file.filename}`);

            const newProduct = new Product({
                productName,
                categoriesId,
                brand,
                gender,
                color,
                description: description.trim(),
                price: parseFloat(price),
                discountPrice: parseFloat(discountPrice),
                discountPercentage: ((price - discountPrice) / price * 100).toFixed(2),
                stock: parseInt(stock),
                imageUrl: imageUrls
            });

           await newProduct.save();
            res.status(201).json({ message: 'Product added successfully' });
        } catch (error) {
            // Delete uploaded files if there's an error
            req.files?.forEach(file => {
                fs.unlink(file.path, (err) => {
                    if (err) console.error('Error deleting file:', err);
                });
            });
            
            console.error('Error adding product:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    });
};

// Get Product Details for Editing
const getProductDetails = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id)
            .populate('categoriesId')

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.json(product);
    } catch (error) {
        console.error('Error fetching product details:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Update Product
const updateProduct = async (req, res) => {
    const uploadMultiple = upload.array('images', 3);

    uploadMultiple(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ message: err.message });
        }

        try {
            const productId = req.params.id; // Get ID from params instead of body
            const existingProduct = await Product.findById(productId);
            
            if (!existingProduct) {
                return res.status(404).json({ message: 'Product not found' });
            }

            // Validate required fields
            const {
                productName,
                brand,
                gender,
                categoriesId,
                color,
                description,
                price,
                discountPrice,
                stock
            } = req.body;

            if (!productName || !brand || !categoriesId || !price || !discountPrice) {
                return res.status(400).json({ message: 'Missing required fields' });
            }

            // Handle image updates only if new images are uploaded
            if (req.files && req.files.length > 0) {
                // Delete old images
                existingProduct.imageUrl.forEach(imagePath => {
                    const fullPath = path.join(process.cwd(), 'public', imagePath);
                    if (fs.existsSync(fullPath)) {
                        fs.unlinkSync(fullPath);
                    }
                });

                // Update with new image URLs
                existingProduct.imageUrl = req.files.map(file => `/uploads/products/${file.filename}`);
            }

            // Update other fields
            existingProduct.productName = productName;
            existingProduct.categoriesId = categoriesId;
            existingProduct.brand = brand;
            existingProduct.gender = gender;
            existingProduct.color = color;
            existingProduct.description = description.trim();
            existingProduct.price = parseFloat(price);
            existingProduct.discountPrice = parseFloat(discountPrice);
            existingProduct.discountPercentage = ((price - discountPrice) / price * 100).toFixed(2);
            existingProduct.stock = parseInt(stock);

            await existingProduct.save();
            res.status(200).json({ message: 'Product updated successfully' });
        } catch (error) {
            // Delete any newly uploaded files if there's an error
            if (req.files) {
                req.files.forEach(file => {
                    const filePath = path.join(process.cwd(), 'public', 'uploads', 'products', file.filename);
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                });
            }
            
            console.error('Error updating product:', error);
            res.status(500).json({ message: 'Error updating product: ' + error.message });
        }
    });
};

// Delete Product
const deleteProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        
        // Find the product first to get the product ID
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        if (product.imageUrl) {
            // Delete image files from storage
            product.imageUrl.forEach(imagePath => {
                try {
                    const fullPath = path.join('public', imagePath);
                    if (fs.existsSync(fullPath)) {
                        fs.unlinkSync(fullPath);
                    }
                } catch (err) {
                    console.error('Error deleting image file:', err);
                    // Continue with deletion even if image removal fails
                }
            });
        }

        // Delete the product
        await Product.findByIdAndDelete(productId);

        res.status(200).json({ message: 'Product deleted successfully' });
    } catch (error) {
        res.status(500).json({ 
            message: 'Error deleting product',
            error: error.message 
        });
    }
};

// Toggle Product Status
const toggleProductStatus = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        product.isActive = !product.isActive;
        await product.save();

        res.json({
            message: 'Product status updated',
            isActive: product.isActive
        });
    } catch (error) {
        console.error('Error toggling product status:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Get all products page
const getProducts = async (req, res) => {
    try {
        const products = await Product.find()
            .populate('categoriesId')
            .sort({ createdAt: -1 });

        res.render('admin/product', { products });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Get add product page
const getAddProduct = async (req, res) => {
    try {
        const categories = await Category.find({ isActive: true });
        res.render('admin/addProduct', { categories });
    } catch (error) {
        console.error('Error loading add product page:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Get edit product page
const getEditProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id)
            .populate('categoriesId');
        const categories = await Category.find({ isActive: true });
        
        if (!product) {
            return res.redirect('/admin/product');
        }

        res.render('admin/editProduct', { product, categories });
    } catch (error) {
        console.error('Error loading edit product page:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export default { renderProductPage, addProduct, getProductDetails, updateProduct, deleteProduct, toggleProductStatus, getProducts, getAddProduct, getEditProduct }