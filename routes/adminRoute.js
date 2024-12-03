import express from 'express';
import adminController from '../controller/adminController.js';
import adminMiddleware from '../middlewares/adminMiddleware.js';

const router = express.Router();

router.get('/login', adminMiddleware.isLogin, adminController.getAdmin);

router.post('/login', adminController.postAdmin);

router.get('/dashboard', adminMiddleware.checkSession, adminController.getDashboard)

router.get('/logout', adminMiddleware.checkSession, adminController.getLogout);

router.get('/userList', adminMiddleware.checkSession, adminController.getUserList)

router.post('/user/:id/toggle-block', adminMiddleware.checkSession, adminController.getToggle);
  
export default router;
