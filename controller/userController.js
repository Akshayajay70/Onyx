import userSchema from '../model/userModel.js'
import bcrypt from 'bcrypt'
import { generateOTP, sendOTPEmail } from '../utils/sendOTP.js'
import passport from 'passport';
import Product from '../model/productModel.js'
import { calculateFinalPrice } from '../utils/calculateOffer.js';
import Offer from '../model/offerModel.js';


const getHome = async (req, res) => {
    try {
        // Fetch active products with their categories
        const products = await Product.find({ isActive: true })
            .populate('categoriesId')
            .sort({ createdAt: -1 })
            .limit(5);

        // Fetch all active offers
        const offers = await Offer.find({
            status: 'active',
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() }
        });

        // Process each product to include offer prices
        const processedProducts = products.map(product => {
            const productOffer = offers.find(offer => 
                offer.productIds && offer.productIds.some(id => id.equals(product._id))
            );
            
            const categoryOffer = offers.find(offer => 
                offer.categoryId && offer.categoryId.equals(product.categoriesId._id)
            );

            const finalPrice = calculateFinalPrice(product, categoryOffer, productOffer);
            
            return {
                ...product.toObject(),
                discountPrice: finalPrice,
                originalPrice: product.price,
                offerApplied: finalPrice < product.price,
                offerPercentage: productOffer?.discount || categoryOffer?.discount || 0
            };
        });

        res.render('user/home', { 
            products: processedProducts,
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

            const names = profile.displayName.split(' ');
            const firstName = names[0];
            const lastName = names.slice(1).join(' ')
            
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
                firstName: firstName,
                lastName: lastName,
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
        // Fetch all active products with their categories
        const products = await Product.find({ isActive: true })
            .populate('categoriesId');

        // Fetch all active offers
        const offers = await Offer.find({
            status: 'active',
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() }
        });

        // Process each product to include offer prices
        const processedProducts = products.map(product => {
            // Find applicable offers for this product
            const productOffer = offers.find(offer => 
                offer.productIds && offer.productIds.some(id => id.equals(product._id))
            );
            
            const categoryOffer = offers.find(offer => 
                offer.categoryId && offer.categoryId.equals(product.categoriesId._id)
            );

            // Calculate final price with offers
            const discountPrice = calculateFinalPrice(product, categoryOffer, productOffer);

            return {
                ...product.toObject(),
                price: product.price, // Original price
                discountPrice: discountPrice, // Price after applying offers
                hasDiscount: discountPrice < product.price,
                discountPercentage: Math.round((product.price - discountPrice) / product.price * 100)
            };
        });

        res.render('user/shop', { 
            products: processedProducts,
            title: 'Shop'
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).render('user/shop', { 
            products: [],
            title: 'Shop',
            error: 'Failed to load products'
        });
    }
};

const getForgotPassword = (req, res) => {
    res.render('user/forgotPassword');
};

const sendForgotPasswordOTP = async (req, res) => {
    try {
        const { email } = req.body;
        
        // Find user
        const user = await userSchema.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!user.password) {
            return res.status(400).json({ 
                message: 'This email is linked to Google login. Please login with Google.' 
            });
        }

        // Generate and save OTP
        const otp = generateOTP();
        user.otp = otp;
        user.otpExpiresAt = Date.now() + 120000; // 2 minutes
        user.otpAttempts = 0;
        await user.save();

        // Send OTP email
        await sendOTPEmail(email, otp);
        
        res.status(200).json({ message: 'OTP sent successfully' });
    } catch (error) {
        console.error('Send OTP error:', error);
        res.status(500).json({ message: 'Failed to send OTP' });
    }
};

const verifyForgotPasswordOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        
        const user = await userSchema.findOne({ 
            email,
            otp,
            otpExpiresAt: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        // Increment attempts
        user.otpAttempts += 1;
        if (user.otpAttempts >= 3) {
            await userSchema.findByIdAndUpdate(user._id, {
                $unset: { otp: 1, otpExpiresAt: 1, otpAttempts: 1 }
            });
            return res.status(400).json({ message: 'Too many attempts. Please try again.' });
        }
        await user.save();

        if (user.otp !== otp) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        res.status(200).json({ message: 'OTP verified successfully' });
    } catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({ message: 'Failed to verify OTP' });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { email, newPassword } = req.body;
        
        const user = await userSchema.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
        
        // Update password and remove OTP fields
        await userSchema.findByIdAndUpdate(user._id, {
            $set: { password: hashedPassword },
            $unset: { otp: 1, otpExpiresAt: 1, otpAttempts: 1 }
        });

        res.status(200).json({ message: 'Password reset successfully' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ message: 'Failed to reset password' });
    }
};

const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.session.user;

        const user = await userSchema.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Current password is incorrect' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
        
        // Update password
        await userSchema.findByIdAndUpdate(userId, {
            password: hashedPassword
        });

        res.status(200).json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ message: 'Failed to update password' });
    }
};

const getChangePassword = async (req, res) => {
    try {
        // Get user from session
        const userId = req.session.user;
        const user = await userSchema.findById(userId);

        if (!user) {
            return res.redirect('/login');
        }

        // Check if user has a password (not Google login)
        if (!user.password) {
            return res.redirect('/profile');
        }

        // Pass the user object to the view
        res.render('user/changePassword', { user });

    } catch (error) {
        console.error('Get change password error:', error);
        res.status(500).render('error', { 
            message: 'Error loading change password page',
            error: error.message 
        });
    }
};

export default {
    getHome,
    getLogout,
    getGoogleCallback,
    getGoogle, 
    getShop, 
    getForgotPassword, 
    sendForgotPasswordOTP, 
    verifyForgotPasswordOTP, 
    resetPassword, 
    changePassword,
    getChangePassword 
}