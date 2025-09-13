const express = require('express');
const ShippingService = require('../services/shippingService');
const ShippingOptimizationService = require('../services/shippingOptimizationService');

const router = express.Router();
const shippingService = new ShippingService();

// POST /api/shipping/calculate
router.post('/shipping/calculate', async (req, res) => {
  try {
    const { items = [], destination = {} } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'items is required and must be non-empty array' });
    }

    const result = await shippingService.calculate(items, destination);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Shipping calculate error:', error);
    res.status(500).json({ success: false, error: 'Failed to calculate shipping', message: error.message });
  }
});

// POST /api/shopify/shipping-rates (Carrier Service)
// Note: Shopify carrier service endpoint is provided in shopifyCarrierRoutes.js

// In-memory storage for processed products (in production, use database)
const productDatabase = new Map();

/**
 * Store product data for shipping calculations
 * This would typically be called after product analysis
 */
router.post('/shipping/store-product', async (req, res) => {
  try {
    const { productId, productData } = req.body;

    if (!productId || !productData) {
      return res.status(400).json({
        success: false,
        error: 'Missing productId or productData'
      });
    }

    // Store product data
    productDatabase.set(productId, {
      ...productData,
      storedAt: new Date().toISOString()
    });

    console.log(`📦 Stored product ${productId} for shipping calculations`);

    res.json({
      success: true,
      message: 'Product data stored successfully',
      productId
    });

  } catch (error) {
    console.error('❌ Error storing product data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to store product data',
      message: error.message
    });
  }
});

/**
 * Calculate optimal shipping for multiple items
 * Main endpoint for multi-item shipping optimization
 */
// (Duplicate /shipping/calculate route removed; use the one defined at the top of this file.)

/**
 * Get available shipping boxes
 */
router.get('/shipping/boxes', (req, res) => {
  const shippingOptimization = new ShippingOptimizationService();
  res.json({
    success: true,
    boxes: shippingOptimization.availableBoxes,
    description: 'Available shipping box options'
  });
});

/**
 * Get stored products for shipping
 */
router.get('/shipping/products', (req, res) => {
  const products = Array.from(productDatabase.entries()).map(([id, data]) => ({
    productId: id,
    name: data.generatedContent?.title || data.extractedData?.productType || 'Unknown Product',
    dimensions: data.extractedData?.dimensions,
    weight: data.extractedData?.estimatedWeight,
    material: data.extractedData?.material,
    storedAt: data.storedAt
  }));

  res.json({
    success: true,
    products,
    total: products.length
  });
});

/**
 * Test shipping calculation with sample data
 */
router.post('/shipping/test', async (req, res) => {
  try {
    // Create sample items for testing
    const sampleItems = [
      {
        productId: 'test_1',
        name: 'Sample LEGO Set',
        dimensions: { length: 12, width: 8, height: 3 },
        estimatedWeight: 2.5,
        material: 'plastic',
        quantity: 1
      },
      {
        productId: 'test_2',
        name: 'Sample Book',
        dimensions: { length: 9, width: 6, height: 1 },
        estimatedWeight: 0.8,
        material: 'paper',
        quantity: 2
      },
      {
        productId: 'test_3',
        name: 'Sample Mug',
        dimensions: { length: 5, width: 4, height: 4 },
        estimatedWeight: 1.2,
        material: 'ceramic',
        quantity: 1
      }
    ];

    // Use optimization service directly for test scenarios with inline dimensions
    const optimizer = new ShippingOptimizationService();
    const packingResult = await optimizer.calculateOptimalPacking(
      sampleItems,
      { country: 'US', postal_code: '10001', province: 'NY' }
    );

    res.json({
      success: true,
      ...packingResult,
      testData: sampleItems,
      message: 'Test calculation completed successfully'
    });

  } catch (error) {
    console.error('❌ Test shipping calculation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Test calculation failed',
      message: error.message
    });
  }
});

