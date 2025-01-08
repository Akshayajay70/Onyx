import userSchema from '../../model/userModel.js'
import bcrypt from 'bcrypt'
import { generateOTP, sendOTPEmail } from '../../utils/sendOTP.js'

const saltRounds = 10;

const getSignUp = (req, res) => {
    res.render('user/signup')
}

const postSignUp = async (req, res) => {
    try {
        const { firstName, lastName, email, password } = req.body;
        
        // Validate first name
        if (!firstName || !/^[a-zA-Z]{3,10}$/.test(firstName.trim())) {
            return res.status(400).json({
                success: false,
                message: 'First name should contain only letters (3-10 characters)'
            });
        }

        // Validate last name
        if (!lastName || !/^[a-zA-Z]{1,10}$/.test(lastName.trim())) {
            return res.status(400).json({
                success: false,
                message: 'Last name should contain only letters (1-10 characters)'
            });
        }

        // Validate email
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid email address'
            });
        }

        // Validate password
        const validatePassword = (pwd) => {
            if (pwd.length < 8 || pwd.length > 12) {
                return { isValid: false, message: 'Password must be between 8 and 12 characters long' };
            }
            if (!/[A-Z]/.test(pwd)) {
                return { isValid: false, message: 'Password must contain at least one uppercase letter' };
            }
            if (!/[a-z]/.test(pwd)) {
                return { isValid: false, message: 'Password must contain at least one lowercase letter' };
            }
            if (!/[0-9]/.test(pwd)) {
                return { isValid: false, message: 'Password must contain at least one number' };
            }
            return { isValid: true };
        };

        const passwordValidation = validatePassword(password);
        if (!passwordValidation.isValid) {
            return res.status(400).json({
                success: false,
                message: passwordValidation.message
            });
        }

        // Check if user exists
        const existingUser = await userSchema.findOne({ email });
        
        if (existingUser && !existingUser.isVerified) {
            await userSchema.deleteOne({ _id: existingUser._id });
        } else if (existingUser) {
            const message = !existingUser.password 
                ? "This email is linked to a Google login. Please log in with Google."
                : "Email already registered";
                
            return res.status(400).json({
                success: false,
                message
            });
        }

        const otp = generateOTP();
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const newUser = new userSchema({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email,
            password: hashedPassword,
            otp,
            otpExpiresAt: Date.now() + 120000,
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
        res.json({ 
            success: true, 
            message: 'OTP sent successfully',
            email: email
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({
            success: false,
            message: 'Signup failed'
        });
    }
}

const postOtp = async (req, res) => {
    try {
        const { userOtp, email } = req.body;
        const user = await userSchema.findOne({ email, otp: userOtp });

        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid OTP' });
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

            req.session.user = user._id;
            return res.json({ 
                success: true, 
                message: 'OTP verified successfully',
                redirectUrl: '/home'
            });
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
        const { email } = req.body;
        const user = await userSchema.findOne({ email, isVerified: false });
        
        if (!user) {
            return res.status(400).json({ 
                success: false, 
                message: 'User not found or already verified' 
            });
        }

        const otp = generateOTP();
        user.otp = otp;
        user.otpExpiresAt = Date.now() + 120 * 1000;
        user.otpAttempts = 0;
        await user.save();

        await sendOTPEmail(email, otp);
        
        res.status(200).json({ 
            success: true, 
            message: 'OTP has been sent to your email' 
        });
    } catch (error) {
        console.error('Resend OTP error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to resend OTP' 
        });
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
                message: "Your email is not registered. Please signup first.",
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

export default { getSignUp, postSignUp, postOtp, postResendOtp, getLogin, postLogin }