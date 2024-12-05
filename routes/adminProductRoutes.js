import express from 'express';
import {
    renderProductPage,
    addProduct,
    getProductDetails,
    updateProduct,
    deleteProduct,
    toggleProductStatus
} from '../controller/adminProductController.js';

const router = express.Router();

// Render Product Management Page
router.get('/admin/product', renderProductPage);

// Add New Product
router.post('/admin/product/add', addProduct);

// Get Product Details
router.get('/admin/product/:id', getProductDetails);

// Update Product
router.put('/admin/product/update', updateProduct);

// Delete Product
router.delete('/admin/product/:id', deleteProduct);

// Toggle Product Status
router.patch('/admin/product/toggle/:id', toggleProductStatus);

export default router;