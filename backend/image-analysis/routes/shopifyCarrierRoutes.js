const express = require('express');
const ShopifyService = require('../services/shopifyService');
const ShippingOptimizationService = require('../services/shippingOptimizationService');
const AdvancedShippingOptimizer = require('../services/advancedShippingOptimizer');
const router = express.Router();

// Initialize services
const shopifyService = new ShopifyService();
const shippingService = new ShippingOptimizationService(); // Legacy service
const advancedOptimizer = new AdvancedShippingOptimizer(); // New advanced service

// Product mapping storage (in production, use database)
const productMappings = new Map(); // shopifyProductId -> analysisData

/**
 * Shopify Carrier Service Webhook
 * Called by Shopify during checkout to calculate shipping rates
 * This is the main endpoint that customers will use
 */
router.post('/shopify/shipping-rates', async (req, res) => {
  try {
    console.log('🛒 Shopify checkout shipping calculation requested');
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    const { rate } = req.body;

    if (!rate || !rate.items) {
      return res.status(400).json({
        rates: []
      });
    }

    const { items, destination } = rate;

    console.log(`🔄 Processing ${items.length} items for shipping optimization`);

    // Transform Shopify items to our format
    const transformedItems = await transformShopifyItems(items);

    if (transformedItems.length === 0) {
      console.warn('⚠️ No valid items found for shipping calculation');
      return res.json({
        rates: [
          {
            service_name: 'Standard Shipping',
            service_code: 'STANDARD',
            total_price: Math.round(items.length * 9.00 * 100), // Fallback: $9 per item
            description: 'Standard packaging',
            currency: 'USD'
          }
        ]
      });
    }

    // Calculate optimal shipping using our advanced 3D bin packing algorithm
    const shippingCalc = await advancedOptimizer.optimizeShipment(
      transformedItems,
      { shipTogether: 'auto' }
    );

    console.log(`✅ Optimized shipping: ${shippingCalc.totalBoxes || shippingCalc.boxes?.length} boxes, $${shippingCalc.totalCost}`);

    // Calculate standard shipping for comparison
    const standardCost = items.reduce((sum, item) => {
      // Estimate cost based on item size/weight
      const estimatedWeight = parseFloat(item.grams) / 453.592 || 1; // Convert grams to lbs
      return sum + (estimatedWeight > 2 ? 9.00 : 6.50);
    }, 0);

    // Return optimized rates to Shopify with proper box size information
    const rates = [];

    // Get box size descriptions for better clarity
    const getBoxSizeLabel = (boxType) => {
      const sizeMap = {
        'Small Envelope': 'Small Envelope',
        'Padded Envelope': 'Padded Envelope',
        'Large Envelope': 'Large Envelope',
        'Small Box': 'Small Box',
        'Medium Box': 'Medium Box',
        'Large Box': 'Large Box',
        'Extra Large Box': 'XL Box'
      };
      return sizeMap[boxType] || boxType;
    };

    // Create detailed description of what's being shipped
    const createOptimizedDescription = (shippingResult, items) => {
      const shipments = shippingResult.shipments || [];
      const totalBoxes = shippingResult.summary?.totalBoxes || shipments.length;

      // Calculate total item count including quantities
      const totalItemCount = items.reduce((sum, item) => sum + (item.quantity || 1), 0);

      console.log(`📋 Description Debug: ${totalBoxes} boxes, ${shipments.length} shipments, ${totalItemCount} items`);

      if (totalBoxes === 1 && shipments.length > 0) {
        const shipment = shipments[0];
        const boxName = getBoxNameFromId(shipment.boxId);
        const boxLabel = getBoxSizeLabel(boxName);
        const utilization = Math.round(shipment.fillPercent || 75);
        console.log(`📦 Single box: ${shipment.boxId} -> ${boxName} -> ${boxLabel}`);
        return `${boxLabel} (${utilization}% full) • ${totalItemCount} item${totalItemCount > 1 ? 's' : ''}`;
      } else if (shipments.length > 0) {
        const boxTypes = shipments.map(s => {
          const boxName = getBoxNameFromId(s.boxId);
          const boxLabel = getBoxSizeLabel(boxName);
          console.log(`📦 Multi box: ${s.boxId} -> ${boxName} -> ${boxLabel}`);
          return boxLabel;
        }).join(' + ');
        return `${boxTypes} • ${totalItemCount} items optimally packed`;
      } else {
        // Improved fallback with better error handling
        const fallbackBoxes = Math.max(1, totalBoxes || 1);
        console.warn(`⚠️ Fallback description: ${fallbackBoxes} boxes for ${totalItemCount} items`);
        return `${fallbackBoxes} optimized box${fallbackBoxes > 1 ? 'es' : ''} • ${totalItemCount} items`;
      }
    };

    // Helper function to get box name from ID
    const getBoxNameFromId = (boxId) => {
      const boxMap = {
        'small-envelope': 'Small Envelope',
        'envelope': 'Padded Envelope',
        'large-envelope': 'Large Envelope',
        'small-box': 'Small Box',
        'medium-box': 'Medium Box',
        'large-box': 'Large Box',
        'xl-box': 'Extra Large Box',
        'xlarge': 'Extra Large Box' // Fallback for old ID format
      };
      console.log(`🔍 Box ID lookup: '${boxId}' -> '${boxMap[boxId] || 'Box (unmapped)'}'`);
      return boxMap[boxId] || 'Box';
    };

    // Primary optimized option
    rates.push({
      service_name: 'ShopBrain Optimized Shipping',
      service_code: 'SHOPBRAIN_OPTIMIZED',
      total_price: Math.round(shippingCalc.totalCost * 100),
      description: createOptimizedDescription(shippingCalc, transformedItems),
      currency: 'USD',
      metadata: {
        boxes_count: shippingCalc.summary?.totalBoxes || shippingCalc.shipments?.length || 1,
        utilization: shippingCalc.shipments?.reduce((sum, s) => sum + s.fillPercent, 0) / (shippingCalc.shipments?.length || 1) || 75,
        savings: shippingCalc.optimization?.savings?.percentage || 'optimized',
        box_types: (shippingCalc.shipments || []).map(s => {
          const boxName = getBoxNameFromId(s.boxId);
          return getBoxSizeLabel(boxName);
        }).join(', '),
        optimization_method: 'AI_3D_BIN_PACKING_ADVANCED'
      }
    });

    // REMOVED: Standard shipping option as requested

    console.log(`📦 Returning ${rates.length} optimized shipping options to Shopify`);
    console.log('📋 Shipping options:', rates.map(r => `${r.service_name}: ${r.description} ($${(r.total_price/100).toFixed(2)})`).join(' | '));

    res.json({ rates });

  } catch (error) {
    console.error('❌ Carrier service error:', error);

    // Always return fallback rates to avoid checkout errors
    res.json({
      rates: [
        {
          service_name: 'Standard Shipping',
          service_code: 'STANDARD_FALLBACK',
          total_price: Math.round((req.body?.rate?.items?.length || 1) * 9.00 * 100),
          description: 'Standard packaging',
          currency: 'USD',
          metadata: {
            error: 'optimization_failed',
            fallback: true
          }
        }
      ]
    });
  }
});

