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
router.post('/admin/product/edit/:id', updateProduct);

// Delete Product
router.post('/admin/product/delete/:id', deleteProduct);

// Toggle Product Status
router.post('/admin/product/toggle-status/:id', toggleProductStatus);

export default router;