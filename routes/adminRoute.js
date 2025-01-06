import express from 'express';
import adminController from '../controller/adminController.js';
import adminMiddleware from '../middlewares/adminMiddleware.js';
import adminCategoryController from '../controller/adminCategoryController.js';
import adminProductController from '../controller/admin/productController.js';
import adminOrderController from '../controller/adminOrderController.js';
import adminCouponController from '../controller/adminCouponController.js';
import reportController from '../controller/admin/reportController.js';
import offerController from '../controller/admin/offerController.js';

const router = express.Router();

router.get('/login', adminMiddleware.isLogin, adminController.getAdmin);

router.post('/login', adminController.postAdmin);

router.get('/dashboard', adminMiddleware.checkSession, adminController.getDashboard)

router.get('/dashboard/data', adminMiddleware.checkSession, adminController.getDashboardData);

router.get('/logout', adminMiddleware.checkSession, adminController.getLogout);

// User listing Routes

router.get('/userList', adminMiddleware.checkSession, adminController.getUserList)

router.post('/user/:id/toggle-block', adminMiddleware.checkSession, adminController.getToggle);

// Category Routes

router.get('/category', adminMiddleware.checkSession, adminCategoryController.getCategories);

router.post('/category/add', adminMiddleware.checkSession, adminCategoryController.addCategory);

router.post('/category/edit', adminMiddleware.checkSession, adminCategoryController.editCategory);

router.get('/category/toggle', adminMiddleware.checkSession, adminCategoryController.toggleCategory);

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

// Coupon Routes
router.get('/coupon', adminMiddleware.checkSession, adminCouponController.getCoupons);

router.post('/coupons/add', adminMiddleware.checkSession, adminCouponController.addCoupon);

router.get('/coupons/:id', adminMiddleware.checkSession, adminCouponController.getCouponDetails);

router.post('/coupons/edit/:id', adminMiddleware.checkSession, adminCouponController.updateCoupon);

router.post('/coupons/delete/:id', adminMiddleware.checkSession, adminCouponController.deleteCoupon);

router.post('/coupons/toggle-status/:id', adminMiddleware.checkSession, adminCouponController.toggleCouponStatus);

// Report Routes

router.get('/sales-report', adminMiddleware.checkSession, reportController.getSalesReport);

router.get('/sales-report/download-excel', adminMiddleware.checkSession, reportController.downloadExcel);

router.get('/sales-report/download-pdf', adminMiddleware.checkSession, reportController.downloadPDF); 

// Offer Routes

router.get('/offers', adminMiddleware.checkSession, offerController.getOffers);

router.post('/offers', adminMiddleware.checkSession, offerController.createOffer);

router.get('/offers/:offerId', adminMiddleware.checkSession, offerController.getOffer);

router.put('/offers/:offerId', adminMiddleware.checkSession, offerController.updateOffer);

router.delete('/offers/:offerId', adminMiddleware.checkSession, offerController.deleteOffer);


export default router;
