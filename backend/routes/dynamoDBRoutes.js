const express = require('express');
const DynamoDBService = require('../services/dynamoDBService');

const router = express.Router();
const dynamoDBService = new DynamoDBService();

// GET /products - List all products from DynamoDB
router.get('/products', async (req, res) => {
  try {
    const { status, limit } = req.query;
    const result = await dynamoDBService.listProducts(status, parseInt(limit) || 50);
    
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

// GET /products/:productId - Get a specific product
router.get('/products/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const product = await dynamoDBService.getProduct(productId);
    
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
    
    const result = await dynamoDBService.updateProductStatus(productId, status);
    
    res.json(result);
    
  } catch (error) {
    console.error('Error updating product status:', error);
    res.status(500).json({
      error: 'Failed to update product status',
      details: error.message
    });
  }
});

// DELETE /products/:productId - Delete a product
router.delete('/products/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const result = await dynamoDBService.deleteProduct(productId);
    
    res.json(result);
    
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({
      error: 'Failed to delete product',
      details: error.message
    });
  }
});

module.exports = router;
