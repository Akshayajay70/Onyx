import userModel from "../model/userModel.js"

const checkSession = async (req, res, next) => {
    try {
        // Check if session exists
        if (!req.session.user) {
            return res.redirect('/login?message=Please+login+to+continue&alertType=info');
        }

        // Verify user exists and is active
        const user = await userModel.findById(req.session.user);
        
        if (!user) {
            // User no longer exists
            req.session.destroy();
            return res.redirect('/login?message=Account+not+found&alertType=error');
        }

        if (user.blocked) {
            // User is blocked
            req.session.destroy();
            return res.redirect('/login?message=Your+account+has+been+blocked&alertType=error');
        }

        next();

    } catch (error) {
        console.error('Session Check Error:', error);
        return res.redirect('/login?message=Session+error+occurred&alertType=error');
    }
}

const isLogin = async (req, res, next) => {
    try {
        if (req.session.user) {
            return res.redirect('/home');
        }
        next();
    } catch (error) {
        console.error('Login Check Error:', error);
        next();
    }
}

export default { 
    isLogin, 
    checkSession 
}