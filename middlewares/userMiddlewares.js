
const checkSession = (req, res, next) => {
    if (req.session.user) {
        next()
    } else {
        res.redirect('/login')
    }
}

const isLogin  = (req, res, next)=>{
 
    if(req.session.user){
        res.redirect('/home')
    }else{
        next()
    }
}

export const restrictManualAccess = (req, res, next) => {
    // Example: Check for a valid session or custom header
    if (!req.headers['x-triggered-by'] || req.headers['x-triggered-by'] !== 'UI') {
        return res.status(403).send('Unauthorized access');
    }
    next();
};



export default { isLogin, checkSession, restrictManualAccess }