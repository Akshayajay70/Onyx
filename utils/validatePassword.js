const validatePassword = (pwd) => {
    if (pwd.length < 8 || pwd.length > 12) {
        return { isValid: false, message: 'Password must be between 8 and 12 characters long' };
    }
    if (!/[A-Z]/.test(pwd)) {
        return { isValid: false, message: 'Password must contain at least one uppercase letter' };
    }
    if (!/[a-z]/.test(pwd)) {
        return { isValid: false, message: 'Password must contain at least one lowercase letter' };
    }
    if (!/[0-9]/.test(pwd)) {
        return { isValid: false, message: 'Password must contain at least one number' };
    }
    return { isValid: true };
};

export default validatePassword;