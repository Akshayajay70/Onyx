import express from 'express';
import adminController from '../controller/adminController.js';
import adminMiddleware from '../middlewares/adminMiddleware.js';
import adminCategoryController from '../controller/adminCategoryController.js';
import adminProductController from '../controller/adminProductController.js';
import adminOrderController from '../controller/adminOrderController.js';
const router = express.Router();

router.get('/login', adminMiddleware.isLogin, adminController.getAdmin);

router.post('/login', adminController.postAdmin);

router.get('/dashboard', adminMiddleware.checkSession, adminController.getDashboard)

router.get('/logout', adminMiddleware.checkSession, adminController.getLogout);

// User listing Routes

router.get('/userList', adminMiddleware.checkSession, adminController.getUserList)

router.post('/user/:id/toggle-block', adminMiddleware.checkSession, adminController.getToggle);

// Category Routes

router.get('/category', adminMiddleware.checkSession, adminCategoryController.getCategories);

router.post('/category/add', adminMiddleware.checkSession, adminCategoryController.addCategory);

router.post('/category/edit', adminMiddleware.checkSession, adminCategoryController.editCategory);

router.get('/category/delete', adminMiddleware.checkSession, adminCategoryController.deleteCategory);

// Product Routes

router.get('/product', adminMiddleware.checkSession, adminProductController.renderProductPage);

router.post('/product/add', adminMiddleware.checkSession, adminProductController.addProduct);

router.get('/product/:id', adminMiddleware.checkSession, adminProductController.getProductDetails);

router.post('/product/edit/:id', adminMiddleware.checkSession, adminProductController.updateProduct);

router.post('/product/delete/:id', adminMiddleware.checkSession, adminProductController.deleteProduct);

router.post('/product/toggle-status/:id', adminMiddleware.checkSession, adminProductController.toggleProductStatus);

//Order Routes

router.get('/orders', adminMiddleware.checkSession, adminOrderController.getOrders);

router.post('/orders/:orderId/status', adminMiddleware.checkSession, adminOrderController.updateOrderStatus);



export default router;
