import Coupon from '../model/couponModel.js';

const adminCouponController = {
    // Get all coupons
    getCoupons: async (req, res) => {
        try {
            const coupons = await Coupon.find().sort({ createdAt: -1 });
            res.render('admin/coupon', { coupons });
        } catch (error) {
            console.error('Error fetching coupons:', error);
            res.status(500).json({ message: 'Error fetching coupons' });
        }
    },

    // Add new coupon
    addCoupon: async (req, res) => {
        try {
            const {
                code,
                description,
                discountPercentage,
                minimumPurchase,
                maximumDiscount,
                startDate,
                expiryDate,
                totalCoupon,
                userUsageLimit
            } = req.body;

            // Validate discount percentage
            if (discountPercentage < 0 || discountPercentage > 100) {
                return res.status(400).json({ message: 'Discount percentage must be between 0 and 100' });
            }

            // Check if coupon code already exists
            const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
            if (existingCoupon) {
                return res.status(400).json({ message: 'Coupon code already exists' });
            }

            // Create new coupon
            const newCoupon = new Coupon({
                code: code.toUpperCase(),
                description,
                discountPercentage,
                minimumPurchase: minimumPurchase || 0,
                maximumDiscount: maximumDiscount || null,
                startDate,
                expiryDate,
                totalCoupon: totalCoupon || null,
                userUsageLimit: userUsageLimit || 1
            });

            await newCoupon.save();
            res.status(200).json({ message: 'Coupon added successfully' });
        } catch (error) {
            console.error('Error adding coupon:', error);
            res.status(500).json({ message: 'Error adding coupon' });
        }
    },

    // Get coupon details
    getCouponDetails: async (req, res) => {
        try {
            const coupon = await Coupon.findById(req.params.id);
            if (!coupon) {
                return res.status(404).json({ message: 'Coupon not found' });
            }
            res.json(coupon);
        } catch (error) {
            console.error('Error fetching coupon details:', error);
            res.status(500).json({ message: 'Error fetching coupon details' });
        }
    },

    // Update coupon
    updateCoupon: async (req, res) => {
        try {
            const {
                code,
                description,
                discountPercentage,
                minimumPurchase,
                maximumDiscount,
                startDate,
                expiryDate,
                totalCoupon,
                userUsageLimit
            } = req.body;

            // Validate discount percentage
            if (discountPercentage < 0 || discountPercentage > 100) {
                return res.status(400).json({ message: 'Discount percentage must be between 0 and 100' });
            }

            // Check if updated code conflicts with existing coupons
            const existingCoupon = await Coupon.findOne({
                code: code.toUpperCase(),
                _id: { $ne: req.params.id }
            });
            if (existingCoupon) {
                return res.status(400).json({ message: 'Coupon code already exists' });
            }

            const updatedCoupon = await Coupon.findByIdAndUpdate(
                req.params.id,
                {
                    code: code.toUpperCase(),
                    description,
                    discountPercentage,
                    minimumPurchase: minimumPurchase || 0,
                    maximumDiscount: maximumDiscount || null,
                    startDate,
                    expiryDate,
                    totalCoupon: totalCoupon || null,
                    userUsageLimit: userUsageLimit || 1
                },
                { new: true }
            );

            if (!updatedCoupon) {
                return res.status(404).json({ message: 'Coupon not found' });
            }

            res.status(200).json({ message: 'Coupon updated successfully' });
        } catch (error) {
            console.error('Error updating coupon:', error);
            res.status(500).json({ message: 'Error updating coupon' });
        }
    },

    // Delete coupon
    deleteCoupon: async (req, res) => {
        try {
            const deletedCoupon = await Coupon.findByIdAndDelete(req.params.id);
            if (!deletedCoupon) {
                return res.status(404).json({ message: 'Coupon not found' });
            }
            res.status(200).json({ message: 'Coupon deleted successfully' });
        } catch (error) {
            console.error('Error deleting coupon:', error);
            res.status(500).json({ message: 'Error deleting coupon' });
        }
    },

    // Toggle coupon status
    toggleCouponStatus: async (req, res) => {
        try {
            const coupon = await Coupon.findById(req.params.id);
            if (!coupon) {
                return res.status(404).json({ message: 'Coupon not found' });
            }

            coupon.isActive = !coupon.isActive;
            await coupon.save();

            res.status(200).json({ 
                message: `Coupon ${coupon.isActive ? 'activated' : 'deactivated'} successfully` 
            });
        } catch (error) {
            console.error('Error toggling coupon status:', error);
            res.status(500).json({ message: 'Error updating coupon status' });
        }
    }
};

export default adminCouponController;
