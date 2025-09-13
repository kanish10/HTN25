const express = require('express');
const ShippingService = require('../services/shippingService');

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
router.post('/shopify/shipping-rates', async (req, res) => {
  try {
    const { rate } = req.body || {};
    const items = (rate?.items || []).map((it) => ({
      productId: it.product_id,
      variantId: it.variant_id,
      quantity: it.quantity || 1,
      sku: it.sku,
    }));
    const destination = rate?.destination || {};

    if (items.length === 0) {
      return res.json({ rates: [] });
    }

    const result = await shippingService.calculate(items, destination);

    const optimized = {
      service_name: 'ShopBrain Optimized Shipping',
      service_code: 'SHOPBRAIN_OPTIMIZED',
      total_price: Math.round(result.totalCost * 100),
      currency: 'USD',
      description: `${result.boxes.length} optimized packages`,
      metadata: {
        boxes_count: result.boxes.length,
        utilization: result.averageUtilization,
        packing_plan: JSON.stringify(result.boxes),
      },
    };

    const standard = {
      service_name: 'Standard Shipping',
      service_code: 'STANDARD',
      total_price: Math.round(items.length * 900), // $9 each baseline
      currency: 'USD',
      description: 'Standard packaging',
    };

    res.json({ rates: [optimized, standard] });
  } catch (error) {
    console.error('Carrier service error:', error);
    res.status(500).json({ error: 'Failed to calculate rates' });
  }
});

module.exports = router;
