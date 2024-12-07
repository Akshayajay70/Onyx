import Product from '../model/productModel.js';
import Variant from '../model/varientModel.js';
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
            .populate('varientId')
            .sort({ createdAt: -1 });

        // Fetch active categories for the dropdown
        const categories = await Category.find({ isActive: true });

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
    const uploadMultiple = upload.array('images', 4);

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
                variantDescription,
                price,
                discountPrice,
                stock
            } = req.body;

            // Validate variant description
            if (!variantDescription || variantDescription.length < 10 || variantDescription.length > 25) {
                return res.status(400).json({ 
                    message: 'Variant description must be between 10 and 25 characters' 
                });
            }

            // Create Variant
            const newVariant = new Variant({
                color,
                description: variantDescription.trim(),
                price: parseFloat(price),
                discountPrice: parseFloat(discountPrice),
                discountPercentage: ((price - discountPrice) / price * 100).toFixed(2),
                stock: parseInt(stock),
                imageUrl: req.files.map(file => `/uploads/products/${file.filename}`)
            });

            const savedVariant = await newVariant.save();

            // Create Product
            const newProduct = new Product({
                productName,
                brand,
                gender,
                categoriesId,
                varientId: savedVariant._id
            });

            await newProduct.save();

            res.status(201).json({ message: 'Product added successfully' });
        } catch (error) {
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
            .populate('varientId');

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
    const uploadMultiple = upload.array('images', 4);

    uploadMultiple(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ message: err.message });
        }

        try {
            const {
                productId,
                productName,
                brand,
                gender,
                categoriesId,
                color,
                variantDescription,
                price,
                discountPrice,
                stock
            } = req.body;

            // Validate variant description
            if (!variantDescription || variantDescription.length < 10 || variantDescription.length > 25) {
                return res.status(400).json({ 
                    message: 'Variant description must be between 10 and 25 characters' 
                });
            }

            const existingProduct = await Product.findById(productId);
            if (!existingProduct) {
                return res.status(404).json({ message: 'Product not found' });
            }

            // Update variant
            const variantUpdate = {
                color,
                description: variantDescription.trim(),
                price: parseFloat(price),
                discountPrice: parseFloat(discountPrice),
                discountPercentage: ((price - discountPrice) / price * 100).toFixed(2),
                stock: parseInt(stock)
            };

            if (req.files && req.files.length > 0) {
                variantUpdate.imageUrl = req.files.map(file => `/uploads/products/${file.filename}`);
            }

            await Variant.findByIdAndUpdate(existingProduct.varientId, variantUpdate);

            // Update product
            await Product.findByIdAndUpdate(productId, {
                productName,
                brand,
                gender,
                categoriesId
            });

            res.json({ message: 'Product updated successfully' });
        } catch (error) {
            console.error('Error updating product:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    });
};

// Delete Product
const deleteProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        
        // Find the product first to get the variant ID
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // Get variant ID before deleting product
        const variantId = product.varientId;
        // Find variant to get image URLs
        const variant = await Variant.findById(variantId);
        if (variant && variant.imageUrl) {
            // Delete image files from storage
            variant.imageUrl.forEach(imagePath => {
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

        // Delete the product and variant
        await Product.findByIdAndDelete(productId);
        await Variant.findByIdAndDelete(variantId);

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