/**
 * Get shipping rates for a specific cart (for testing/preview)
 */
router.post('/shopify/preview-rates', async (req, res) => {
  try {
    const { cartItems, destination } = req.body;

    // Transform cart items to Shopify format for testing
    const mockShopifyItems = cartItems.map(item => ({
      product_id: item.productId,
      variant_id: item.variantId || item.productId,
      quantity: item.quantity,
      sku: item.sku || `sku-${item.productId}`,
      title: item.title || item.name,
      vendor: 'ShopBrain',
      grams: Math.round((item.weight || 1) * 453.592), // Convert lbs to grams
      price: Math.round((item.price || 10) * 100) // Convert to cents
    }));

    // Simulate Shopify carrier service request
    const mockRequest = {
      rate: {
        items: mockShopifyItems,
        destination: destination || {
          country: 'US',
          postal_code: '10001',
          province: 'NY',
          city: 'New York',
          name: 'Test Customer',
          address1: '123 Test St'
        }
      }
    };

    // Call our carrier service endpoint internally
    const result = await new Promise((resolve, reject) => {
      const mockRes = {
        json: (data) => resolve(data),
        status: () => mockRes
      };

      // Simulate the carrier service call
      router.handle({
        method: 'POST',
        url: '/shopify/shipping-rates',
        body: mockRequest
      }, mockRes);
    });

    res.json({
      success: true,
      preview: true,
      rates: result.rates,
      message: 'Preview rates calculated successfully'
    });

  } catch (error) {
    console.error('❌ Preview rates error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate preview rates',
      message: error.message
    });
  }
});

