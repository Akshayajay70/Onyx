import mongoose from "mongoose"


const userSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String, required: true },
    mobileNumber: Number,
    isVerified: { type: Boolean, default: false },
    otp: String,
    otpExpiresAt: Date,
    otpAttempts: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
 })

export default mongoose.model('users', userSchema);