import mongoose from 'mongoose'

const wishlistSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "users",
            required: true,
        },
        items: [{
            productId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Product",
                required: true
            },
            addedAt: {
                type: Date,
                default: Date.now
            }
        }]
    },
    {
        timestamps: true,
    }
);

export default mongoose.model("Wishlist", wishlistSchema);
