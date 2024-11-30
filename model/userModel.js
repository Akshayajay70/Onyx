import mongoose from "mongoose"


const userSchema = new mongoose.Schema({
    fullName :{
        type: String,
        required: true
    },
    username: {
        type: String,
    },
    email: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    mobileNumber: {
        type: Number
    },
    createdAt: {
        type : Date,
        default: Date.now()
    },
    updatedAt: {
        type : Date,
        default: Date.now()
    },
    isActive: {
        type : Boolean,
        default: false
    },
    otp: {
        type: String
    },
    otpCreatedAt: { 
        type: Date,
        default: Date.now, 
        expires: 120 
    }
})

export default mongoose.model('users', userSchema);