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
        
        const trimmedFullName = fullName.trim();

        // Check if user exists
        const existingUser = await userSchema.findOne({ email });
        
        // If user exists but is not verified, delete the old record
        if (existingUser && !existingUser.isVerified) {
            await userSchema.deleteOne({ _id: existingUser._id });
        } else if (existingUser) {
            // If user exists and is verified, show appropriate message
            let message = existingUser.email === email ? "Email already registered" : "Phone number already registered";
            if (!existingUser.password) {
                message = "This email is linked to a Google login. Please log in with Google.";
            }
            return res.render('user/signup', {
                message,
                alertType: "error",
            });
        }

        const otp = generateOTP();
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const newUser = new userSchema({
            fullName: trimmedFullName,
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
        }, 180000);

        await sendOTPEmail(email, otp);
        res.render('user/otp');
    } catch (error) {
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
        
        // Server-side validation
        if (!email || !password) {
            return res.render('user/login', {
                message: 'All fields are required',
                alertType: "error",
            });
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.render('user/login', {
                message: 'Invalid email format',
                alertType: "error",
            });
        }

        // Find user
        const user = await userSchema.findOne({ email });

        // Check if user exists
        if (!user) {
            return res.render('user/login', {
                message: 'Invalid credentials',
                alertType: "error",
            });
        }

        if(!user.password) {
            return res.render('user/login', {
                message: 'This email is linked to a Google login. Please log in with Google.',
                alertType: "error",
            })
        }

        // Check if user is verified
        if (!user.isVerified) {
            return res.render('user/login', {
                message: 'Please verify your email first',
                alertType: "error",
            });
        }

        // Check if user is blocked
        if (user.blocked) {
            return res.render('user/login', {
                message: 'Your account has been blocked',
                alertType: "error",
            });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.render('user/login', {
                message: 'Invalid credentials',
                alertType: "error",
            });
        }

        // Set session
        req.session.user = user._id;
        req.session.userEmail = user.email;

        // Redirect to home
        res.redirect('/home');

    } catch (error) {
        console.error('Login error:', error);
        return res.render('user/login', {
            message: 'Login failed',
            alertType: "error",
        });
    }
};

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

const getGoogle = (req, res) => {
    // Store the trigger in session before redirecting to Google
    req.session.authTrigger = req.query.trigger;
    
    passport.authenticate("google", {
        scope: ["email", "profile"],
    })(req, res);
};

const getGoogleCallback = (req, res) => {
    passport.authenticate("google", { failureRedirect: "/login" }, async (err, profile) => {
        try {
            if (err || !profile) {
                return res.redirect("/login?message=Authentication failed&alertType=error");
            }

            const existingUser = await userSchema.findOne({ email: profile.email });
            
            // If user exists, check if blocked before logging in
            if (existingUser) {
                // Check if user is blocked
                if (existingUser.blocked) {
                    return res.redirect("/login?message=Your account has been blocked&alertType=error");
                }

                // Update googleId if it doesn't exist and unset otpAttempts
                await userSchema.findByIdAndUpdate(existingUser._id, {
                    $set: { googleId: existingUser.googleId || profile.id },
                    $unset: { otpAttempts: 1 }
                });
                
                req.session.user = existingUser._id;
                return res.redirect("/home");
            }

            // If user doesn't exist, create new account
            const newUser = new userSchema({
                fullName: profile.displayName,
                email: profile.email,
                googleId: profile.id,
                isVerified: true,
            });
            await newUser.save();
            await userSchema.findByIdAndUpdate(newUser._id, {
                $unset: { otpAttempts: 1 }
            });
            
            req.session.user = newUser._id;
            return res.redirect("/home");

        } catch (error) {
            console.error("Google authentication error:", error);
            return res.redirect("/login?message=Authentication failed&alertType=error");
        }
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