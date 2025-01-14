import User from '../../model/userModel.js';

// Get the list of all users with pagination
const getUserList = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10; // Users per page
        const skip = (page - 1) * limit;

        // Get total count for pagination
        const totalUsers = await User.countDocuments();
        const totalPages = Math.ceil(totalUsers / limit);

        const userList = await User.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // If it's an AJAX request, return partial view
        if (req.xhr) {
            return res.render('admin/userList', {
                userList,
                pagination: {
                    currentPage: page,
                    totalPages,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1,
                    nextPage: page + 1,
                    prevPage: page - 1
                }
            });
        }

        // Regular page load
        res.render('admin/userList', {
            userList,
            pagination: {
                currentPage: page,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
                nextPage: page + 1,
                prevPage: page - 1
            }
        });
    } catch (error) {
        console.error(error);
        if (req.xhr) {
            return res.status(500).json({ error: 'Failed to fetch users' });
        }
        res.status(500).send('Server error');
    }
};

const getToggle = async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        user.blocked = !user.blocked;
        await user.save();

        // Return JSON response for API calls
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.json({ 
                success: true, 
                message: `User successfully ${user.blocked ? 'blocked' : 'unblocked'}`
            });
        }

        // Fallback to redirect for regular form submissions
        res.redirect('/admin/userList');
    } catch (err) {
        console.error(err);
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(500).json({ error: 'Server Error' });
        }
        res.status(500).send('Server Error');
    }
};

export default { getUserList, getToggle }