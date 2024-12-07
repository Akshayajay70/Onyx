import userSchema from '../model/userModel.js'
import bcrypt from 'bcrypt'
import { generateOTP, sendOTPEmail } from '../utils/sendOTP.js'
import passport from 'passport';
import Product from '../model/productModel.js'

const saltRounds = 10;

const getSignUp = (req, res) => {
    res.render('user/signup')
}

const postSignUp = async (req, res) => {
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
}

const postOtp = async (req, res) => {
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

        req.session.user = true
        res.render('user/home');

    } catch (error) {
        res.status(500).json({ error: 'Validation failed' });
    }
}

const postResendOtp = async (req, res) => {
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
}

const getLogin = (req, res) => {
    res.render('user/login')
}

const postLogin = async (req, res) => {
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

        if (user.blocked) {
            return res.status(400).json({ error: 'You\'re blocked' });
        }

        req.session.user = true

        res.redirect('/home');
    } catch (error) {
        res.status(500).json({ error: 'Login failed' });
    }
}

const getHome = async (req, res) => {
    try {
        const products = await Product.find({ isActive: true })
            .populate('categoriesId')
            .sort({ createdAt: -1 })
            .limit(5);

        res.render('user/home', { 
            products,
            title: 'Home'
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.render('user/home', { 
            products: [],
            title: 'Home'
        });
    }
};

const getLogout = (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
}

const getGoogleCallback = (req, res) => {
    passport.authenticate("google", { failureRedirect: "/login" }, (err, user, info) => {
        if (err || !user) {
            return res.redirect("/login");  // Redirect to login page in case of failure
        }

        // Store user information in session after successful Google login
        req.session.user = {
            id: user._id,
            fullname: user.fullname,
            email: user.email,
        };

        // Redirect to home page after successful login
        return res.redirect("/home");
    })(req, res);
};

const getGoogle = (req, res) => {
    passport.authenticate("google", {
        scope: ["email", "profile"],
    })(req, res);
};

const getShop = async (req, res) => {
    try {
        const products = await Product.find({ isActive: true })
            .populate('categoriesId')
            .sort({ createdAt: -1 });

        res.render('user/shop', { 
            products,
            title: 'Shop'
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.render('user/shop', { 
            products: [],
            title: 'Shop'
        });
    }
};

export default { getSignUp, postSignUp, postOtp, postResendOtp, getLogin, postLogin, getHome, getLogout, getGoogleCallback, getGoogle, getShop }