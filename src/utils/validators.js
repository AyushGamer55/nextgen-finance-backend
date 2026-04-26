const Joi = require('joi');

// User registration validation
const registerValidation = Joi.object({
  name: Joi.string()
    .min(2)
    .max(50)
    .required()
    .messages({
      'string.empty': 'Name is required',
      'string.min': 'Name must be at least 2 characters',
      'string.max': 'Name cannot exceed 50 characters'
    }),
  
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.empty': 'Email is required',
      'string.email': 'Please provide a valid email'
    }),
  
  password: Joi.string()
    .min(6)
    .required()
    .messages({
      'string.empty': 'Password is required',
      'string.min': 'Password must be at least 6 characters'
    })
});

// User login validation
const loginValidation = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.empty': 'Email is required',
      'string.email': 'Please provide a valid email'
    }),
  
  password: Joi.string()
    .required()
    .messages({
      'string.empty': 'Password is required'
    })
});

// User update validation
const updateUserValidation = Joi.object({
  name: Joi.string()
    .min(2)
    .max(50)
    .messages({
      'string.min': 'Name must be at least 2 characters',
      'string.max': 'Name cannot exceed 50 characters'
    }),
  
  email: Joi.string()
    .email()
    .messages({
      'string.email': 'Please provide a valid email'
    }),
  phone: Joi.string()
    .trim()
    .max(20)
    .allow(''),
  bio: Joi.string()
    .trim()
    .max(240)
    .allow(''),
  avatar: Joi.string()
    .allow('')
});

const transactionValidation = Joi.object({
  amount: Joi.number().positive().required(),
  description: Joi.string().trim().max(200).required(),
  category: Joi.string().trim().max(100).required(),
  type: Joi.string().valid('income', 'expense', 'transfer').required(),
  date: Joi.date().optional(),
  paymentMethod: Joi.string().valid('cash', 'credit_card', 'debit_card', 'bank_transfer', 'digital_wallet', 'other').optional(),
  tags: Joi.array().items(Joi.string().trim().max(30)).optional(),
  isRecurring: Joi.boolean().optional(),
  recurringFrequency: Joi.string().valid('daily', 'weekly', 'monthly', 'yearly').optional(),
  budget: Joi.string().optional().allow(null, ''),
  receipt: Joi.string().optional().allow('', null)
});

const aiChatValidation = Joi.object({
  userId: Joi.string().optional(),
  message: Joi.string().trim().min(1).max(1000).required()
});

const changePasswordValidation = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(6).required(),
});

module.exports = {
  registerValidation,
  loginValidation,
  updateUserValidation,
  transactionValidation,
  aiChatValidation,
  changePasswordValidation
};
