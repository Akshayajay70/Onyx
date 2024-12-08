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
    next();
};



export default { isLogin, checkSession, restrictManualAccess }