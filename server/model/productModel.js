import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
    productName: {
        type: String,
        required: true,
        trim: true
    },
    brand: {
        type: String,
        required: true,
        trim: true
    },
    gender: {
        type: String,
        enum: ["male", "female", "unisex"],
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    categoriesId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
        required: true,
    },
    color: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true,
        trim: true,
        minLength: 10,
        maxLength: 25
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    rating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },
    stock: {
        type: Number,
        required: true,
        min: 0
    },
    imageUrl: [String],
    
    offer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Offer'
    },
    offerPrice: {
        type: Number,
        min: 0
    },
    offerApplied: {
        type: Boolean,
        default: false
    },
    offerType: {
        type: String,
        enum: ['product', 'category', 'none'],
        default: 'none'
    }
}, 
{ timestamps: true });

export default mongoose.model("Product", productSchema);