/**
 * Create Shopify Carrier Service (setup endpoint)
 */
router.post('/shopify/setup-carrier-service', async (req, res) => {
  try {
    const got = require('got');
    
    console.log('🚀 Creating carrier service...');
    console.log('📍 Callback URL:', process.env.CARRIER_SERVICE_URL);
    
    // First, check if it already exists
    const listResponse = await got.get(`https://${process.env.SHOPIFY_SHOP_NAME}.myshopify.com/admin/api/2023-10/carrier_services.json`, {
      headers: {
        'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
        'Content-Type': 'application/json'
      }
    });

    const existingServices = JSON.parse(listResponse.body);
    const existingService = existingServices.carrier_services?.find(
      service => service.name === 'ShopBrain AI Shipping Optimizer'
    );

    if (existingService) {
      console.log('✅ Carrier service already exists:', existingService.id);
      return res.json({
        success: true,
        message: 'Carrier service already exists',
        data: existingService
      });
    }

    // Create new carrier service
    const payload = {
      carrier_service: {
        name: 'ShopBrain AI Shipping Optimizer',
        callback_url: `${process.env.CARRIER_SERVICE_URL}/api/shopify/shipping-rates`,
        service_discovery: true,
        carrier_service_type: 'api',
        format: 'json'
      }
    };

    console.log('📦 Payload:', JSON.stringify(payload, null, 2));

    const response = await got.post(`https://${process.env.SHOPIFY_SHOP_NAME}.myshopify.com/admin/api/2023-10/carrier_services.json`, {
      headers: {
        'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
        'Content-Type': 'application/json'
      },
      json: payload
    });

    const data = JSON.parse(response.body);
    console.log('✅ Carrier service created successfully:', data);

    res.json({
      success: true,
      message: 'Carrier service created successfully',
      data: data.carrier_service
    });

  } catch (error) {
    console.error('❌ Failed to create carrier service:', error);
    
    // Get more details from the error response
    if (error.response) {
      console.error('📄 Error response body:', error.response.body);
    }
    
    res.status(500).json({ 
      error: error.message,
      details: error.response?.body 
    });
  }
});

/**
 * List existing carrier services
 */
router.get('/shopify/carrier-services', async (req, res) => {
  try {
    const got = require('got');
    
    const response = await got.get(`https://${process.env.SHOPIFY_SHOP_NAME}.myshopify.com/admin/api/2023-10/carrier_services.json`, {
      headers: {
        'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
        'Content-Type': 'application/json'
      }
    });

    const data = JSON.parse(response.body);
    console.log('📋 Existing carrier services:', JSON.stringify(data, null, 2));
    
    res.json({
      success: true,
      carrierServices: data.carrier_services.map(cs => ({
        id: cs.id,
        name: cs.name,
        callback_url: cs.callback_url,
        service_discovery: cs.service_discovery,
        active: cs.active
      }))
    });

  } catch (error) {
    console.error('❌ Failed to list carrier services:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list carrier services',
      message: error.message
    });
  }
});

/**
 * List existing carrier services (debug endpoint)
 */
