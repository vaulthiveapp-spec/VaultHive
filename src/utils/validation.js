
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email) {
    return 'Email is required';
  }
  if (email.length > 254) {
    return 'Email is too long';
  }
  if (!emailRegex.test(email)) {
    return 'Please enter a valid email address';
  }
  return null;
};

export const validatePassword = (password, options = {}) => {
  const {
    minLength = 6,
    requireUppercase = true,
    requireLowercase = true,
    requireNumbers = true,
    requireSpecialChars = false
  } = options;

  if (!password) {
    return 'Password is required';
  }
  
  if (password.length < minLength) {
    return `Password must be at least ${minLength} characters long`;
  }
  
  if (password.length > 128) {
    return 'Password is too long (max 128 characters)';
  }
  
  if (requireLowercase && !/(?=.*[a-z])/.test(password)) {
    return 'Password must contain at least one lowercase letter';
  }
  
  if (requireUppercase && !/(?=.*[A-Z])/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }
  
  if (requireNumbers && !/(?=.*\d)/.test(password)) {
    return 'Password must contain at least one number';
  }
  
  if (requireSpecialChars && !/(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/.test(password)) {
    return 'Password must contain at least one special character';
  }
  
  return null;
};

export const validateName = (name, options = {}) => {
  const { minLength = 2, maxLength = 50, allowNumbers = false } = options;
  
  if (!name) {
    return 'Name is required';
  }
  
  if (name.length < minLength) {
    return `Name must be at least ${minLength} characters long`;
  }
  
  if (name.length > maxLength) {
    return `Name must be no more than ${maxLength} characters long`;
  }
  
  const nameRegex = allowNumbers ? /^[a-zA-Z0-9\s]+$/ : /^[a-zA-Z\s]+$/;
  if (!nameRegex.test(name)) {
    return allowNumbers 
      ? 'Name can only contain letters, numbers, and spaces'
      : 'Name can only contain letters and spaces';
  }
  
  // Check for multiple consecutive spaces
  if (/\s{2,}/.test(name)) {
    return 'Name cannot contain multiple consecutive spaces';
  }
  
  // Check for leading/trailing spaces
  if (name.trim() !== name) {
    return 'Name cannot start or end with spaces';
  }
  
  return null;
};

export const validatePhoneNumber = (phone, options = {}) => {
  const { allowInternational = true, minLength = 8 } = options;

  if (!phone) {
    return 'Phone number is required';
  }

  // Remove all non-digit characters for validation
  const cleanedPhone = phone.replace(/[^\d]/g, '');

  // For KSA phone format: expect exactly 8 digits after +966 5
  if (cleanedPhone.length !== 8) {
    return 'Please enter exactly 8 digits after 5';
  }

  // Check if it's all digits
  const digitRegex = /^\d{8}$/;
  if (!digitRegex.test(cleanedPhone)) {
    return 'Phone number must contain only digits';
  }
  
  return null;
};

export const validateConfirmPassword = (password, confirmPassword) => {
  if (!confirmPassword) {
    return 'Please confirm your password';
  }
  if (password !== confirmPassword) {
    return 'Passwords do not match';
  }
  return null;
};

export const validatePin = (pin, options = {}) => {
  const { length = 6, allowLetters = false } = options;
  
  if (!pin) {
    return 'PIN is required';
  }
  
  if (pin.length !== length) {
    return `PIN must be exactly ${length} characters`;
  }
  
  const pinRegex = allowLetters ? /^[a-zA-Z0-9]+$/ : /^\d+$/;
  if (!pinRegex.test(pin)) {
    return allowLetters 
      ? 'PIN can only contain letters and numbers'
      : 'PIN can only contain numbers';
  }
  
  return null;
};

export const validateRequired = (value, fieldName = 'Field') => {
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    return `${fieldName} is required`;
  }
  return null;
};

export const validateAge = (age, options = {}) => {
  const { minAge = 13, maxAge = 120 } = options;
  
  if (!age) {
    return 'Age is required';
  }
  
  const numAge = parseInt(age, 10);
  
  if (isNaN(numAge)) {
    return 'Please enter a valid age';
  }
  
  if (numAge < minAge) {
    return `You must be at least ${minAge} years old`;
  }
  
  if (numAge > maxAge) {
    return `Please enter a valid age (max ${maxAge})`;
  }
  
  return null;
};
export const validateCurrency = (amount, options = {}) => {
  const { minAmount = 0, maxAmount = 1000000, allowNegative = false } = options;
  if (!amount && amount !== 0) {
    return 'Amount is required';
  }
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount)) {
    return 'Please enter a valid amount';
  }
  if (!allowNegative && numAmount < 0) {
    return 'Amount cannot be negative';
  }
  if (numAmount < minAmount) {
    return `Amount must be at least SAR ${minAmount}`;
  }
  if (numAmount > maxAmount) {
    return `Amount cannot exceed SAR ${maxAmount}`;
  }
  
  // Check for reasonable decimal places (max 2 for currency)
  if (amount.toString().includes('.') && amount.toString().split('.')[1].length > 2) {
    return 'Amount can have at most 2 decimal places';
  }
  
  return null;
};

