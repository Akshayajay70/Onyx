import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Category name is required'],
            trim: true,
            minlength: [1, 'Category name cannot be empty'],
            maxlength: [10, 'Category name must be at most 10 characters'],
            match: [/^[A-Za-z]+$/, 'Category name can only contain alphabets'],
        },
        description: {
            type: String,
            required: [true, 'Description is required'],
            minlength: [10, 'Description must be at least 25 characters'],
            maxlength: [100, 'Description must be at most 100 characters'],
        },
    },
    { timestamps: true }
);
const Category = mongoose.model('Category', categorySchema);

export default Category;
