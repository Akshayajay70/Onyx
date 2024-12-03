import mongoose from "mongoose";

const userSchema = new mongoose.Schema({

    fullName: { type: String, required: true },

    email: { type: String, required: true },

    password: { type: String },

    googleId: { type: String },

    isVerified: { type: Boolean, default: false },

    otp: { type: String},

    otpExpiresAt: {type: Date},

    otpAttempts: { type: Number, default: 0 },

    createdAt: { type: Date, default: Date.now },

    updatedAt: { type: Date, default: Date.now }

  });
  
  export default mongoose.model('users', userSchema);
  