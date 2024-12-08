import User from '../model/userModel.js';
import { config } from 'dotenv';

config()

const getAdmin = (req, res) => {
    res.render('admin/login', { message: null });
};

const postAdmin = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Basic validation
        if (!email || !password) {
            return res.render('admin/login', {
                message: 'All fields are required',
                alertType: 'error'
            });
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.render('admin/login', {
                message: 'Invalid email format',
                alertType: 'error'
            });
        }

        // Check credentials
        if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
            req.session.isAdmin = true;
            req.session.adminEmail = email;
            return res.render('admin/dashboard', {
                message: 'Login successful',
                alertType: 'success'
            });
        } else {
            return res.render('admin/login', {
                message: 'Invalid credentials',
                alertType: 'error'
            });
        }
    } catch (error) {
        console.error('Admin login error:', error);
        res.render('admin/login', {
            message: 'Internal server error',
            alertType: 'error'
        });
    }
};

const getLogout = (req, res) => {
    req.session.destroy(() => {
        res.redirect('/admin/login');
    });
}

const getDashboard = (req, res) => {
    res.render('admin/dashboard')
}


// Get the list of all users
const getUserList = async (req, res) => {
    try {
        const userList = await User.find(); // Fetch all users from the database
        res.render('admin/userList', { userList }); // Render a view to display the users
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
};

const getToggle = async (req, res) => {
    try {
      const userId = req.params.id;
      const user = await User.findById(userId);
  
      if (!user) {
        return res.status(404).send('User not found');
      }
  
      // Toggle the block status
      user.blocked = !user.blocked;
      await user.save();
  
      // Redirect back to the user list page
      res.redirect('/admin/userList');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  }


export default { getAdmin, postAdmin, getLogout, getDashboard, getUserList, getToggle }