export const validateDate = (date, options = {}) => {
  const { 
    minDate = null, 
    maxDate = null, 
    format = 'YYYY-MM-DD',
    allowPast = true,
    allowFuture = true 
  } = options;
  
  if (!date) {
    return 'Date is required';
  }
  
  const dateObj = new Date(date);
  
  if (isNaN(dateObj.getTime())) {
    return `Please enter a valid date in ${format} format`;
  }
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (!allowPast && dateObj < today) {
    return 'Date cannot be in the past';
  }
  
  if (!allowFuture && dateObj > today) {
    return 'Date cannot be in the future';
  }
  
  if (minDate && dateObj < new Date(minDate)) {
    return `Date must be after ${minDate}`;
  }
  
  if (maxDate && dateObj > new Date(maxDate)) {
    return `Date must be before ${maxDate}`;
  }
  
  return null;
};

// Real-time validation hook for forms
export const useFormValidation = (fields, validationRules) => {
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  
  const validateField = (fieldName, value) => {
    const rule = validationRules[fieldName];
    if (!rule) return null;
    
    if (Array.isArray(rule)) {
      // Multiple validation rules
      for (const validationFn of rule) {
        const error = validationFn(value);
        if (error) return error;
      }
      return null;
    } else {
      // Single validation rule
      return rule(value);
    }
  };
  
  const validateAllFields = () => {
    const newErrors = {};
    let isValid = true;
    
    Object.keys(fields).forEach(fieldName => {
      const error = validateField(fieldName, fields[fieldName]);
      if (error) {
        newErrors[fieldName] = error;
        isValid = false;
      }
    });
    
    setErrors(newErrors);
    return isValid;
  };
  
  const handleFieldChange = (fieldName, value) => {
    // Validate field if it's been touched
    if (touched[fieldName]) {
      const error = validateField(fieldName, value);
      setErrors(prev => ({
        ...prev,
        [fieldName]: error
      }));
    }
  };
  
  const handleFieldBlur = (fieldName) => {
    setTouched(prev => ({
      ...prev,
      [fieldName]: true
    }));
    
    const error = validateField(fieldName, fields[fieldName]);
    setErrors(prev => ({
      ...prev,
      [fieldName]: error
    }));
  };
  
  const clearErrors = () => {
    setErrors({});
    setTouched({});
  };
  
  return {
    errors,
    touched,
    validateAllFields,
    handleFieldChange,
    handleFieldBlur,
    clearErrors,
    isFieldValid: (fieldName) => !errors[fieldName],
    isFormValid: () => Object.keys(errors).length === 0
  };
};

// Password strength checker
export const getPasswordStrength = (password) => {
  let score = 0;
  const feedback = [];
  
  if (!password) {
    return { score: 0, strength: 'None', feedback: ['Enter a password'] };
  }
  
  // Length check
  if (password.length >= 8) score += 1;
  else feedback.push('Use at least 8 characters');
  
  if (password.length >= 12) score += 1;
  
  // Character variety checks
  if (/[a-z]/.test(password)) score += 1;
  else feedback.push('Add lowercase letters');
  
  if (/[A-Z]/.test(password)) score += 1;
  else feedback.push('Add uppercase letters');
  
  if (/\d/.test(password)) score += 1;
  else feedback.push('Add numbers');
  
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 1;
  else feedback.push('Add special characters');
  
  // Avoid common patterns
  if (!/(.)\1{2,}/.test(password)) score += 1;
  else feedback.push('Avoid repeated characters');
  
  const strengthLevels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
  const colors = ['#ff4444', '#ff8800', '#ffaa00', '#88cc00', '#00cc44', '#00aa88'];
  
  const strengthIndex = Math.min(Math.floor(score * strengthLevels.length / 7), strengthLevels.length - 1);
  
  return {
    score,
    strength: strengthLevels[strengthIndex],
    color: colors[strengthIndex],
    feedback: feedback.slice(0, 3) // Limit feedback to top 3 items
  };
};

// Form validation helpers
export const createValidationSchema = (schema) => {
  return (formData) => {
    const errors = {};
    
    Object.keys(schema).forEach(field => {
      const rules = schema[field];
      const value = formData[field];
      
      if (Array.isArray(rules)) {
        for (const rule of rules) {
          const error = rule(value);
          if (error) {
            errors[field] = error;
            break;
          }
        }
      } else {
        const error = rules(value);
        if (error) {
          errors[field] = error;
        }
      }
    });
    
    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  };
};

// Export commonly used validation combinations
export const commonValidations = {
  email: (email) => validateEmail(email),
  password: (password) => validatePassword(password),
  strongPassword: (password) => validatePassword(password, {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true
  }),
  name: (name) => validateName(name),
  phone: (phone) => validatePhoneNumber(phone),
  pin: (pin) => validatePin(pin),
  required: (value, fieldName) => validateRequired(value, fieldName),
  currency: (amount) => validateCurrency(amount),
  age: (age) => validateAge(age)
};
