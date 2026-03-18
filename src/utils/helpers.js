const mongoose = require('mongoose');

// Helper to validate ObjectId
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

// Helper to format currency
const formatCurrency = (amount, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(amount);
};

// Helper to format date
const formatDate = (date, options = {}) => {
  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  };
  
  return new Date(date).toLocaleDateString('en-US', {
    ...defaultOptions,
    ...options
  });
};

// Helper to calculate percentage
const calculatePercentage = (part, total) => {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
};

// Helper to generate random string
const generateRandomString = (length = 8) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Helper to slugify text
const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
};

// Helper to paginate results
const paginate = (page, limit) => {
  const currentPage = parseInt(page) || 1;
  const currentLimit = parseInt(limit) || 10;
  const skip = (currentPage - 1) * currentLimit;
  
  return {
    skip,
    limit: currentLimit,
    page: currentPage
  };
};

// Helper to validate email format
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Helper to calculate date difference in days
const getDaysDifference = (date1, date2) => {
  const oneDay = 24 * 60 * 60 * 1000; // hours*minutes*seconds*milliseconds
  return Math.round(Math.abs((date1.getTime() - date2.getTime()) / oneDay));
};

// Helper to get month name
const getMonthName = (monthIndex) => {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[monthIndex];
};

// Helper to group transactions by month
const groupByMonth = (transactions) => {
  return transactions.reduce((groups, transaction) => {
    const date = new Date(transaction.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!groups[monthKey]) {
      groups[monthKey] = {
        month: getMonthName(date.getMonth()),
        year: date.getFullYear(),
        transactions: [],
        total: 0
      };
    }
    
    groups[monthKey].transactions.push(transaction);
    groups[monthKey].total += transaction.amount;
    
    return groups;
  }, {});
};

// Helper to calculate compound interest
const calculateCompoundInterest = (principal, rate, time, compoundingFrequency = 12) => {
  const rateDecimal = rate / 100;
  return principal * Math.pow(1 + rateDecimal / compoundingFrequency, compoundingFrequency * time);
};

module.exports = {
  isValidObjectId,
  formatCurrency,
  formatDate,
  calculatePercentage,
  generateRandomString,
  slugify,
  paginate,
  isValidEmail,
  getDaysDifference,
  getMonthName,
  groupByMonth,
  calculateCompoundInterest
};