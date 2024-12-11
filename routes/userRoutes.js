import { Router } from 'express';
import userController from '../controller/userController.js';
import productController from '../controller/userProductController.js';
import userMiddlewares from '../middlewares/userMiddlewares.js';
import userProfileController from '../controller/userProfileController.js';
import userAddressController from '../controller/userAddressController.js';
import userCartController from '../controller/userCartController.js';
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

route.get('/auth/google', userMiddlewares.restrictManualAccess, userController.getGoogle);

route.get('/auth/google/callback', userController.getGoogleCallback);

route.get('/profile', userMiddlewares.checkSession, userProfileController.getProfile);

route.post('/profile/update', userMiddlewares.checkSession, userProfileController.updateProfile);

route.get('/address', userMiddlewares.checkSession, userAddressController.getAddress);

route.post('/address/add', userMiddlewares.checkSession, userAddressController.addAddress);

route.delete('/address/:id', userMiddlewares.checkSession, userAddressController.deleteAddress);

route.put('/address/:id', userMiddlewares.checkSession, userAddressController.editAddress);

route.get('/cart', userMiddlewares.checkSession, userCartController.getCart);

route.post('/cart/add', userMiddlewares.checkSession, userCartController.addToCart);

route.post('/cart/update-quantity', userMiddlewares.checkSession, userCartController.updateQuantity);

route.delete('/cart/remove/:productId', userMiddlewares.checkSession, userCartController.removeFromCart);

export default route;

