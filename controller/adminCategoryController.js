import Category from '../model/categoryModel.js';

// GET: Render Categories Page
const getCategories = async (req, res) => {
    try {
        const categories = await Category.find().sort({ createdAt: -1 }); // Fetch all categories sorted by creation date
        res.render('admin/category', { categories });
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).send('Error fetching categories.');
    }
};

// POST: Add a New Category
const addCategory = async (req, res) => {
    try {
        const { categoryName, categoryDescription } = req.body;

        // Validate categoryName
        if (!/^[A-Za-z]+$/.test(categoryName.trim())) {
            return res.status(400).send('Category name can only contain alphabets.');
        }
        if (categoryName.trim().length > 10) {
            return res.status(400).send('Category name must not exceed 10 characters.');
        }

        // Validate categoryDescription
        if (categoryDescription.length < 25 || categoryDescription.length > 100) {
            return res.status(400).send(
                'Description must be between 25 and 100 characters.'
            );
        }

        const newCategory = new Category({
            name: categoryName.trim(),
            description: categoryDescription,
            isActive: true,
        });

        await newCategory.save();
        res.redirect('/admin/category');
    } catch (error) {
        console.error('Error adding category:', error);
        res.status(500).send('Error adding category.');
    }
};

// POST: Edit Category
const editCategory = async (req, res) => {
    try {
        const { categoryId, categoryName, categoryDescription } = req.body;

        // Validate categoryName
        if (!/^[A-Za-z]+$/.test(categoryName.trim())) {
            return res.status(400).send('Category name can only contain alphabets.');
        }
        if (categoryName.trim().length > 10) {
            return res.status(400).send('Category name must not exceed 10 characters.');
        }

        // Validate categoryDescription
        if (categoryDescription.length < 25 || categoryDescription.length > 100) {
            return res.status(400).send(
                'Description must be between 25 and 100 characters.'
            );
        }

        await Category.findByIdAndUpdate(categoryId, {
            name: categoryName.trim(),
            description: categoryDescription,
        });

        res.redirect('/admin/category');
    } catch (error) {
        console.error('Error editing category:', error);
        res.status(500).send('Error editing category.');
    }
};

// GET: Delete Category
const deleteCategory = async (req, res) => {
    try {
        const { id } = req.query;
        await Category.findByIdAndDelete(id);
        res.redirect('/admin/category');
    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).send('Error deleting category.');
    }
};

// GET: Toggle Category Status
const toggleCategoryStatus = async (req, res) => {
    try {
        const { id } = req.query;
        const category = await Category.findById(id);
        if (category) {
            category.isActive = !category.isActive; // Toggle the isActive status
            await category.save();
        }
        res.redirect('/admin/category');
    } catch (error) {
        console.error('Error toggling category status:', error);
        res.status(500).send('Error toggling category status.');
    }
};


export default { addCategory, getCategories, editCategory, deleteCategory, toggleCategoryStatus }
