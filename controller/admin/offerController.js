import Offer from '../../model/offerModel.js';
import Product from '../../model/productModel.js';
import Category from '../../model/categoryModel.js';

const offerController = {
    // Get all offers
    getOffers: async (req, res) => {
        try {
            const offers = await Offer.find()
                .populate('applicableTo')
                .sort('-createdAt');

            const products = await Product.find({ status: 'active' });
            const categories = await Category.find({ status: 'active' });

            res.render('admin/offers', {
                offers,
                products,
                categories
            });
        } catch (error) {
            console.error('Get offers error:', error);
            res.status(500).render('error', { message: 'Error loading offers' });
        }
    },

    // Create new offer
    createOffer: async (req, res) => {
        try {
            const {
                name,
                type,
                discount,
                applicableTo,
                startDate,
                endDate,
                description
            } = req.body;

            // Validate dates
            const start = new Date(startDate);
            const end = new Date(endDate);
            
            if (start >= end) {
                return res.status(400).json({
                    success: false,
                    message: 'End date must be after start date'
                });
            }

            // Check for existing offers on same product/category
            const existingOffer = await Offer.findOne({
                type,
                applicableTo,
                status: 'active',
                $or: [
                    {
                        startDate: { $lte: end },
                        endDate: { $gte: start }
                    }
                ]
            });

            if (existingOffer) {
                return res.status(400).json({
                    success: false,
                    message: 'An active offer already exists for this item during the selected period'
                });
            }

            const offer = await Offer.create({
                name,
                type,
                discount,
                applicableTo,
                startDate: start,
                endDate: end,
                description,
                status: 'active'
            });

            res.json({
                success: true,
                message: 'Offer created successfully',
                offer
            });

        } catch (error) {
            console.error('Create offer error:', error);
            res.status(500).json({
                success: false,
                message: 'Error creating offer'
            });
        }
    },

    // Update offer
    updateOffer: async (req, res) => {
        try {
            const { offerId } = req.params;
            const {
                name,
                discount,
                startDate,
                endDate,
                status,
                description
            } = req.body;

            const offer = await Offer.findById(offerId);
            if (!offer) {
                return res.status(404).json({
                    success: false,
                    message: 'Offer not found'
                });
            }

            // Update fields
            offer.name = name;
            offer.discount = discount;
            offer.startDate = new Date(startDate);
            offer.endDate = new Date(endDate);
            offer.status = status;
            offer.description = description;

            await offer.save();

            res.json({
                success: true,
                message: 'Offer updated successfully',
                offer
            });

        } catch (error) {
            console.error('Update offer error:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating offer'
            });
        }
    },

    // Delete offer
    deleteOffer: async (req, res) => {
        try {
            const { offerId } = req.params;
            await Offer.findByIdAndDelete(offerId);

            res.json({
                success: true,
                message: 'Offer deleted successfully'
            });

        } catch (error) {
            console.error('Delete offer error:', error);
            res.status(500).json({
                success: false,
                message: 'Error deleting offer'
            });
        }
    }
};

export default offerController; 