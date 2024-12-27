import mongoose from 'mongoose';

const offerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        enum: ['product', 'category'],
        required: true
    },
    discount: {
        type: Number,
        required: true,
        min: 0,
        max: 100
    },
    applicableTo: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        // Reference will be either to Product or Category based on type
        refPath: 'type'
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'expired'],
        default: 'active'
    },
}, {
    timestamps: true
});


export default mongoose.model('Offer', offerSchema); 