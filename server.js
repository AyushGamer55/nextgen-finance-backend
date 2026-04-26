const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const connectDB = require('./src/config/db');
const logger = require('./src/config/logger');
const errorHandler = require('./src/middleware/errorHandler');
const User = require('./src/models/User');
const { setIo } = require('./src/realtime/io');
const { checkMlRuntime } = require('./src/services/mlInsightsService');

dotenv.config();

connectDB();

const app = express();
const server = http.createServer(app);
let mlRuntimeStatus = {
  ready: false,
  sklearn: false,
  pythonCommand: process.env.PYTHON_BIN || 'python',
  error: 'ML runtime check has not run yet',
};

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:8080')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
};

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST'],
  },
});
setIo(io);

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) {
      return next(new Error('Not authorized'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('_id email name');
    if (!user) {
      return next(new Error('User not found'));
    }

    socket.user = user;
    return next();
  } catch (error) {
    return next(new Error('Authentication failed'));
  }
});

io.on('connection', (socket) => {
  const userId = String(socket.user._id);
  socket.join(`user:${userId}`);
  socket.emit('notification:connected', { success: true, userId });
});

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(helmet());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  skip: (req) => req.method === 'OPTIONS',
});
app.use(limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(logger);

app.get('/api/test', (req, res) => {
  res.json({
    message: 'Backend connected successfully',
    groqAi: process.env.GROQ_API_KEY ? 'configured' : 'missing_api_key',
    realtime: 'enabled',
    ml: mlRuntimeStatus,
  });
});

app.use('/api/auth', require('./src/routes/authRoutes'));
app.use('/api/users', require('./src/routes/userRoutes'));
app.use('/api/budgets', require('./src/routes/budgetRoutes'));
app.use('/api/transactions', require('./src/routes/transactionRoutes'));
app.use('/api/transfers', require('./src/routes/transferRoutes'));
app.use('/api/upload', require('./src/routes/uploadRoutes'));
app.use('/api/analysis', require('./src/routes/analysisRoutes'));
app.use('/api/ai', require('./src/routes/aiRoutes'));
app.use('/api/notifications', require('./src/routes/notificationRoutes'));

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to NextGen Finance API',
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'NextGen Finance API is running',
    groqAi: process.env.GROQ_API_KEY ? 'configured' : 'missing_api_key',
    realtime: 'enabled',
    ml: mlRuntimeStatus,
    timestamp: new Date().toISOString(),
  });
});

app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

function startServer() {
  server.listen(PORT, () => {
    const groqStatus = process.env.GROQ_API_KEY
      ? 'Groq AI advisor is configured and ready'
      : 'Groq AI advisor is not configured yet. Add GROQ_API_KEY in .env';

    console.log(`Backend running on port ${PORT} (${process.env.NODE_ENV || 'development'} mode)`);
    console.log('Frontend connect to http://localhost:8080');
    console.log('[Realtime] Notification socket server ready');
    console.log(`[AI] ${groqStatus}`);
    checkMlRuntime()
      .then((status) => {
        mlRuntimeStatus = status;
        if (status.ready) {
          console.log(`[ML] Python runtime ready (${status.pythonCommand})${status.sklearn ? ' with scikit-learn' : ''}`);
        } else {
          console.log(`[ML] Runtime check failed: ${status.error}`);
        }
      })
      .catch((error) => {
        mlRuntimeStatus = {
          ready: false,
          sklearn: false,
          pythonCommand: process.env.PYTHON_BIN || 'python',
          error: error.message,
        };
        console.log(`[ML] Runtime check failed: ${error.message}`);
      });
    console.log('Ping /api/health to test connection');
    console.log('='.repeat(50));
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { app, server, io, startServer };
