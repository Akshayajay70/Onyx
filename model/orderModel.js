import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        required: true
    },
    items: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        price: {
            type: Number,
            required: true
        },
        subtotal: {
            type: Number,
            required: true
        }
    }],
    totalAmount: {
        type: Number,
        required: true
    },
    shippingAddress: {
        fullName: String,
        mobileNumber: Number,
        addressLine1: String,
        addressLine2: String,
        city: String,
        state: String,
        pincode: Number
    },
    paymentMethod: {
        type: String,
        enum: ['cod', 'online', 'razorpay', 'wallet'],
        required: true
    },
    walletTransaction: {
        transactionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Wallet.transactions'
        },
        amount: Number
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'refunded'],
        default: 'pending'
    },
    orderStatus: {
        type: String,
        enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'],
        default: 'pending'
    },
    statusHistory: [{
        status: {
            type: String,
            enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned']
        },
        date: {
            type: Date,
            default: Date.now
        },
        comment: String
    }],
    cancellationReason: {
        type: String
    },
    returnReason: {
        type: String,
        default: null
    },
    returnRequestDate: {
        type: Date,
        default: null
    },
    returnStatus: {
        type: String,
        enum: ['pending', 'approved', 'rejected', null],
        default: null
    },
    isReturnAccepted: {
        type: Boolean,
        default: false
    },
    orderDate: {
        type: Date,
        default: Date.now
    }
}, {timestamps: true}
);

export default mongoose.model('Order', orderSchema);

