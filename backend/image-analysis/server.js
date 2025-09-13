const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables FIRST
dotenv.config();

// Now import routes (after env vars are loaded)
const uploadRoutes = require('./routes/uploadRoutes');
const directUploadRoutes = require('./routes/directUploadRoutes');
const shopifyRoutes = require('./routes/shopifyRoutes');
const mongoDBRoutes = require('./routes/mongoDBRoutes');
const s3Routes = require('./routes/s3Routes');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:4173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
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
app.use('/api', shopifyRoutes);
app.use('/api/db', mongoDBRoutes);
app.use('/api/s3', s3Routes);

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
      status: 'GET /api/status/:productId',
      shopifyTest: 'GET /api/shopify/test',
      publish: 'POST /api/publish/:productId',
      shopifyProduct: 'GET /api/shopify/product/:productId',
      updateStatus: 'PATCH /api/shopify/product/:productId/status',
      deleteProduct: 'DELETE /api/shopify/product/:productId',
      listProducts: 'GET /api/db/products',
      getProduct: 'GET /api/db/products/:productId',
      updateProductStatus: 'PUT /api/db/products/:productId/status',
      deleteFromDB: 'DELETE /api/db/products/:productId',
      s3Upload: 'POST /api/s3/upload',
      s3PresignedUrl: 'POST /api/s3/presigned-url',
      s3PresignedReadUrl: 'POST /api/s3/presigned-read-url',
      s3ListImages: 'GET /api/s3/images',
      s3GetImage: 'GET /api/s3/images/:productId',
      s3DeleteImage: 'DELETE /api/s3/images/:productId',
      s3DeleteByKey: 'DELETE /api/s3/images/key/:s3Key',
      s3CopyImage: 'POST /api/s3/images/copy',
      s3Health: 'GET /api/s3/health'
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
  const requiredEnvVars = ['GEMINI_API_KEY', 'AWS_ACCESS_KEY_ID', 'S3_BUCKET_NAME', 'SHOPIFY_SHOP_NAME', 'SHOPIFY_ACCESS_TOKEN', 'MONGODB_URI'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.warn('⚠️  Missing environment variables:', missingVars.join(', '));
    console.warn('   Check your .env file');
  } else {
    console.log('✅ All required environment variables loaded');
  }
});