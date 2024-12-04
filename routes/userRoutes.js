import { Router } from 'express';
import passport from 'passport';
import userController from '../controller/userController.js';
import userMiddlewares from '../middlewares/userMiddlewares.js';

const route = Router();

// Existing routes
route.get('/signup', userMiddlewares.isLogin, userController.getSignUp);

route.post('/signup', userController.postSignUp);

route.post('/validate-otp', userController.postOtp);

route.post('/resend-otp', userController.postResendOtp);

route.get('/login', userMiddlewares.isLogin, userController.getLogin);

route.post('/login', userController.postLogin);

route.get('/home', userMiddlewares.checkSession, userController.getHome);

route.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

route.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), (req, res) => res.redirect('/home'));

route.get('/logout', userMiddlewares.checkSession, userController.getLogout)

export default route;

