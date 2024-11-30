
import { Router } from 'express'
import userSchema from '../model/userModel.js'
import bcrypt from 'bcrypt'
import { generateOTP, sendOTPEmail } from '../utils/sendOTP.js'

const saltRounds = 10;

const route = Router()

route.get('/signup', (req, res) => {
    res.render('user/signup')
})

route.get('/validate-otp', (req, res) => {
    res.render('user/otp')
})

route.post('/signup', async (req, res) => {
    try {
        const { fullName, email, password } = req.body;

        // Check if user exists and not verified
        const existingUser = await userSchema.findOne({ email });
        if (existingUser) {
            if (!existingUser.isVerified) {
                await userSchema.deleteOne({ _id: existingUser._id });
            } else {
                return res.status(400).json({ error: 'User already exists' });
            }
        }

        const otp = generateOTP();
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const newUser = new userSchema({
            fullName,
            email,
            password: hashedPassword,
            otp,
            otpExpiresAt: Date.now() + 120000, // 2 minutes
            otpAttempts: 0
        });

        await newUser.save();

        // Schedule deletion after OTP expiry
        setTimeout(async () => {
            const user = await userSchema.findOne({ email });
            if (user && !user.isVerified) {
                await userSchema.deleteOne({ _id: user._id });
            }
        }, 120000);

        await sendOTPEmail(email, otp);
        res.render('user/otp');
    } catch (error) {
        res.status(500).json({ error: 'Signup failed' });
    }
});

route.post('/validate-otp', async (req, res) => {
    try {
        const { userOtp } = req.body;
        const user = await userSchema.findOne({ otp: userOtp });

        if (!user || Date.now() > user.otpExpiresAt) {
            if (user) {
                user.otpAttempts += 1;
                if (user.otpAttempts >= 3) {
                    await userSchema.deleteOne({ _id: user._id });
                    return res.status(400).json({ error: 'Too many attempts' });
                }
                await user.save();
            }
            return res.status(400).json({ error: 'Invalid OTP' });
        }

        await userSchema.findByIdAndUpdate(user._id, {
            $set: { isVerified: true },
            $unset: { otp: 1, otpExpiresAt: 1, otpAttempts: 1 }
        });

        res.redirect('/home');
    } catch (error) {
        res.status(500).json({ error: 'Validation failed' });
    }
});

route.post('/resend-otp', async (req, res) => {
    try {
        const user = await userSchema.findOne({ isVerified: false });
        if (!user) return res.status(400).json({ error: 'User not found' });

        const otp = generateOTP();
        user.otp = otp;
        user.otpExpiresAt = Date.now() + 120 * 1000;
        user.otpAttempts = 0;
        await user.save();

        await sendOTPEmail(user.email, otp);
        res.status(200).json({ message: 'OTP resent' });
    } catch (error) {
        res.status(500).json({ error: 'Resend failed' });
    }
});

route.get('/login', (req, res) => {
    res.render('user/login')
})

route.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await userSchema.findOne({ email });

        if (!user) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        if (!user.isVerified) {
            return res.status(400).json({ error: 'Please verify your email first' });
        }

        req.session.user = {
            id: user._id,
            email: user.email
        };

        res.redirect('/home');
    } catch (error) {
        res.status(500).json({ error: 'Login failed' });
    }
});

route.get('/home', (req, res) => {
    res.render('user/home')
})

export default route
