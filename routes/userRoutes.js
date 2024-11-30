
import { Router } from 'express'
import userController from '../controller/userController.js'




const route = Router()

route.get('/signup', userController.getSignUp)

route.get('/validate-otp', userController.getOtp)

route.post('/signup', userController.postSignUp);

route.post('/validate-otp', userController.postOtp);

route.post('/resend-otp', userController.postResendOtp);

route.get('/login', userController.getLogin)

route.post('/login', userController.postLogin);

route.get('/home', userController.getHome)

export default route
