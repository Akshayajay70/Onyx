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
            const existingProduct = await Product.findById(req.body.productId);
            if (!existingProduct) {
                return res.status(404).json({ message: 'Product not found' });
            }

            // If new images are uploaded, delete old ones
            if (req.files && req.files.length > 0) {
                // Delete old images
                existingProduct.imageUrl.forEach(imagePath => {
                    const fullPath = path.join('public', imagePath);
                    if (fs.existsSync(fullPath)) {
                        fs.unlinkSync(fullPath);
                    }
                });

                // Update with new image URLs
                existingProduct.imageUrl = req.files.map(file => `/uploads/products/${file.filename}`);
            }

            // Update other fields
            Object.assign(existingProduct, {
                productName: req.body.productName,
                categoriesId: req.body.categoriesId,
                brand: req.body.brand,
                gender: req.body.gender,
                color: req.body.color,
                description: req.body.description.trim(),
                price: parseFloat(req.body.price),
                discountPrice: parseFloat(req.body.discountPrice),
                discountPercentage: ((req.body.price - req.body.discountPrice) / req.body.price * 100).toFixed(2),
                stock: parseInt(req.body.stock),
            });

            await existingProduct.save();
            res.json({ message: 'Product updated successfully' });
        } catch (error) {
            // Delete uploaded files if there's an error
            req.files?.forEach(file => {
                fs.unlink(file.path, (err) => {
                    if (err) console.error('Error deleting file:', err);
                });
            });
            
            console.error('Error updating product:', error);
            res.status(500).json({ message: 'Internal server error' });
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


export default { renderProductPage, addProduct, getProductDetails, updateProduct, deleteProduct, toggleProductStatus }