import { Router } from 'express';
import userController from '../controller/userController.js';
import userMiddlewares from '../middlewares/userMiddlewares.js';

const route = Router();

route.get('/signup', userMiddlewares.isLogin, userController.getSignUp);

route.post('/signup', userController.postSignUp);

route.post('/validate-otp', userController.postOtp);

route.post('/resend-otp', userController.postResendOtp);

route.get('/login', userMiddlewares.isLogin, userController.getLogin);

route.post('/login', userController.postLogin);

route.get('/home', userMiddlewares.checkSession, userController.getHome);

route.get('/auth/google', userMiddlewares.isLogin, userMiddlewares.restrictManualAccess, userController.getGoogle);

route.get('/auth/google/callback', userMiddlewares.isLogin, userController.getGoogleCallback);

route.get('/logout', userMiddlewares.checkSession, userController.getLogout)

export default route;

