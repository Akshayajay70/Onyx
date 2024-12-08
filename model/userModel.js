import mongoose from "mongoose";

const userSchema = new mongoose.Schema({

    fullName: { type: String, required: true },

    email: { type: String, required: true },

    password: { type: String },

    googleId: { type: String, sparse: true },

    isVerified: { type: Boolean, default: false },

    otp: { type: String},

    otpExpiresAt: {type: Date},

    otpAttempts: { type: Number, default: 0 },

    blocked: { type: Boolean, default: false },

  },
  { timestamps: true });
  
  export default mongoose.model('users', userSchema);
  