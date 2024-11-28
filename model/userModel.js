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
        type: Number,
    },
    createdAt: {
        type : Date,
        default: Date.now()
    },
    updatedAt: {
        type : Date,
        default: Date.now()
    }
})

export default mongoose.model('users', userSchema);