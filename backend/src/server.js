const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Basic routes
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API routes
app.post('/api/upload', (req, res) => {
  // TODO: Implement S3 presigned URL generation
  res.json({ message: 'Upload endpoint - to be implemented' });
});

app.post('/api/analyze/:productId', (req, res) => {
  // TODO: Implement AI analysis
  res.json({ message: 'Analysis endpoint - to be implemented' });
});

app.post('/api/publish/:productId', (req, res) => {
  // TODO: Implement Shopify publishing
  res.json({ message: 'Publish endpoint - to be implemented' });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server Error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🧠 ShopBrain Backend running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});