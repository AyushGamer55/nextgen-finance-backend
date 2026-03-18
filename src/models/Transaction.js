const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: [true, 'Please add an amount'],
    min: [0.01, 'Amount must be at least 0.01']
  },
  description: {
    type: String,
    required: [true, 'Please add a description'],
    trim: true,
    maxlength: [200, 'Description cannot be more than 200 characters']
  },
  category: {
    type: String,
    required: [true, 'Please add a category'],
    enum: [
      'Food & Dining',
      'Transportation',
      'Shopping',
      'Entertainment',
      'Bills & Utilities',
      'Healthcare',
      'Education',
      'Travel',
      'Savings',
      'Income',
      'Transfer',
      'Other'
    ]
  },
  type: {
    type: String,
    required: true,
    enum: ['income', 'expense', 'transfer'],
    default: 'expense'
  },
  date: {
    type: Date,
    required: [true, 'Please add a date'],
    default: Date.now
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'credit_card', 'debit_card', 'bank_transfer', 'digital_wallet', 'other'],
    default: 'cash'
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [30, 'Tag cannot be more than 30 characters']
  }],
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringFrequency: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'yearly'],
    required: function() { return this.isRecurring; }
  },
  budget: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Budget'
  },
  receipt: {
    type: String, // URL or file path to receipt image
    trim: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for formatted date
transactionSchema.virtual('formattedDate').get(function() {
  return this.date.toISOString().split('T')[0];
});

// Virtual for month-year
transactionSchema.virtual('monthYear').get(function() {
  const date = new Date(this.date);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
});

// Index for better query performance
transactionSchema.index({ user: 1, date: -1 });
transactionSchema.index({ user: 1, category: 1 });
transactionSchema.index({ user: 1, type: 1 });
transactionSchema.index({ user: 1, monthYear: 1 });

// Pre-save middleware to update user balance
transactionSchema.pre('save', async function(next) {
  if (this.isNew) {
    const User = mongoose.model('User');
    const user = await User.findById(this.user);
    
    if (this.type === 'income') {
      user.balance += this.amount;
    } else if (this.type === 'expense') {
      user.balance -= this.amount;
    }
    // For transfers, balance doesn't change (handled separately)
    
    await user.save();
  }
  next();
});

// Post-remove middleware to update user balance
transactionSchema.post('remove', async function() {
  const User = mongoose.model('User');
  const user = await User.findById(this.user);
  
  if (this.type === 'income') {
    user.balance -= this.amount;
  } else if (this.type === 'expense') {
    user.balance += this.amount;
  }
  // For transfers, balance doesn't change
  
  await user.save();
});

module.exports = mongoose.model('Transaction', transactionSchema);