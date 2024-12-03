// Function to validate full name (between 4 to 15 letters)
function validateFullName() {
    const fullName = document.getElementById('fullName').value;
    const nameError = document.getElementById('fullName-error');
    const nameRegex = /^[a-zA-Z\s]{4,15}$/;

    if (!nameRegex.test(fullName)) {
        nameError.textContent = 'Full Name must be between 4 and 15 letters';
        return false;
    } else {
        nameError.textContent = '';
        return true;
    }
}

// Function to validate email format
function validateEmail() {
    const email = document.getElementById('email').value;
    const emailError = document.getElementById('email-error');
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;

    if (!emailRegex.test(email)) {
        emailError.textContent = 'Please enter a valid email address';
        return false;
    } else {
        emailError.textContent = '';
        return true;
    }
}

// Function to validate password (min 8 characters, 1 uppercase, 1 lowercase, 1 letter)
function validatePassword() {
    const password = document.getElementById('password').value;
    const passwordError = document.getElementById('password-error');
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

    if (!passwordRegex.test(password)) {
        passwordError.textContent = 'Password must be at least 8 characters, including 1 uppercase, 1 lowercase, and 1 letter';
        return false;
    } else {
        passwordError.textContent = '';
        return true;
    }
}

// Function to validate confirm password
function validateConfirmPassword() {
    const confirmPassword = document.getElementById('confirmPassword').value;
    const password = document.getElementById('password').value;
    const confirmPasswordError = document.getElementById('confirmPassword-error');

    if (confirmPassword !== password) {
        confirmPasswordError.textContent = 'Passwords do not match';
        return false;
    } else {
        confirmPasswordError.textContent = '';
        return true;
    }
}

// Function to validate the entire form before submission
function validateForm(event) {
    event.preventDefault(); // Prevent form submission

    const isFullNameValid = validateFullName();
    const isEmailValid = validateEmail();
    const isPasswordValid = validatePassword();
    const isConfirmPasswordValid = validateConfirmPassword();

    if (isFullNameValid && isEmailValid && isPasswordValid && isConfirmPasswordValid) {
        // Form is valid, submit the form
        document.getElementById('signup-form').submit();
    } else {
        // Form is invalid, prevent submission
        return false;
    }
}

// Toggle password visibility
document.getElementById('toggle-password').addEventListener('click', function () {
    const passwordField = document.getElementById('password');
    const passwordEyeIcon = document.getElementById('password-eye');

    // Toggle password visibility
    if (passwordField.type === 'password') {
        passwordField.type = 'text';
        passwordEyeIcon.classList.remove('fa-eye');
        passwordEyeIcon.classList.add('fa-eye-slash');
    } else {
        passwordField.type = 'password';
        passwordEyeIcon.classList.remove('fa-eye-slash');
        passwordEyeIcon.classList.add('fa-eye');
    }
});

// Toggle confirm password visibility
document.getElementById('toggle-confirm-password').addEventListener('click', function () {
    const confirmPasswordField = document.getElementById('confirmPassword');
    const confirmPasswordEyeIcon = document.getElementById('confirm-password-eye');

    // Toggle confirm password visibility
    if (confirmPasswordField.type === 'password') {
        confirmPasswordField.type = 'text';
        confirmPasswordEyeIcon.classList.remove('fa-eye');
        confirmPasswordEyeIcon.classList.add('fa-eye-slash');
    } else {
        confirmPasswordField.type = 'password';
        confirmPasswordEyeIcon.classList.remove('fa-eye-slash');
        confirmPasswordEyeIcon.classList.add('fa-eye');
    }
})

// Add event listeners for the form submit and input validation
document.getElementById('signup-form').addEventListener('submit', validateForm);

// Optional: Add input event listeners to validate each field dynamically while typing
document.getElementById('fullName').addEventListener('input', validateFullName);
document.getElementById('email').addEventListener('input', validateEmail);
document.getElementById('password').addEventListener('input', validatePassword);
document.getElementById('confirmPassword').addEventListener('input', validateConfirmPassword);


