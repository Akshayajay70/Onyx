import express from 'express';
import adminController from '../controller/adminController.js';
import adminMiddleware from '../middlewares/adminMiddleware.js';

const router = express.Router();

router.get('/login', adminMiddleware.isLogin, adminController.getAdmin);

router.post('/login', adminController.postAdmin);

router.get('/dashboard', adminMiddleware.checkSession, adminController.getDashboard)

router.get('/logout', adminMiddleware.checkSession, adminController.getLogout);

export default router;