router.get('/shopify/list-carrier-services', async (req, res) => {
  try {
    const got = require('got');
    
    const response = await got.get(`https://${process.env.SHOPIFY_SHOP_NAME}.myshopify.com/admin/api/2023-10/carrier_services.json`, {
      headers: {
        'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
        'Content-Type': 'application/json'
      }
    });

    const data = JSON.parse(response.body);
    console.log('📋 Existing carrier services:', JSON.stringify(data, null, 2));
    res.json(data);
  } catch (error) {
    console.error('❌ Failed to list carrier services:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Link Shopify product to analysis data (called after publishing)
 */
router.post('/shopify/link-product', async (req, res) => {
  try {
    const { shopifyProductId, analysisProductId, analysisData } = req.body;

    if (!shopifyProductId || !analysisData) {
      return res.status(400).json({
        success: false,
        error: 'Missing shopifyProductId or analysisData'
      });
    }

    // Store mapping for shipping calculations
    productMappings.set(shopifyProductId.toString(), {
      analysisProductId,
      analysisData,
      linkedAt: new Date().toISOString()
    });

    console.log(`🔗 Product mapping stored: Shopify ${shopifyProductId} -> Analysis ${analysisProductId}`);

    res.json({
      success: true,
      message: 'Product linked successfully',
      shopifyProductId,
      analysisProductId
    });

  } catch (error) {
    console.error('❌ Error linking product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to link product',
      message: error.message
    });
  }
});

/**
 * Get linked products (for debugging)
 */
router.get('/shopify/linked-products', (req, res) => {
  const linkedProducts = Array.from(productMappings.entries()).map(([shopifyId, data]) => ({
    shopifyProductId: shopifyId,
    analysisProductId: data.analysisProductId,
    linkedAt: data.linkedAt,
    hasAnalysisData: !!data.analysisData
  }));

  res.json({
    success: true,
    linkedProducts,
    total: linkedProducts.length
  });
});

// === UTILITY FUNCTIONS ===

/**
 * Transform Shopify cart items to our internal format
 */
async function transformShopifyItems(shopifyItems) {
  const transformedItems = [];

  for (const item of shopifyItems) {
    try {
      // Try to find product data from our analysis
      const productData = await findProductByShopifyId(item.product_id, item.variant_id);

      if (productData) {
        // Use our analyzed data - keep as single item with quantity
        transformedItems.push({
          id: `shopify_${item.product_id}_${item.variant_id}`,
          productId: item.product_id,
          name: item.name || item.title || productData.name,
          originalName: item.name || item.title,
          dimensions: productData.dimensions,
          estimatedWeight: productData.weight,
          weight: productData.weight,
          material: productData.material || 'unknown',
          quantity: item.quantity, // Keep original quantity
          fragile: productData.fragile || false,
          shopifyData: {
            variant_id: item.variant_id,
            sku: item.sku,
            price: item.price,
            vendor: item.vendor
          }
        });
      } else {
        // Fallback: estimate dimensions from Shopify data
        const estimatedWeight = item.grams ? (item.grams / 453.592) : 1; // Convert grams to lbs
        const estimatedDimensions = estimateDimensionsFromWeight(estimatedWeight);

        transformedItems.push({
          id: `shopify_${item.product_id}_${item.variant_id}`,
          productId: item.product_id,
          name: item.name || item.title || 'Unknown Product',
          originalName: item.name || item.title,
          dimensions: estimatedDimensions,
          estimatedWeight: estimatedWeight,
          weight: estimatedWeight,
          material: 'unknown',
          quantity: item.quantity, // Keep original quantity
          fragile: false,
          estimated: true,
          shopifyData: {
            variant_id: item.variant_id,
            sku: item.sku,
            price: item.price,
            vendor: item.vendor
          }
        });

        console.warn(`⚠️ Using estimated dimensions for product ${item.product_id}`);
      }
    } catch (error) {
      console.error(`❌ Error processing item ${item.product_id}:`, error);
    }
  }

  return transformedItems;
}

/**
 * Find product data by Shopify product/variant ID
 */
async function findProductByShopifyId(productId, variantId) {
  try {
    // Check our product mappings
    const mapping = productMappings.get(productId.toString());

    if (mapping && mapping.analysisData) {
      const { extractedData, generatedContent } = mapping.analysisData;

      return {
        name: generatedContent?.title || extractedData?.productType || 'Unknown Product',
        dimensions: extractedData?.dimensions || { length: 8, width: 6, height: 3 },
        weight: extractedData?.estimatedWeight || 1,
        material: extractedData?.material || 'unknown',
        fragile: extractedData?.material && ['glass', 'ceramic', 'crystal'].some(mat =>
          extractedData.material.toLowerCase().includes(mat)
        )
      };
    }

    return null;

  } catch (error) {
    console.error('Error finding product data:', error);
    return null;
  }
}

/**
 * Estimate product dimensions from weight (fallback)
 */
function estimateDimensionsFromWeight(weight) {
  // Simple estimation based on weight
  // In production, you'd want better estimation logic

  if (weight < 0.5) {
    return { length: 6, width: 4, height: 1 }; // Small flat item
  } else if (weight < 2) {
    return { length: 8, width: 6, height: 3 }; // Medium item
  } else if (weight < 5) {
    return { length: 12, width: 9, height: 4 }; // Large item
  } else {
    return { length: 16, width: 12, height: 6 }; // Extra large item
  }
}

module.exports = router;