import mongoose from "mongoose";

const couponSchema = new mongoose.Schema({
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },
    description: {
      type: String,
    },
    discountPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    minimumPurchase: {
      type: Number,
      default: 0
    },
    maximumDiscount: {
      type: Number,  
      default: null
    },
    startDate: {
      type: Date,
      required: true
    },
    expiryDate: {
      type: Date,
      required: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    totalCoupon: {
      type: Number,  
      default: null
    },
    usedCouponCount: {
      type: Number,
      default: 0
    },
    userUsageLimit: {
      type: Number,
      default: 1
    },
    usedBy: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users'
      },
      usedAt: {
        type: Date,
        default: Date.now
      },
      orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
      }
    }]
  }, {
    timestamps: true
  });

export default mongoose.model('coupon', couponSchema);


