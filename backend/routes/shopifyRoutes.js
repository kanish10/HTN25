const express = require('express');
const ShopifyService = require('../services/shopifyService');
const router = express.Router();

// Initialize Shopify service
const shopifyService = new ShopifyService();

// Test Shopify connection
router.get('/shopify/test', async (req, res) => {
  try {
    const result = await shopifyService.testConnection();
    res.json({
      success: true,
      message: 'Shopify connection successful',
      data: result
    });
  } catch (error) {
    console.error('Shopify connection test failed:', error);
    res.status(500).json({
      success: false,
      error: 'Shopify connection failed',
      message: error.message
    });
  }
});

// Publish product to Shopify
router.post('/publish/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const analysisData = req.body;

    console.log(`📦 Publishing product ${productId} to Shopify`);

    // Validate required data
    if (!analysisData.extractedData || !analysisData.generatedContent) {
      return res.status(400).json({
        success: false,
        error: 'Missing required analysis data',
        message: 'Both extractedData and generatedContent are required'
      });
    }

    // Publish to Shopify
    const result = await shopifyService.publishProduct(analysisData);

    // Respond with success
    res.json({
      success: true,
      message: 'Product published successfully to Shopify',
      data: {
        productId: result.productId,
        shopifyProductId: result.productId,
        productUrl: result.productUrl,
        publicUrl: result.publicUrl,
        publishedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error(`❌ Error publishing product ${req.params.productId}:`, error);

    res.status(500).json({
      success: false,
      error: 'Failed to publish product',
      message: error.message
    });
  }
});

// Update product status (draft -> active)
router.patch('/shopify/product/:productId/status', async (req, res) => {
  try {
    const { productId } = req.params;
    const { status = 'active' } = req.body;

    console.log(`📢 Updating Shopify product ${productId} status to: ${status}`);

    const result = await shopifyService.updateProductStatus(productId, status);

    res.json({
      success: true,
      message: `Product status updated to ${status}`,
      data: result
    });

  } catch (error) {
    console.error(`❌ Error updating product ${req.params.productId} status:`, error);

    res.status(500).json({
      success: false,
      error: 'Failed to update product status',
      message: error.message
    });
  }
});

// Get product from Shopify
router.get('/shopify/product/:productId', async (req, res) => {
  try {
    const { productId } = req.params;

    console.log(`📋 Fetching Shopify product ${productId}`);

    const product = await shopifyService.getProduct(productId);

    res.json({
      success: true,
      data: product
    });

  } catch (error) {
    console.error(`❌ Error fetching product ${req.params.productId}:`, error);

    res.status(404).json({
      success: false,
      error: 'Product not found',
      message: error.message
    });
  }
});

// Delete product from Shopify
router.delete('/shopify/product/:productId', async (req, res) => {
  try {
    const { productId } = req.params;

    console.log(`🗑️  Deleting Shopify product ${productId}`);

    await shopifyService.deleteProduct(productId);

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });

  } catch (error) {
    console.error(`❌ Error deleting product ${req.params.productId}:`, error);

    res.status(500).json({
      success: false,
      error: 'Failed to delete product',
      message: error.message
    });
  }
});

module.exports = router;