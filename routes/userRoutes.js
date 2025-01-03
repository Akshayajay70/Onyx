import { Router } from 'express';
import userController from '../controller/userController.js';
import productController from '../controller/user/viewProductController.js';
import userMiddlewares from '../middlewares/userMiddlewares.js';
import userProfileController from '../controller/userProfileController.js';
import userAddressController from '../controller/userAddressController.js';
import userCartController from '../controller/userCartController.js';
import userCheckoutController from '../controller/userCheckoutController.js';
import userOrderController from '../controller/userOrderController.js';
import wishlistController from '../controller/user/wishlistController.js';
import walletController from '../controller/user/walletController.js';
import couponController from '../controller/user/couponController.js';

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

route.get('/checkout', userMiddlewares.checkSession, userCheckoutController.getCheckoutPage);

route.post('/checkout/place-order', userMiddlewares.checkSession, userCheckoutController.placeOrder);

route.get('/orders', userMiddlewares.checkSession, userOrderController.getOrders);

route.post('/orders/:orderId/cancel', userMiddlewares.checkSession, userOrderController.cancelOrder);

route.post('/orders/:orderId/return', userMiddlewares.checkSession, userOrderController.requestReturn);

route.get('/forgot-password', userMiddlewares.isLogin, userController.getForgotPassword);

route.post('/forgot-password/send-otp', userController.sendForgotPasswordOTP);

route.post('/forgot-password/verify-otp', userController.verifyForgotPasswordOTP);

route.post('/forgot-password/reset-password', userController.resetPassword);

route.post('/checkout/apply-coupon', userMiddlewares.checkSession, userCheckoutController.applyCoupon);

route.post('/checkout/remove-coupon', userMiddlewares.checkSession, userCheckoutController.removeCoupon);

route.get('/checkout/available-coupons', userMiddlewares.checkSession, userCheckoutController.getAvailableCoupons);

route.get('/wishlist', userMiddlewares.checkSession, wishlistController.getWishlist);

route.post('/wishlist/add', userMiddlewares.checkSession, wishlistController.addToWishlist);

route.delete('/wishlist/remove/:productId', userMiddlewares.checkSession, wishlistController.removeFromWishlist);

route.get('/wishlist/check/:productId', userMiddlewares.checkSession, wishlistController.checkWishlistStatus);

route.post('/checkout/create-razorpay-order', userMiddlewares.checkSession, userCheckoutController.createRazorpayOrder);

route.post('/checkout/verify-payment', userMiddlewares.checkSession, userCheckoutController.verifyPayment);

route.get('/wallet', userMiddlewares.checkSession, walletController.getWallet);

route.post('/wallet/add-funds', userMiddlewares.checkSession, walletController.addFunds);

route.post('/checkout/wallet-payment', userMiddlewares.checkSession, userCheckoutController.walletPayment);

route.get('/coupons', userMiddlewares.checkSession, couponController.getCoupons);

route.get('/change-password', userMiddlewares.checkSession, userController.getChangePassword);

route.post('/change-password', userMiddlewares.checkSession, userController.changePassword);

route.get('/orders/:orderId/invoice', userMiddlewares.checkSession, userOrderController.generateInvoice);

export default route;

