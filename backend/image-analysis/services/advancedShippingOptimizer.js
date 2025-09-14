/**
 * Advanced Shipping Optimizer Service
 * Integrates sophisticated 3D bin packing with rotations, layered packing, and multi-criteria optimization
 */

const {
  optimizeShipment,
  optimizeFromGemini,
  normalizeGeminiItems,
  pack2DGuillotine,
  tryPackInBox,
  martianScore
} = require('./optimizer_standalone');

class AdvancedShippingOptimizer {
  constructor() {
    // Standard shipping boxes with inner dimensions (compatible with optimizer_standalone.js format)
    this.boxCatalog = [
      {
        id: 'small-envelope',
        cost: 1.50,
        innerDims: { length: 9, width: 6, height: 0.5 },
        maxWeight: 0.5,
        name: 'Small Envelope'
      },
      {
        id: 'envelope',
        cost: 2.25,
        innerDims: { length: 12, width: 9, height: 0.75 },
        maxWeight: 1,
        name: 'Padded Envelope'
      },
      {
        id: 'large-envelope',
        cost: 3.00,
        innerDims: { length: 15, width: 12, height: 1 },
        maxWeight: 2,
        name: 'Large Envelope'
      },
      {
        id: 'small',
        cost: 4.50,
        innerDims: { length: 10, width: 7, height: 4 },
        maxWeight: 3,
        name: 'Small Box'
      },
      {
        id: 'medium',
        cost: 6.50,
        innerDims: { length: 14, width: 10, height: 6 },
        maxWeight: 10,
        name: 'Medium Box'
      },
      {
        id: 'large',
        cost: 9.00,
        innerDims: { length: 18, width: 14, height: 8 },
        maxWeight: 20,
        name: 'Large Box'
      },
      {
        id: 'xlarge',
        cost: 14.00,
        innerDims: { length: 24, width: 18, height: 12 },
        maxWeight: 40,
        name: 'Extra Large Box'
      }
    ];
  }

  /**
   * Main entry point for shipping optimization
   * @param {Array} items - Array of items with dimensions and quantities
   * @param {Object} options - Optimization options
   * @returns {Object} Optimized shipping solution
   */
  async optimizeShipment(items, options = {}) {
    console.log(`🚀 Advanced shipping optimization for ${items.length} item types`);

    try {
      // Pre-process items to optimize for envelopes
      const optimizedItems = this.optimizeForEnvelopes(items);
      console.log(`📮 Envelope optimization: ${items.length} → ${optimizedItems.length} items after envelope grouping`);

      // Convert items to Gemini-compatible format for the optimizer
      const geminiItems = this.convertToGeminiFormat(optimizedItems);

      // Set optimization options
      const optimizerOptions = {
        dimDivisor: 139, // US domestic shipping (in³/lb)
        weights: { cost: 0.6, void: 0.25, dim: 0.1, count: 0.05 }, // Prioritize cost, then void space
        shipTogether: options.shipTogether || 'auto'
      };

      // Run the advanced 3D bin packing algorithm
      const result = optimizeFromGemini(geminiItems, this.boxCatalog, optimizerOptions);

      // Transform result to match expected API format
      return this.transformResult(result, items);

    } catch (error) {
      console.error('❌ Advanced optimization failed:', error);
      throw new Error(`Advanced shipping optimization failed: ${error.message}`);
    }
  }

  /**
   * Convert items to format expected by optimizer_standalone.js
   * @param {Array} items - Items in ShopBrain format
   * @returns {Array} Items in Gemini format
   */
  convertToGeminiFormat(items) {
    return items.map(item => {
      // Handle both individual items and expanded quantities
      const dimensions = item.dimensions || {
        length: 6,
        width: 4,
        height: 2
      };

      return {
        suggestedName: item.name || item.productType || 'Product',
        productType: item.productType || 'product',
        dimensions: {
          length: String(dimensions.length),
          width: String(dimensions.width),
          height: String(dimensions.height)
        },
        estimatedWeight: String(item.weight || item.estimatedWeight || 0.5),
        quantity: item.quantity || 1,
        units: {
          length: 'in',
          weight: 'lb'
        }
      };
    });
  }

