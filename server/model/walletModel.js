import mongoose from 'mongoose';

const walletSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    balance: {
        type: Number,
        default: 0
    },
    transactions: [{
        type: {
            type: String,
            enum: ['credit', 'debit'],
            required: true
        },
        amount: {
            type: Number,
            required: true
        },
        description: {
            type: String,
            required: true
        },
        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order'
        },
        date: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true
});

export default mongoose.model('Wallet', walletSchema); 