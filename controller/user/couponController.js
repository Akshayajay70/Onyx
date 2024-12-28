import Coupon from '../../model/couponModel.js';

const couponController = {
    getCoupons: async (req, res) => {
        try {
            const currentDate = new Date();
            
            // Find active coupons that haven't expired
            const coupons = await Coupon.find({
                isActive: true,
                startDate: { $lte: currentDate },
                expiryDate: { $gt: currentDate }
            }).sort({ createdAt: -1 });

            // Filter out coupons that have reached their usage limit
            const availableCoupons = coupons.filter(coupon => {
                if (!coupon.totalCoupon) return true;
                return coupon.usedCouponCount < coupon.totalCoupon;
            });

            res.render('user/coupon', { coupons: availableCoupons });
            
        } catch (error) {
            console.error('Get coupons error:', error);
            res.status(500).render('error', { 
                message: 'Error fetching coupons'
            });
        }
    }
};

export default couponController; 