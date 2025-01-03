import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        required: true
    },
    orderCode: {
        type: String,
        unique: true
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
        discountedPrice: {
            type: Number,
            default: 0
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
    coupon: {
        code: {
            type: String,
            default: null
        },
        discount: {
            type: Number,
            default: 0
        }
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
    payment: {
        method: {
            type: String,
            enum: ['cod', 'online', 'razorpay', 'wallet'],
            required: true
        },
        paymentStatus: {
            type: String,
            enum: ['pending', 'completed', 'failed', 'refunded', 'cancelled', 'refund processing'],
            default: 'pending'
        },
        walletTransaction: {
            transactionId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Wallet.transactions'
            },
            amount: Number
        },
        razorpayTransaction: {
            razorpayOrderId: String,
            razorpayPaymentId: String,
            razorpaySignature: String
        }
    },
    order:{
        status: {
            type: String,
            enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned', 'refund processing'],
            default: 'pending'
        },
        statusHistory: [{
            status: {
                type: String,
                enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 
                       'returned', 'refund processing'],
                required: true
            },
            date: {
                type: Date,
                default: Date.now
            },
            comment: String
        }],
    },
    cancellation: {
        isCancelled: {
            type: Boolean,
            default: false
        },
        reason: {
            type: String,
            default: null
        },
        cancellationDate: {
            type: Date,
            default: null
        }
    },
    return: {
        isReturnRequested: {
            type: Boolean,
            default: false
        },
        reason: {
            type: String,
            default: null
        },
        requestDate: {
            type: Date,
            default: null
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending'
        },
        adminComment: {
            type: String,
            default: null
        },
        isReturnAccepted: {
            type: Boolean,
            default: false
        }
    },
    orderDate: {
        type: Date,
        default: Date.now
    },
}, {timestamps: true}
);

// Pre-save middleware to generate orderCode
orderSchema.pre('save', function(next) {
    if (!this.orderCode && this._id) {
        const day = this.createdAt.getDate().toString().padStart(2, '0');
        const month = (this.createdAt.getMonth() + 1).toString().padStart(2, '0');
        const year = this.createdAt.getFullYear();
        const dateStr = `${day}${month}${year}`;
        const idSuffix = this._id.toString().slice(-6);
        this.orderCode = `${dateStr}${idSuffix}`;
    }
    next();
});

export default mongoose.model('Order', orderSchema);

