
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

export default { getAdmin, postAdmin, getLogout, getDashboard }