/**
 * Compare shipping options (optimized vs standard)
 */
router.post('/shipping/compare', async (req, res) => {
  try {
    const { items, destination = {} } = req.body;

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        error: 'Items array is required'
      });
    }

    const productDimensions = await fetchProductDimensions(items);

  // Get optimized solution using the optimization service (works with inline dimensions)
  const optimizer = new ShippingOptimizationService();
  const optimized = await optimizer.calculateOptimalPacking(productDimensions, destination);

    // Calculate standard shipping (one large box per item)
    const standardCost = productDimensions.length * 9.00;
    const standardBoxes = productDimensions.length;

    // Calculate individual shipping
    const individualCost = productDimensions.reduce((sum, item) => {
      // Assume each item ships in a small/medium box
      const volume = item.dimensions.length * item.dimensions.width * item.dimensions.height;
      return sum + (volume > 200 ? 6.50 : 4.50);
    }, 0);

    res.json({
      success: true,
      comparison: {
        optimized: {
          cost: optimized.totalCost,
          boxes: optimized.boxes.length,
          utilization: optimized.optimization.volumeUtilization,
          description: 'AI-optimized packing'
        },
        standard: {
          cost: standardCost,
          boxes: standardBoxes,
          utilization: 60, // Assume lower utilization
          description: 'One large box per item'
        },
        individual: {
          cost: individualCost,
          boxes: productDimensions.length,
          utilization: 70, // Assume medium utilization
          description: 'Individual item shipping'
        }
      },
      savings: {
        vsStandard: (standardCost - optimized.totalCost).toFixed(2),
        vsIndividual: (individualCost - optimized.totalCost).toFixed(2),
        percentageSaved: ((1 - optimized.totalCost / Math.max(standardCost, individualCost)) * 100).toFixed(1)
      },
      recommendation: optimized.totalCost < Math.min(standardCost, individualCost) ? 'optimized' : 'review'
    });

  } catch (error) {
    console.error('❌ Shipping comparison failed:', error);
    res.status(500).json({
      success: false,
      error: 'Comparison calculation failed',
      message: error.message
    });
  }
});

// === UTILITY FUNCTIONS ===

/**
 * Fetch product dimensions from stored data or database
 * @param {Array} items - Items with productId and quantity
 * @returns {Array} Product dimensions array
 */
async function fetchProductDimensions(items) {
  const productData = [];

  for (const item of items) {
    const productId = item.productId || item.id;
    const quantity = parseInt(item.quantity) || 1;

    // Try to get from in-memory storage first
    let storedProduct = productDatabase.get(productId);

    if (!storedProduct) {
      // If not in memory, check if it's provided in the request
      if (item.dimensions && (item.estimatedWeight || item.weight)) {
        storedProduct = {
          extractedData: {
            dimensions: item.dimensions,
            estimatedWeight: item.estimatedWeight || item.weight,
            material: item.material || 'unknown',
            productType: item.name || item.productType || 'Product'
          }
        };
      } else {
        console.warn(`⚠️ Product ${productId} not found in storage and insufficient data provided`);
        continue;
      }
    }

    if (storedProduct && storedProduct.extractedData) {
      const { dimensions, estimatedWeight, material, productType } = storedProduct.extractedData;

      // Expand based on quantity
      for (let i = 0; i < quantity; i++) {
        productData.push({
          id: `${productId}_${i}`,
          productId,
          name: storedProduct.generatedContent?.title || productType || 'Unknown Product',
          dimensions,
          estimatedWeight: estimatedWeight || 0.5,
          weight: estimatedWeight || 0.5,
          material: material || 'unknown',
          quantity: 1, // Individual items after expansion
          fragile: material && ['glass', 'ceramic', 'crystal'].some(mat =>
            material.toLowerCase().includes(mat)
          )
        });
      }
    }
  }

  return productData;
}

module.exports = router;
