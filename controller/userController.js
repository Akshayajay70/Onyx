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

        // Check if user exists
        const existingUser = await userSchema.findOne({ email });

        if (existingUser) {
            // If user exists but is not verified, delete the old entry
            if (!existingUser.isVerified) {
                await userSchema.deleteOne({ email });
            } else {
                // If user exists and is verified, show appropriate message
                let message = "Email already registered";
                if (!existingUser.password) {
                    message = "This email is linked to a Google login. Please log in with Google.";
                }
                return res.render('user/signup', {
                    message,
                    alertType: "error",
                });
            }
        }

        // Create new user
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

        // Store email in session for OTP resend
        req.session.tempEmail = email;

        // Schedule deletion after OTP expiry (3 minutes)
        setTimeout(async () => {
            const user = await userSchema.findOne({ email });
            if (user && !user.isVerified) {
                await userSchema.deleteOne({ _id: user._id });
            }
        }, 180000); // 3 minutes

        await sendOTPEmail(email, otp);
        res.render('user/otp');
    } catch (error) {
        console.error('Signup error:', error);
        res.render('user/signup', {
            message: 'Signup failed',
            alertType: "error",
        });
    }
}

const postOtp = async (req, res) => {
    try {
        const { userOtp } = req.body;
        const user = await userSchema.findOne({ otp: userOtp });

        if (!user) {
            return res.status(400).json({ error: 'Invalid OTP' });
        }

        if (Date.now() > user.otpExpiresAt) {
            user.otpAttempts += 1;
            if (user.otpAttempts >= 3) {
                await userSchema.deleteOne({ _id: user._id });
                return res.status(400).json({ error: 'Too many attempts. Please signup again.' });
            }
            await user.save();
            return res.status(400).json({ error: 'OTP expired' });
        }

        // Increment attempts before validating to prevent brute force
        user.otpAttempts += 1;
        if (user.otpAttempts >= 3) {
            await userSchema.deleteOne({ _id: user._id });
            return res.status(400).json({ error: 'Too many attempts. Please signup again.' });
        }
        await user.save();

        // If OTP matches, verify user
        if (user.otp === userOtp) {
            await userSchema.findByIdAndUpdate(user._id, {
                $set: { isVerified: true },
                $unset: { otp: 1, otpExpiresAt: 1, otpAttempts: 1 }
            });

            req.session.user = user._id; // Store user ID in session
            return res.redirect('/home')
        } else {
            return res.status(400).json({ error: 'Invalid OTP' });
        }

    } catch (error) {
        console.error('OTP verification error:', error);
        return res.status(500).json({ error: 'OTP verification failed' });
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