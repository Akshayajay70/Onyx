import Product from '../model/productModel.js';
import Variant from '../model/varientModel.js';
import Category from '../model/categoryModel.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';

// Multer storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/products');
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only images are allowed'));
    },
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB file size limit
});

// Render Product Management Page
export const renderProductPage = async (req, res) => {
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
export const addProduct = async (req, res) => {
    const uploadMultiple = upload.array('images', 5);

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
                price,
                discountPrice,
                stock
            } = req.body;

            // Validate required fields
            if (!productName || !brand || !gender || !categoriesId || !color || !price || !discountPrice || !stock) {
                return res.status(400).json({ message: 'All fields are required' });
            }

            // Calculate discount percentage
            const discountPercentage = ((price - discountPrice) / price * 100).toFixed(2);

            // Upload images
            const imageUrls = req.files.map(file => `/uploads/products/${file.filename}`);

            // Create Variant with product reference
            const newVariant = new Variant({
                color,
                price: parseFloat(price),
                discountPrice: parseFloat(discountPrice),
                discountPercentage: parseFloat(discountPercentage),
                stock: parseInt(stock),
                rating: 0, // Default rating
                imageUrl: imageUrls
            });

            const savedVariant = await newVariant.save();

            const savedVariantId = savedVariant._id;

            // Create Product first
            const newProduct = new Product({
                productName,
                brand,
                gender,
                categoriesId,
                varientId: savedVariantId
            });

            const savedProduct = await newProduct.save();

            res.status(201).json({
                message: 'Product added successfully',
                product: savedProduct
            });
        } catch (error) {
            console.error('Error adding product:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    });
};

// Get Product Details for Editing
export const getProductDetails = async (req, res) => {
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
export const updateProduct = async (req, res) => {
    const uploadMultiple = upload.array('images', 5);

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
                price,
                discountPrice,
                stock
            } = req.body;

            // Find existing product
            const existingProduct = await Product.findById(productId);
            if (!existingProduct) {
                return res.status(404).json({ message: 'Product not found' });
            }

            // Calculate discount percentage
            const discountPercentage = ((price - discountPrice) / price * 100).toFixed(2);

            // Prepare variant update
            const variantUpdate = {
                color,
                price: parseFloat(price),
                discountPrice: parseFloat(discountPrice),
                discountPercentage: parseFloat(discountPercentage),
                stock: parseInt(stock)
            };

            // Handle image updates
            if (req.files && req.files.length > 0) {
                const imageUrls = req.files.map(file => `/uploads/products/${file.filename}`);

                // Delete old images if they exist
                const existingVariant = await Variant.findById(existingProduct.varientId);
                if (existingVariant && existingVariant.imageUrl) {
                    existingVariant.imageUrl.forEach(imagePath => {
                        const fullPath = path.join('public', imagePath);
                        if (fs.existsSync(fullPath)) {
                            fs.unlinkSync(fullPath);
                        }
                    });
                }

                variantUpdate.imageUrl = imageUrls;
            }

            // Update variant
            const updatedVariant = await Variant.findByIdAndUpdate(
                existingProduct.varientId,
                variantUpdate,
                { new: true }
            );

            // Prepare product update
            const productUpdate = {
                productName,
                brand,
                gender,
                categoriesId
            };

            // Update product
            const updatedProduct = await Product.findByIdAndUpdate(
                productId,
                productUpdate,
                { new: true }
            );

            res.json({
                message: 'Product updated successfully',
                product: updatedProduct,
                variant: updatedVariant
            });
        } catch (error) {
            console.error('Error updating product:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    });
};

// Delete Product
export const deleteProduct = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const product = await Product.findByIdAndDelete(req.params.id).session(session);

        if (!product) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: 'Product not found' });
        }

        // Delete associated variant and images
        const variant = await Variant.findByIdAndDelete(product.varientId).session(session);

        // Delete image files
        if (variant && variant.imageUrl) {
            variant.imageUrl.forEach(imagePath => {
                const fullPath = path.join('public', imagePath);
                if (fs.existsSync(fullPath)) {
                    fs.unlinkSync(fullPath);
                }
            });
        }

        await session.commitTransaction();
        session.endSession();

        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Error deleting product:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Toggle Product Status
export const toggleProductStatus = async (req, res) => {
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
