const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const connectDB = require('./src/config/db');
const logger = require('./src/config/logger');
const errorHandler = require('./src/middleware/errorHandler');

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// ✅ FIXED CORS (IMPORTANT)
app.use(cors({
  origin: 'http://localhost:8080', 
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use(logger);

// ✅ TEST ROUTE (ADD THIS)
app.get('/api/test', (req, res) => {
  res.json({
    message: "Backend connected successfully 🚀"
  });
});

// Routes
app.use('/api/auth', require('./src/routes/authRoutes'));
app.use('/api/users', require('./src/routes/userRoutes'));
app.use('/api/budgets', require('./src/routes/budgetRoutes'));
app.use('/api/transactions', require('./src/routes/transactionRoutes'));
app.use('/api/transfers', require('./src/routes/transferRoutes'));
app.use('/api/upload', require('./src/routes/uploadRoutes'));
app.use('/api/analysis', require('./src/routes/analysisRoutes'));
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to NextGen Finance API',
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'NextGen Finance API is running',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// Global error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
});