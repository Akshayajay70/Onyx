import express from 'express';
import adminController from '../controller/adminController.js';
import adminMiddleware from '../middlewares/adminMiddleware.js';
import adminCategoryController from '../controller/adminCategoryController.js';

const router = express.Router();

router.get('/login', adminMiddleware.isLogin, adminController.getAdmin);

router.post('/login', adminController.postAdmin);

router.get('/dashboard', adminMiddleware.checkSession, adminController.getDashboard)

router.get('/logout', adminMiddleware.checkSession, adminController.getLogout);

router.get('/userList', adminMiddleware.checkSession, adminController.getUserList)

router.post('/user/:id/toggle-block', adminMiddleware.checkSession, adminController.getToggle);

router.get('/category', adminMiddleware.checkSession, adminCategoryController.getCategories);

router.post('/category/add', adminMiddleware.checkSession, adminCategoryController.addCategory);

router.post('/category/edit', adminMiddleware.checkSession, adminCategoryController.editCategory);

router.get('/category/delete', adminMiddleware.checkSession, adminCategoryController.deleteCategory);

router.get('/category/toggle', adminMiddleware.checkSession, adminCategoryController.toggleCategoryStatus);
  
export default router;
