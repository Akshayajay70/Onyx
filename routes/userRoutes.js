
import { Router } from 'express'
import userSchema from '../model/userModel.js'
import bcrypt from 'bcrypt'
import { generateOTP, sendOTPEmail } from '../utils/sendOTP.js'

const saltRounds = 10;

const route = Router()

route.get('/signup', (req, res) => {
    res.render('user/signup')
})

route.post('/signup', async (req, res) => {


    try {
        const { fullName, email, password } = req.body
        const otp = generateOTP()
        console.log(typeof otp)

        // handle if the user is already exists
        const user = await userSchema.findOne({ email })
        if (user) return res.render('user/signup')

        // hash the user password
        const hashedPassword = await bcrypt.hash(password, saltRounds)

        // set the user schema
        const newUser = new userSchema({
            fullName,
            email,
            password: hashedPassword,
            otp,
            otpExpiresAt: Date.now() + 120000, // 2 minutes from now
            isVerified: false,
        });


        // save user details in db
        await newUser.save()

        // Store OTP and its expiry in session
        req.session.userOTP = {
            otp,
            email,
            expiryTime: Date.now() + 120000, // 1 minute from now
            userId: newUser._id
        }

        // send otp to the user mail
        await sendOTPEmail(email, otp)

        res.render('user/otp')
    } catch (error) {
        console.log('ERROR', error)
        res.render('user/signup')
    }

})

route.post('/validate-otp', async (req, res) => {
    try {
        const { userOtp } = req.body;

        const { otp } = req.session.userOTP

        if (userOtp == otp) {
            const username = req.session.userOTP.username
            req.session.user = {
                username
            }
            req.session.userOtp = undefined
            res.send('success')

        }

    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Validation failed');
    }
});

route.get('/validate-otp', (req, res) => {
    res.render('user/otp')
})

route.post('/resend-otp', async (req, res) => {
    try {
        const { email } = req.session.userOTP
        if (!email) {
            return res.status(400).send('Session expired')
        }

        const otp = generateOTP()
        const user = await userSchema.findOneAndUpdate(
            { email },
            {
                otp,
                otpExpiresAt: Date.now() + 120000 // 2 minutes
            }
        )

        if (!user) {
            return res.status(404).send('User not found')
        }

        // Update session
        req.session.userOTP = {
            ...req.session.userOTP,
            otp,
            expiryTime: Date.now() + 120000
        }

        await sendOTPEmail(email, otp)
        res.status(200).send('OTP resent successfully')

    } catch (error) {
        console.error('Resend OTP Error:', error)
        res.status(500).send('Failed to resend OTP')
    }
})

route.get('/login', (req, res) => {
    res.render('user/login')
})

route.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body
        const user = await userSchema.findOne({ email })
        const isMatch = await bcrypt.compare(password, user.password)
        if (!email || !isMatch) return res.render('user/login')

        req.session.user = true
        res.render('user/home')
    }
    catch (error) {
        console.log("ERROR", error)
        res.render('user/login')
    }
})

route.get('/home', (req, res) => {
    res.render('user/home')
})

export default route
