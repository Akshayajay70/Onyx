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

const restrictManualAccess = (req, res, next) => {
    if (req.path === '/auth/google' && 
        req.query.trigger !== 'signup' && 
        req.query.trigger !== 'login') {
        return res.status(403).send('Unauthorized access');
    }
    next();
};



export default { isLogin, checkSession, restrictManualAccess }