import { Router } from 'express';
import passport from 'passport';
import userController from '../controller/userController.js';

const route = Router();

// Existing routes
route.get('/signup', userController.getSignUp);

route.get('/validate-otp', userController.getOtp);

route.post('/signup', userController.postSignUp);

route.post('/validate-otp', userController.postOtp);

route.post('/resend-otp', userController.postResendOtp);

route.get('/login', userController.getLogin);

route.post('/login', userController.postLogin);

route.get('/home', userController.getHome);

route.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

route.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), (req, res) => res.redirect('/home'));

export default route;

