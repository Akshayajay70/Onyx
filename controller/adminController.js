import User from '../model/userModel.js';
import { config } from 'dotenv';

config()

const getAdmin = (req, res) => {
    res.render('admin/login');
}

const postAdmin = async (req, res) => {
    const { email, password } = req.body;
    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
        req.session.isAdmin = true; // Set admin session
        res.render('admin/dashboard');
    } else {
        res.render('admin/login');
    }
}

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