  /**
   * Transform optimizer result to ShopBrain API format
   * @param {Object} result - Result from optimizer_standalone.js
   * @param {Array} originalItems - Original items for reference
   * @returns {Object} Formatted result
   */
  transformResult(result, originalItems) {
    console.log(`✅ Optimization complete: ${result.shipments.length} boxes, $${result.summary.totalCost}`);

    // Calculate savings compared to standard shipping
    const standardShippingCost = originalItems.reduce((total, item) => {
      const qty = item.quantity || 1;
      return total + (qty * 9.00); // Assume $9 per item individual shipping
    }, 0);

    const savings = Math.max(0, standardShippingCost - result.summary.totalCost);
    const percentSaved = standardShippingCost > 0 ? ((savings / standardShippingCost) * 100).toFixed(1) : 0;

    return {
      success: true,
      totalCost: result.summary.totalCost,
      totalBoxes: result.summary.totalBoxes,
      totalWeight: result.summary.totalActualWeight,
      chargeableWeight: result.summary.totalChargeableWeight,

      // Enhanced box details with 3D positioning
      boxes: result.shipments.map((shipment, index) => ({
        boxId: shipment.boxId,
        boxName: this.getBoxName(shipment.boxId),
        cost: shipment.cost,
        dimensions: shipment.innerDims,
        boxVolume: shipment.boxVolume,
        usedVolume: shipment.usedVolume,
        utilization: shipment.fillPercent,
        voidRatio: shipment.voidRatio,
        weight: shipment.packedWeight,
        chargeableWeight: shipment.dimChargeableWeight,

        // 3D item placement information
        items: shipment.items.map(item => ({
          id: item.id,
          name: this.getOriginalItemName(item.id, originalItems),
          position: item.pos, // x, y, z coordinates
          dimensions: item.dims, // oriented dimensions
          placement: 'optimized' // This was determined by the 3D algorithm
        })),

        packingMethod: '3D_LAYERED_GUILLOTINE',
        packingInstructions: this.generatePackingInstructions(shipment, index + 1)
      })),

      optimization: {
        algorithm: '3D Bin Packing with Rotations & Layered Guillotine',
        itemsTotal: originalItems.length,
        boxesUsed: result.summary.totalBoxes,
        averageUtilization: this.calculateAverageUtilization(result.shipments),
        savings: {
          amount: savings.toFixed(2),
          percentage: percentSaved + '%',
          vsStandardShipping: `$${savings.toFixed(2)} saved vs individual shipping`
        }
      },

      // Detailed algorithm information
      algorithmDetails: {
        approach: 'Layered 3D packing with 6-way rotations',
        optimization: 'Multi-criteria weighted scoring (Martian Score)',
        criteria: 'Cost (60%), Void Ratio (25%), Dimensional Weight (10%), Box Count (5%)',
        features: [
          '6-way item rotation optimization',
          'Layer-based 3D space utilization',
          '2D guillotine packing per layer',
          'Dimensional weight consideration',
          'Multi-box optimization'
        ]
      },

      checkoutDisplay: this.generateCheckoutDisplay(result, savings, standardShippingCost)
    };
  }

  /**
   * Generate checkout display information for frontend
   */
  generateCheckoutDisplay(result, savings, standardCost) {
    const optimizedOption = {
      id: 'optimized',
      name: 'Optimized Shipping',
      description: `AI-optimized packing into ${result.summary.totalBoxes} box${result.summary.totalBoxes > 1 ? 'es' : ''}`,
      cost: result.summary.totalCost,
      estimatedDelivery: '3-5 business days',
      savings: savings > 1 ? `Save $${savings.toFixed(2)}` : null,
      icon: '📦',
      recommended: true,
      details: {
        boxes: result.shipments.map(s => `${this.getBoxName(s.boxId)}: ${s.fillPercent}% full`),
        totalWeight: `${result.summary.totalActualWeight} lbs`,
        algorithm: '3D space optimization'
      }
    };

    const standardOption = {
      id: 'standard',
      name: 'Standard Shipping',
      description: 'Individual packaging per item',
      cost: standardCost,
      estimatedDelivery: '3-5 business days',
      icon: '📮',
      recommended: false
    };

    return {
      options: [optimizedOption, standardOption],
      recommendation: {
        option: 'optimized',
        reason: savings > 1 ? `Save $${savings.toFixed(2)} with smarter packaging` : 'Most efficient packaging',
        confidence: 'high'
      }
    };
  }

  /**
   * Generate human-readable packing instructions
   */
  generatePackingInstructions(shipment, boxNumber) {
    const fragileItems = shipment.items.filter(item =>
      this.isFragileItem(this.getOriginalItemName(item.id))
    );

    let instructions = `Box ${boxNumber} (${this.getBoxName(shipment.boxId)}):\n`;

    if (fragileItems.length > 0) {
      instructions += `1. Add protective padding to bottom\n`;
      instructions += `2. Place fragile items first: ${fragileItems.map(i => this.getOriginalItemName(i.id)).join(', ')}\n`;
    }

    instructions += `3. Add remaining items using 3D-optimized positions\n`;
    instructions += `4. Total weight: ${shipment.packedWeight} lbs\n`;
    instructions += `5. Utilization: ${shipment.fillPercent}% (excellent space usage)\n`;

    return instructions;
  }

  /**
   * Helper methods
   */
  getBoxName(boxId) {
    const box = this.boxCatalog.find(b => b.id === boxId);
    return box ? box.name : boxId;
  }

  getOriginalItemName(itemId, originalItems = []) {
    // Extract base product ID (remove quantity suffixes added by optimizer)
    const baseId = itemId.split('_')[0];
    const original = originalItems.find(item => item.productId === baseId || item.id === baseId);
    return original ? (original.name || original.productType || 'Item') : itemId;
  }

