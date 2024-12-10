import { Router } from 'express';
import userController from '../controller/userController.js';
import productController from '../controller/userProductController.js';
import userMiddlewares from '../middlewares/userMiddlewares.js';
import userProfileController from '../controller/userProfileController.js';
import userAddressController from '../controller/userAddressController.js';

const route = Router();

route.get('/signup', userMiddlewares.isLogin, userController.getSignUp);

route.post('/signup', userController.postSignUp);

route.post('/validate-otp', userController.postOtp);

route.post('/resend-otp', userController.postResendOtp);

route.get('/login', userMiddlewares.isLogin, userController.getLogin);

route.post('/login', userController.postLogin);

route.get('/', userController.getHome)

route.get('/home', userMiddlewares.checkSession, userController.getHome);

route.get('/shop', userMiddlewares.checkSession, userController.getShop);

route.get('/logout', userMiddlewares.checkSession, userController.getLogout);

route.get('/product/:id', userMiddlewares.checkSession, productController.getProductDetails);

route.get('/auth/google', 
    userMiddlewares.restrictManualAccess, 
    userController.getGoogle
);

route.get('/auth/google/callback', 
    userController.getGoogleCallback
);

route.get('/profile', userProfileController.getProfile)

route.get('/address', userAddressController.getAddress)

export default route;

