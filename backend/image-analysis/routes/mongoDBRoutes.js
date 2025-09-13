const express = require('express');
const MongoDBService = require('../services/mongoDBService');

const router = express.Router();
const mongoDBService = new MongoDBService();

// GET /products - List all products from MongoDB
router.get('/products', async (req, res) => {
  try {
    const { status, limit } = req.query;
    const result = await mongoDBService.listProducts(status, parseInt(limit) || 50);
    
    res.json({
      success: true,
      ...result
    });
    
  } catch (error) {
    console.error('Error listing products:', error);
    res.status(500).json({
      error: 'Failed to list products',
      details: error.message
    });
  }
});

// GET /products/search - Search products by text query
router.get('/products/search', async (req, res) => {
  try {
    const { q, limit } = req.query;
    
    if (!q) {
      return res.status(400).json({
        error: 'Search query parameter "q" is required'
      });
    }
    
    const result = await mongoDBService.searchProducts(q, parseInt(limit) || 50);
    
    res.json({
      success: true,
      ...result
    });
    
  } catch (error) {
    console.error('Error searching products:', error);
    res.status(500).json({
      error: 'Failed to search products',
      details: error.message
    });
  }
});

// GET /products/:productId - Get a specific product
router.get('/products/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const product = await mongoDBService.getProduct(productId);
    
    res.json({
      success: true,
      product
    });
    
  } catch (error) {
    console.error('Error getting product:', error);
    res.status(404).json({
      error: 'Product not found',
      details: error.message
    });
  }
});

// PUT /products/:productId/status - Update product status
router.put('/products/:productId/status', async (req, res) => {
  try {
    const { productId } = req.params;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({
        error: 'Status is required'
      });
    }
    
    const validStatuses = ['uploaded', 'analyzing', 'analyzed', 'ready_to_publish', 'published'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
        validStatuses
      });
    }
    
    const result = await mongoDBService.updateProductStatus(productId, status);
    
    res.json(result);
    
  } catch (error) {
    console.error('Error updating product status:', error);
    res.status(500).json({
      error: 'Failed to update product status',
      details: error.message
    });
  }
});

// PUT /products/:productId - Update entire product
router.put('/products/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const updateData = req.body;
    
    if (!updateData || Object.keys(updateData).length === 0) {
      return res.status(400).json({
        error: 'Update data is required'
      });
    }
    
    // Remove productId from update data to prevent conflicts
    delete updateData.productId;
    delete updateData._id;
    
    const result = await mongoDBService.updateProduct(productId, updateData);
    
    res.json(result);
    
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({
      error: 'Failed to update product',
      details: error.message
    });
  }
});

// DELETE /products/:productId - Delete a product
router.delete('/products/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const result = await mongoDBService.deleteProduct(productId);
    
    res.json(result);
    
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({
      error: 'Failed to delete product',
      details: error.message
    });
  }
});

// POST /products - Create a new product (alternative to upload)
router.post('/products', async (req, res) => {
  try {
    const productData = req.body;
    
    if (!productData || !productData.productId) {
      return res.status(400).json({
        error: 'Product data with productId is required'
      });
    }
    
    const result = await mongoDBService.uploadProduct(productData);
    
    res.status(201).json(result);
    
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({
      error: 'Failed to create product',
      details: error.message
    });
  }
});

// GET /health - Health check for MongoDB connection
router.get('/health', async (req, res) => {
  try {
    await mongoDBService.connect();
    res.json({
      success: true,
      message: 'MongoDB connection is healthy',
      database: mongoDBService.databaseName,
      collection: mongoDBService.collectionName
    });
  } catch (error) {
    console.error('MongoDB health check failed:', error);
    res.status(500).json({
      success: false,
      error: 'MongoDB connection failed',
      details: error.message
    });
  }
});

module.exports = router;
