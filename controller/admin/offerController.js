import Offer from '../../model/offerModel.js';
import Product from '../../model/productModel.js';
import Category from '../../model/categoryModel.js';
import mongoose from 'mongoose';

const offerController = {
    // Get all offers
    getOffers: async (req, res) => {
        try {
            const offers = await Offer.find()
                .populate('productIds')
                .populate('categoryId')
                .sort('-createdAt');

            const products = await Product.find({ isActive: true });
            const categories = await Category.find({ isActive: true });

            res.render('admin/offers', {
                offers,
                products,
                categories
            });
        } catch (error) {
            console.error('Get offers error:', error);
            res.status(500).json({ message: 'Error loading offers' });
        }
    },

    // Create new offer
    createOffer: async (req, res) => {
        try {
            const {
                name,
                type,
                itemIds,
                discount,
                startDate,
                endDate
            } = req.body;

            // Validate required fields
            if (!name || !type || !itemIds || !discount || !startDate || !endDate) {
                return res.status(400).json({
                    success: false,
                    message: 'All fields are required'
                });
            }

            // Create offer data
            const offerData = {
                name,
                discount: Number(discount),
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                status: 'active'
            };

            // Set either categoryId or productIds based on type
            if (type === 'category') {
                offerData.categoryId = itemIds[0]; // Single category ID
                offerData.productIds = []; // Empty product array
            } else {
                offerData.productIds = itemIds; // Array of product IDs
                offerData.categoryId = null; // No category
            }

            // Create single offer
            const offer = await Offer.create(offerData);

            // Update products if it's a product offer
            if (type === 'product') {
                await Product.updateMany(
                    { _id: { $in: itemIds } },
                    {
                        offer: offer._id,
                        offerApplied: true,
                        offerType: 'product'
                    }
                );
            }

            res.json({
                success: true,
                message: 'Offer created successfully',
                offer
            });

        } catch (error) {
            console.error('Create offer error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Error creating offer'
            });
        }
    },

    // Get single offer
    getOffer: async (req, res) => {
        try {
            const { offerId } = req.params;
            const offer = await Offer.findById(offerId)
                .populate('productIds')
                .populate('categoryId');

            if (!offer) {
                return res.status(404).json({
                    success: false,
                    message: 'Offer not found'
                });
            }

            res.json({
                success: true,
                offer
            });

        } catch (error) {
            console.error('Get offer error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching offer details'
            });
        }
    },

    // Update offer
    updateOffer: async (req, res) => {
        try {
            const { offerId } = req.params;
            const {
                name,
                type,
                itemIds,
                discount,
                startDate,
                endDate
            } = req.body;

            const existingOffer = await Offer.findById(offerId);
            if (!existingOffer) {
                return res.status(404).json({
                    success: false,
                    message: 'Offer not found'
                });
            }

            // Remove offer reference from old products
            if (existingOffer.productIds.length > 0) {
                await Product.updateMany(
                    { _id: { $in: existingOffer.productIds } },
                    {
                        offer: null,
                        offerApplied: false,
                        offerType: null
                    }
                );
            }

            // Update offer data
            const updateData = {
                name,
                discount: Number(discount),
                startDate: new Date(startDate),
                endDate: new Date(endDate)
            };

            // Update either categoryId or productIds based on type
            if (type === 'category') {
                updateData.categoryId = itemIds[0];
                updateData.productIds = [];
            } else {
                updateData.productIds = itemIds;
                updateData.categoryId = null;
            }

            const updatedOffer = await Offer.findByIdAndUpdate(
                offerId,
                updateData,
                { new: true }
            );

            // Update new products if it's a product offer
            if (type === 'product') {
                await Product.updateMany(
                    { _id: { $in: itemIds } },
                    {
                        offer: updatedOffer._id,
                        offerApplied: true,
                        offerType: 'product'
                    }
                );
            }

            res.json({
                success: true,
                message: 'Offer updated successfully',
                offer: updatedOffer
            });

        } catch (error) {
            console.error('Update offer error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Error updating offer'
            });
        }
    },

    // Delete offer
    deleteOffer: async (req, res) => {
        try {
            const { offerId } = req.params;
            const offer = await Offer.findById(offerId);

            if (!offer) {
                return res.status(404).json({
                    success: false,
                    message: 'Offer not found'
                });
            }

            // Remove offer reference from products
            if (offer.productIds.length > 0) {
                await Product.updateMany(
                    { _id: { $in: offer.productIds } },
                    {
                        offer: null,
                        offerApplied: false,
                        offerType: null
                    }
                );
            }

            await offer.deleteOne();

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