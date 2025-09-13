const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables FIRST
dotenv.config();

// Now import routes (after env vars are loaded)
const uploadRoutes = require('./routes/uploadRoutes');
const directUploadRoutes = require('./routes/directUploadRoutes');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'ShopBrain Image Analysis',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API routes
app.use('/api', uploadRoutes);
app.use('/api', directUploadRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'ShopBrain Image Analysis API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      upload: 'POST /api/upload',
      analyze: 'POST /api/analyze/:productId',
      directUpload: 'POST /api/direct-upload',
      status: 'GET /api/status/:productId'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server Error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: error.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log('🧠 ShopBrain Image Analysis API');
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📋 API docs: http://localhost:${PORT}/`);
  
  // Verify environment variables
  const requiredEnvVars = ['GEMINI_API_KEY', 'AWS_ACCESS_KEY_ID', 'S3_BUCKET_NAME'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.warn('⚠️  Missing environment variables:', missingVars.join(', '));
    console.warn('   Check your .env file');
  } else {
    console.log('✅ All required environment variables loaded');
  }
});