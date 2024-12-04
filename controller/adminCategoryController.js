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
        const newCategory = new Category({
            name: categoryName,
            description: categoryDescription,
            isActive: true, // Default to active
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
        await Category.findByIdAndUpdate(categoryId, {
            name: categoryName,
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
