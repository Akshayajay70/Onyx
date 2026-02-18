import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    firstName: {
        type: String,
        trim: true,
        minlength: 3,
        maxlength: 10
    },
    lastName: {
        type: String,
        trim: true,
        minlength: 0,
        maxlength: 10
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    password: { type: String },

    googleId: { type: String },

    isVerified: { type: Boolean, default: false },

    otp: { type: String},

    otpExpiresAt: {type: Date},

    otpAttempts: { type: Number, default: 0 },

    blocked: { type: Boolean, default: false },

  },
  { timestamps: true });
  
  export default mongoose.model('users', userSchema);
  