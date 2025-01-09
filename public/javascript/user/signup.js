document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('signup-form');
    const passwordToggles = document.querySelectorAll('.fa-eye');

    // Password validation function
    const validatePassword = (password) => {
        const minLength = 8;
        const maxLength = 12;

        // Check length
        if (password.length < minLength || password.length > maxLength) {
            return {
                isValid: false,
                message: `Password must be between ${minLength} and ${maxLength} characters long`
            };
        }

        // Check for uppercase letter
        if (!/[A-Z]/.test(password)) {
            return {
                isValid: false,
                message: 'Password must contain at least one uppercase letter'
            };
        }

        // Check for lowercase letter
        if (!/[a-z]/.test(password)) {
            return {
                isValid: false,
                message: 'Password must contain at least one lowercase letter'
            };
        }

        // Check for number
        if (!/[0-9]/.test(password)) {
            return {
                isValid: false,
                message: 'Password must contain at least one number'
            };
        }

        return { isValid: true };
    };

    // Helper function to show error
    const showError = (elementId, message) => {
        const errorElement = document.getElementById(elementId);
        errorElement.textContent = message;
        errorElement.classList.remove('hidden');
        // Add red border to input
        document.getElementById(elementId.replace('Error', '')).classList.add('border-red-500');
    };

    // Helper function to hide error
    const hideError = (elementId) => {
        const errorElement = document.getElementById(elementId);
        errorElement.classList.add('hidden');
        // Remove red border from input
        document.getElementById(elementId.replace('Error', '')).classList.remove('border-red-500');
    };

    // Real-time validation for First Name
    document.getElementById('firstName').addEventListener('input', function() {
        const value = this.value.trim();
        if (!/^[a-zA-Z]{3,10}$/.test(value)) {
            showError('firstNameError', 'First name should contain only letters (3-10 characters)');
        } else {
            hideError('firstNameError');
        }
    });

    // Real-time validation for Last Name
    document.getElementById('lastName').addEventListener('input', function() {
        const value = this.value.trim();
        if (!/^[a-zA-Z]{1,10}$/.test(value)) {
            showError('lastNameError', 'Last name should contain only letters (1-10 characters)');
        } else {
            hideError('lastNameError');
        }
    });

    // Real-time validation for Email
    document.getElementById('email').addEventListener('input', function() {
        const value = this.value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            showError('emailError', 'Please enter a valid email address');
        } else {
            hideError('emailError');
        }
    });

    // Real-time validation for Password
    document.getElementById('password').addEventListener('input', function() {
        const value = this.value;
        const validation = validatePassword(value);
        if (!validation.isValid) {
            showError('passwordError', validation.message);
        } else {
            hideError('passwordError');
        }
    });

    // Real-time validation for Confirm Password
    document.getElementById('confirmPassword').addEventListener('input', function() {
        const password = document.getElementById('password').value;
        if (this.value !== password) {
            showError('confirmPasswordError', 'Passwords do not match');
        } else {
            hideError('confirmPasswordError');
        }
    });

    // Form submission
    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        let hasErrors = false;

        // Clear all previous errors
        const errorElements = document.querySelectorAll('[id$="Error"]');
        errorElements.forEach(element => element.classList.add('hidden'));

        const firstName = document.getElementById('firstName').value.trim();
        const lastName = document.getElementById('lastName').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        // Validate all fields
        if (!firstName || !/^[a-zA-Z]{3,10}$/.test(firstName)) {
            showError('firstNameError', 'First name should contain only letters (3-10 characters)');
            hasErrors = true;
        }

        if (!lastName || !/^[a-zA-Z]{1,10}$/.test(lastName)) {
            showError('lastNameError', 'Last name should contain only letters (1-10 characters)');
            hasErrors = true;
        }

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showError('emailError', 'Please enter a valid email address');
            hasErrors = true;
        }

        const passwordValidation = validatePassword(password);
        if (!passwordValidation.isValid) {
            showError('passwordError', passwordValidation.message);
            hasErrors = true;
        }

        if (password !== confirmPassword) {
            showError('confirmPasswordError', 'Passwords do not match');
            hasErrors = true;
        }

        if (hasErrors) return;

        // Show loading spinner
        const loadingSpinner = document.getElementById('loading-spinner');
        loadingSpinner.classList.remove('hidden');

        // If no errors, proceed with form submission
        try {
            const response = await fetch('/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    firstName,
                    lastName,
                    email,
                    password
                })
            });

            const data = await response.json();
            
            // Hide loading spinner
            loadingSpinner.classList.add('hidden');

            if (data.success) {
                // Show OTP modal
                document.getElementById('otpModal').classList.remove('hidden');
                document.getElementById('otpModal').classList.add('flex');
            } else {
                document.getElementById('generalError').textContent = data.message;
                document.getElementById('generalError').classList.remove('hidden');
            }
        } catch (error) {
            // Hide loading spinner
            loadingSpinner.classList.add('hidden');
            
            console.error('Error:', error);
            document.getElementById('generalError').textContent = 'Something went wrong! Please try again.';
            document.getElementById('generalError').classList.remove('hidden');
        }
    });

    // Password toggle functionality
    passwordToggles.forEach(toggle => {
        toggle.addEventListener('click', function () {
            const input = this.closest('.relative').querySelector('input');
            if (input.type === 'password') {
                input.type = 'text';
                this.classList.remove('fa-eye');
                this.classList.add('fa-eye-slash');
            } else {
                input.type = 'password';
                this.classList.remove('fa-eye-slash');
                this.classList.add('fa-eye');
            }
        });
    });

    // Add OTP input handling
    const otpInputs = document.querySelectorAll('.otp-input');
    otpInputs.forEach((input, index) => {
        input.addEventListener('input', function () {
            if (this.value.length === 1) {
                if (index < otpInputs.length - 1) otpInputs[index + 1].focus();
            }
        });

        input.addEventListener('keydown', function (e) {
            if (e.key === 'Backspace' && !this.value) {
                if (index > 0) otpInputs[index - 1].focus();
            }
        });
    });

    // Handle OTP verification
    document.getElementById('verifyOtp').addEventListener('click', async function () {
        const otp = Array.from(otpInputs).map(input => input.value).join('');
        const email = document.getElementById('email').value;
        const otpError = document.getElementById('otpError');
        const otpLoadingSpinner = document.getElementById('otp-loading-spinner');

        try {
            // Show loading spinner
            otpLoadingSpinner.classList.remove('hidden');
            
            const response = await fetch('/validate-otp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userOtp: otp, email })
            });

            const data = await response.json();
            
            // Hide loading spinner
            otpLoadingSpinner.classList.add('hidden');

            if (data.success) {
                window.location.href = data.redirectUrl;
            } else {
                // Show error message
                otpError.textContent = data.error || 'Invalid OTP';
                otpError.classList.remove('hidden');
                
                // Clear OTP inputs
                otpInputs.forEach(input => input.value = '');
                otpInputs[0].focus();
            }
        } catch (error) {
            // Hide loading spinner
            otpLoadingSpinner.classList.add('hidden');
            
            console.error('Error:', error);
            otpError.textContent = 'Failed to verify OTP';
            otpError.classList.remove('hidden');
        }
    });

    // Handle resend OTP
    document.getElementById('resendOtp').addEventListener('click', async function() {
        const email = document.getElementById('email').value;
        const resendButton = this;
        const resendMessage = document.getElementById('resendMessage');
        const otpError = document.getElementById('otpError');
        const resendTimer = document.getElementById('resendTimer');
        const loadingSpinner = document.getElementById('loading-spinner');

        try {
            // Disable button immediately to prevent multiple clicks
            resendButton.disabled = true;
            
            // Show loading spinner
            loadingSpinner.classList.remove('hidden');
            
            const response = await fetch('/resend-otp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            // Hide loading spinner
            loadingSpinner.classList.add('hidden');

            // Clear previous error message
            otpError.classList.add('hidden');

            // Show resend message
            resendMessage.textContent = data.message;
            resendMessage.classList.remove('hidden');
            resendMessage.style.color = data.success ? '#065F46' : '#9B1C1C';

            if (data.success) {
                // Start countdown timer
                let timeLeft = 60;
                resendTimer.classList.remove('hidden');
                const countdownInterval = setInterval(() => {
                    resendTimer.textContent = `Resend available in ${timeLeft}s`;
                    timeLeft--;

                    if (timeLeft < 0) {
                        clearInterval(countdownInterval);
                        resendButton.disabled = false;
                        resendTimer.classList.add('hidden');
                        resendMessage.classList.add('hidden');
                    }
                }, 1000);
            } else {
                // If failed, re-enable the button
                resendButton.disabled = false;
            }

        } catch (error) {
            // Hide loading spinner
            loadingSpinner.classList.add('hidden');
            
            console.error('Error:', error);
            resendMessage.textContent = 'Failed to resend OTP';
            resendMessage.classList.remove('hidden');
            resendButton.disabled = false;
        }
    });
});