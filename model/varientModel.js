import mongoose from "mongoose";

const variantSchema = new mongoose.Schema({
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
    discountPrice: {
        type: Number,
        required: true,
        min: 0
    },
    discountPercentage: {
        type: Number,
        required: true,
        min: 0,
        max: 100
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
}, { timestamps: true });

export default mongoose.model('Variant', variantSchema);