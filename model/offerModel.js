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
    description: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

// Virtual for checking if offer is currently active
offerSchema.virtual('isActive').get(function() {
    const now = new Date();
    return this.status === 'active' && 
           now >= this.startDate && 
           now <= this.endDate;
});

export default mongoose.model('Offer', offerSchema); 