  isFragileItem(itemName) {
    const fragileKeywords = ['glass', 'ceramic', 'fragile', 'delicate', 'crystal'];
    return fragileKeywords.some(keyword =>
      itemName.toLowerCase().includes(keyword)
    );
  }

  calculateAverageUtilization(shipments) {
    if (shipments.length === 0) return 0;
    return shipments.reduce((sum, s) => sum + s.fillPercent, 0) / shipments.length;
  }

  /**
   * Optimize items for envelope shipping
   * Groups small, flat items that can fit in envelopes
   */
  optimizeForEnvelopes(items) {
    const envelopeItems = [];
    const boxItems = [];

    for (const item of items) {
      const dims = item.dimensions || { length: 6, width: 4, height: 2 };
      const weight = item.weight || item.estimatedWeight || 0.5;

      // Check if item can fit in an envelope
      const isEnvelopeSuitable = this.isEnvelopeSuitable(dims, weight, item);

      if (isEnvelopeSuitable) {
        // Group envelope items by similar characteristics
        const envelopeGroup = this.findOrCreateEnvelopeGroup(envelopeItems, item, dims, weight);
        envelopeGroup.items.push(item);
        envelopeGroup.quantity += (item.quantity || 1);
        envelopeGroup.totalWeight += weight * (item.quantity || 1);
      } else {
        boxItems.push(item);
      }
    }

    // Convert envelope groups back to items
    const optimizedEnvelopeItems = envelopeItems.map(group => ({
      ...group.items[0], // Use first item as template
      id: `envelope_group_${group.id}`,
      name: `${group.items.length > 1 ? 'Multiple Small Items' : group.items[0].name} (Envelope)`,
      quantity: 1, // Each group is one "item"
      weight: group.totalWeight,
      dimensions: group.optimalDimensions,
      isEnvelopeGroup: true,
      originalItems: group.items
    }));

    console.log(`📮 Envelope optimization: ${envelopeItems.length} envelope groups, ${boxItems.length} box items`);

    return [...optimizedEnvelopeItems, ...boxItems];
  }

  /**
   * Check if an item is suitable for envelope shipping
   */
  isEnvelopeSuitable(dimensions, weight, item) {
    const { length, width, height } = dimensions;
    const maxDim = Math.max(length, width, height);
    const minDim = Math.min(length, width, height);

    // Criteria for envelope suitability:
    // 1. Very thin (height/thickness < 1 inch)
    // 2. Light weight (< 2 lbs)
    // 3. Not fragile
    // 4. Fits within envelope dimensions

    const isFlat = minDim <= 1.0; // Less than 1 inch thick
    const isLight = weight <= 2.0; // Less than 2 lbs
    const fitsEnvelope = maxDim <= 15 && Math.max(length, width) <= 12; // Fits in large envelope
    const notFragile = !item.fragile &&
                      !(item.material && ['glass', 'ceramic', 'crystal'].includes(item.material.toLowerCase()));

    return isFlat && isLight && fitsEnvelope && notFragile;
  }

  /**
   * Find or create envelope group for similar items
   */
  findOrCreateEnvelopeGroup(envelopeGroups, item, dimensions, weight) {
    // Try to find existing group that can accommodate this item
    const compatibleGroup = envelopeGroups.find(group => {
      const combinedWeight = group.totalWeight + weight;
      const fitsWeight = combinedWeight <= 2.0; // Max envelope weight
      const similarSize = Math.abs(group.optimalDimensions.height - dimensions.height) <= 0.25;
      return fitsWeight && similarSize;
    });

    if (compatibleGroup) {
      return compatibleGroup;
    }

    // Create new group
    const newGroup = {
      id: envelopeGroups.length + 1,
      items: [],
      quantity: 0,
      totalWeight: 0,
      optimalDimensions: {
        length: Math.min(15, Math.max(dimensions.length, 9)), // Envelope length
        width: Math.min(12, Math.max(dimensions.width, 6)),   // Envelope width
        height: Math.max(dimensions.height, 0.5) // Thickness (minimum for padding)
      }
    };

    envelopeGroups.push(newGroup);
    return newGroup;
  }

  /**
   * Create sample test data for the specific example: 3 tote bags + 1 lego set
   */
  createTestScenario() {
    return [
      {
        id: 'tote-bag',
        name: 'Canvas Tote Bag',
        productType: 'bag',
        dimensions: { length: 15, width: 12, height: 6 },
        weight: 0.8,
        quantity: 3,
        material: 'canvas'
      },
      {
        id: 'lego-set',
        name: 'LEGO Architecture Set',
        productType: 'toy',
        dimensions: { length: 18, width: 14, height: 3 },
        weight: 2.5,
        quantity: 1,
        material: 'plastic'
      }
    ];
  }
}

module.exports = AdvancedShippingOptimizer;