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
            // Check if files were uploaded
            if (!req.files || req.files.length !== 3) {
                return res.status(400).json({ message: 'Please upload exactly 3 images' });
            }

            // Validate file types and sizes
            for (const file of req.files) {
                if (file.size > 5 * 1024 * 1024) { // 5MB limit
                    return res.status(400).json({ message: 'Each image must be less than 5MB' });
                }

                const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
                if (!validTypes.includes(file.mimetype)) {
                    return res.status(400).json({ message: 'Invalid file type. Only JPG, JPEG, PNG, and WebP are allowed' });
                }
            }

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
            const productId = req.params.id;
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

            // Handle image updates
            let updatedImageUrls = [...existingProduct.imageUrl]; // Copy existing image URLs

            // If new images are uploaded, process them
            if (req.files && req.files.length > 0) {
                req.files.forEach((file, index) => {
                    // If there's an existing image at this index, delete it
                    if (updatedImageUrls[index]) {
                        const oldImagePath = path.join(process.cwd(), 'public', updatedImageUrls[index]);
                        if (fs.existsSync(oldImagePath)) {
                            fs.unlinkSync(oldImagePath);
                        }
                    }
                    // Update the URL at this index
                    updatedImageUrls[index] = `/uploads/products/${file.filename}`;
                });
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
            existingProduct.imageUrl = updatedImageUrls; // Update with new image URLs

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


export default { renderProductPage, addProduct, getProductDetails, updateProduct, deleteProduct, toggleProductStatus }