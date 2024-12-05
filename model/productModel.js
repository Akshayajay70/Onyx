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
    varientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Variant",
        required: false,
    },
}, { timestamps: true });

export default mongoose.model("Product", productSchema);