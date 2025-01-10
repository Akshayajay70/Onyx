import { Router } from 'express';
import authController from '../controller/user/authController.js';
import userController from '../controller/userController.js';
import productController from '../controller/user/viewProductController.js';
import userMiddlewares from '../middlewares/userMiddlewares.js';
import profileController from '../controller/user/profileController.js';
import addressController from '../controller/user/addressController.js';
import userCartController from '../controller/userCartController.js';
import userCheckoutController from '../controller/userCheckoutController.js';
import userOrderController from '../controller/userOrderController.js';
import wishlistController from '../controller/user/wishlistController.js';
import walletController from '../controller/user/walletController.js';
import couponController from '../controller/user/couponController.js';

const route = Router();

route.get('/signup', userMiddlewares.isLogin, authController.getSignUp);

route.post('/signup', authController.postSignUp);

route.post('/validate-otp', authController.postOtp);

route.post('/resend-otp', authController.postResendOtp);

route.get('/login', userMiddlewares.isLogin, authController.getLogin);

route.post('/login', authController.postLogin);

route.get('/forgot-password', userMiddlewares.isLogin, authController.getForgotPassword);

route.post('/forgot-password/send-otp', authController.sendForgotPasswordOTP);

route.post('/forgot-password/verify-otp', authController.verifyForgotPasswordOTP);

route.post('/forgot-password/reset-password', authController.resetPassword);

route.get('/change-password', userMiddlewares.checkSession, authController.getChangePassword);

route.post('/change-password', userMiddlewares.checkSession, authController.postChangePassword);

route.get('/product/:id', userMiddlewares.checkSession, productController.getProductDetails);

route.get('/auth/google', authController.getGoogle);

route.get('/logout', userMiddlewares.checkSession, authController.getLogout);

route.get('/', userController.getHome)

route.get('/home', userMiddlewares.checkSession, userController.getHome);

route.get('/shop', userMiddlewares.checkSession, userController.getShop);

route.get('/auth/google/callback', authController.getGoogleCallback);

route.get('/profile', userMiddlewares.checkSession, profileController.getProfile);

route.post('/profile/update', userMiddlewares.checkSession, profileController.updateProfile);

route.get('/address', userMiddlewares.checkSession, addressController.getAddress);

route.post('/address/add', userMiddlewares.checkSession, addressController.addAddress);

route.delete('/address/:id', userMiddlewares.checkSession, addressController.deleteAddress);

route.put('/address/:id', userMiddlewares.checkSession, addressController.editAddress);

route.get('/cart', userMiddlewares.checkSession, userCartController.getCart);

route.post('/cart/add', userMiddlewares.checkSession, userCartController.addToCart);

route.post('/cart/update-quantity', userMiddlewares.checkSession, userCartController.updateQuantity);

route.delete('/cart/remove/:productId', userMiddlewares.checkSession, userCartController.removeFromCart);

route.get('/checkout', userMiddlewares.checkSession, userCheckoutController.getCheckoutPage);

route.post('/checkout/place-order', userMiddlewares.checkSession, userCheckoutController.placeOrder);

route.get('/orders', userMiddlewares.checkSession, userOrderController.getOrders);

route.post('/orders/:orderId/cancel', userMiddlewares.checkSession, userOrderController.cancelOrder);

route.post('/orders/:orderId/return', userMiddlewares.checkSession, userOrderController.requestReturn);

route.post('/orders/:orderId/retry-payment', userMiddlewares.checkSession, userOrderController.retryPayment);

route.post('/orders/:orderId/verify-retry-payment', userMiddlewares.checkSession, userOrderController.verifyRetryPayment);

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

route.get('/orders/:orderId/invoice', userMiddlewares.checkSession, userOrderController.generateInvoice);

route.post('/checkout/payment-failed', userMiddlewares.checkSession, userCheckoutController.handlePaymentFailure);

export default route;

