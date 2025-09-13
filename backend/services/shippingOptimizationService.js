const GeminiService = require('./geminiService');
// const MartianPackingService = require('./martianPackingService');

class ShippingOptimizationService {
  constructor() {
    this.geminiService = new GeminiService();
    // this.martianService = new MartianPackingService();

    // Available shipping boxes with precise dimensions
    this.availableBoxes = [
      {
        id: 'envelope',
        name: 'Padded Envelope',
        innerDimensions: { length: 12, width: 9, height: 1 },
        maxWeight: 1,
        cost: 3.00,
        type: 'envelope'
      },
      {
        id: 'small',
        name: 'Small Box',
        innerDimensions: { length: 10, width: 7, height: 4 },
        maxWeight: 3,
        cost: 4.50,
        type: 'box'
      },
      {
        id: 'medium',
        name: 'Medium Box',
        innerDimensions: { length: 14, width: 10, height: 6 },
        maxWeight: 10,
        cost: 6.50,
        type: 'box'
      },
      {
        id: 'large',
        name: 'Large Box',
        innerDimensions: { length: 18, width: 14, height: 8 },
        maxWeight: 20,
        cost: 9.00,
        type: 'box'
      },
      {
        id: 'xlarge',
        name: 'Extra Large Box',
        innerDimensions: { length: 24, width: 18, height: 12 },
        maxWeight: 40,
        cost: 14.00,
        type: 'box'
      }
    ];
  }

  /**
   * Calculate optimal packing for multiple items using Martian multi-LLM optimization
   * @param {Array} items - Array of items with dimensions and properties
   * @param {Object} destination - Shipping destination info
   * @returns {Object} Optimized packing solution
   */
  async calculateOptimalPacking(items, destination = {}) {
    console.log(`🔄 Calculating optimal packing for ${items.length} items`);

    try {
      // Step 1: Prepare items for packing algorithm
      const processedItems = this.prepareItemsForPacking(items);

      // Step 2: Try Martian multi-LLM optimization first (temporarily disabled)
      console.log('🤖 Martian optimization temporarily disabled, using enhanced algorithmic approach...');
      
      /*
      try {
        const martianResult = await this.martianService.calculateOptimalPacking(processedItems, destination);
        
        if (martianResult.success) {
          console.log(`✅ Martian optimization successful: ${martianResult.boxes.length} boxes, $${martianResult.totalCost}`);
          console.log(`💰 AI Cost: $${martianResult.martianCosts.total}`);
          
          return {
            success: true,
            boxes: martianResult.boxes,
            totalCost: martianResult.totalCost,
            packingInstructions: martianResult.packingInstructions,
            optimization: martianResult.optimization,
            algorithmDetails: {
              algorithm: 'Martian Multi-LLM Optimization',
              models_used: Object.values(martianResult.martianCosts).map(c => c.model).filter(Boolean),
              ai_cost: martianResult.martianCosts.total,
              optimization_time: 'AI-powered'
            },
            aiInsights: martianResult.aiInsights,
            martianCosts: martianResult.martianCosts
          };
        }
      } catch (martianError) {
        console.warn('⚠️ Martian optimization failed:', martianError.message);
      }
      */

      // Step 3: Fallback to advanced algorithmic optimization
      console.log('🔄 Falling back to advanced algorithmic optimization...');
      const algorithmicResult = this.runAdvancedBinPacking(processedItems);

      // Step 4: Get AI insights for packing strategy using Gemini
      const aiStrategy = await this.getAIPackingStrategy(processedItems, algorithmicResult);

      // Step 5: Validate and optimize the solution
      const finalSolution = await this.validateAndOptimize(algorithmicResult, aiStrategy, processedItems);

      // Step 6: Generate detailed packing instructions
      const packingInstructions = await this.generatePackingInstructions(finalSolution);

      console.log(`✅ Optimal packing calculated: ${finalSolution.boxes.length} boxes, $${finalSolution.totalCost}`);

      return {
        success: true,
        boxes: finalSolution.boxes,
        totalCost: finalSolution.totalCost,
        packingInstructions: packingInstructions,
        optimization: {
          itemsTotal: items.length,
          boxesUsed: finalSolution.boxes.length,
          volumeUtilization: finalSolution.averageUtilization,
          weightUtilization: finalSolution.weightUtilization,
          savings: {
            vsIndividualShipping: this.calculateIndividualShippingSavings(items, finalSolution.totalCost),
            vsSingleLargeBox: this.calculateSingleBoxSavings(finalSolution.totalCost),
            efficiency: ((1 - finalSolution.totalCost / (items.length * 9.00)) * 100).toFixed(1) + '%'
          }
        },
        algorithmDetails: {
          algorithm: 'First Fit Decreasing with 3D Space Partitioning (Fallback)',
          iterations: finalSolution.iterations || 1,
          optimizationTime: finalSolution.processingTime || 0
        },
        aiInsights: aiStrategy,
        martianCosts: {
          total: 0,
          fallback: 'Used Gemini + algorithmic optimization'
        }
      };

    } catch (error) {
      console.error('❌ Shipping optimization failed:', error);
      throw new Error(`Shipping optimization failed: ${error.message}`);
    }
  }

  /**
   * Prepare items for the bin packing algorithm
   * @param {Array} rawItems - Raw item data
   * @returns {Array} Processed items with standardized format
   */
  prepareItemsForPacking(rawItems) {
    return rawItems.map((item, index) => {
      // Expand items based on quantity
      const expandedItems = [];
      const quantity = item.quantity || 1;

      for (let i = 0; i < quantity; i++) {
        expandedItems.push({
          id: `${item.productId || item.id || 'item'}_${index}_${i}`,
          productId: item.productId || item.id,
          name: item.name || item.productType || 'Unknown Item',
          dimensions: this.normalizeDimensions(item.dimensions),
          weight: this.normalizeWeight(item.estimatedWeight || item.weight || 0.5),
          fragile: this.isFragile(item.material),
          stackable: this.isStackable(item.material, item.productType),
          volume: this.calculateVolume(this.normalizeDimensions(item.dimensions)),
          densityClass: this.getDensityClass(item.estimatedWeight || item.weight || 0.5, item.dimensions)
        });
      }

      return expandedItems;
    }).flat();
  }

  /**
   * Advanced 3D Bin Packing Algorithm with First Fit Decreasing
   * @param {Array} items - Processed items array
   * @returns {Object} Packing solution
   */
  runAdvancedBinPacking(items) {
    const startTime = Date.now();

    // Sort items by volume (largest first - First Fit Decreasing heuristic)
    const sortedItems = [...items].sort((a, b) => {
      // Primary sort: Volume (descending)
      const volumeDiff = b.volume - a.volume;
      if (Math.abs(volumeDiff) > 0.1) return volumeDiff;

      // Secondary sort: Weight (descending)
      const weightDiff = b.weight - a.weight;
      if (Math.abs(weightDiff) > 0.1) return weightDiff;

      // Tertiary sort: Fragile items first (need careful placement)
      if (a.fragile && !b.fragile) return -1;
      if (!a.fragile && b.fragile) return 1;

      return 0;
    });

    const packedBoxes = [];
    const remainingItems = [...sortedItems];
    let iterations = 0;

    while (remainingItems.length > 0 && iterations < 1000) {
      iterations++;

      let bestSolution = null;
      let bestEfficiency = -1;

      // Try each box type to find the most efficient packing
      for (const boxType of this.availableBoxes) {
        const solution = this.tryPackBoxAdvanced(remainingItems, boxType);

        if (solution.packed.length > 0) {
          // Calculate efficiency score (items packed + utilization - cost factor)
          const efficiency = solution.packed.length * 10 +
                           solution.utilization -
                           (boxType.cost * 5); // Penalize expensive boxes

          if (efficiency > bestEfficiency) {
            bestEfficiency = efficiency;
            bestSolution = { ...solution, boxType };
          }
        }
      }

      if (bestSolution) {
        packedBoxes.push({
          box: bestSolution.boxType,
          items: bestSolution.packed,
          utilization: bestSolution.utilization,
          weightUtilization: bestSolution.weightUtilization,
          packingLayout: bestSolution.layout
        });

        // Remove packed items
        bestSolution.packed.forEach(packedItem => {
          const index = remainingItems.findIndex(item => item.id === packedItem.id);
          if (index > -1) remainingItems.splice(index, 1);
        });

      } else {
        // Fallback: use largest box for remaining items
        const largestBox = this.availableBoxes[this.availableBoxes.length - 1];
        const forcedPacking = this.forcePackInLargestBox(remainingItems, largestBox);

        if (forcedPacking.packed.length > 0) {
          packedBoxes.push(forcedPacking);
          forcedPacking.packed.forEach(packedItem => {
            const index = remainingItems.findIndex(item => item.id === packedItem.id);
            if (index > -1) remainingItems.splice(index, 1);
          });
        } else {
          throw new Error('Items too large for available shipping boxes');
        }
      }
    }

    const processingTime = Date.now() - startTime;
    const totalCost = packedBoxes.reduce((sum, pb) => sum + pb.box.cost, 0);
    const avgUtilization = packedBoxes.length > 0
      ? (packedBoxes.reduce((sum, pb) => sum + pb.utilization, 0) / packedBoxes.length).toFixed(1)
      : 0;
    const avgWeightUtilization = packedBoxes.length > 0
      ? (packedBoxes.reduce((sum, pb) => sum + pb.weightUtilization, 0) / packedBoxes.length).toFixed(1)
      : 0;

    return {
      boxes: packedBoxes.map(pb => ({
        type: pb.box.name,
        boxId: pb.box.id,
        items: pb.items.map(i => ({
          id: i.id,
          name: i.name,
          position: i.position || { x: 0, y: 0, z: 0 }
        })),
        weight: pb.items.reduce((sum, i) => sum + i.weight, 0),
        utilization: pb.utilization,
        weightUtilization: pb.weightUtilization,
        cost: pb.box.cost,
        packingLayout: pb.packingLayout || 'optimized'
      })),
      totalCost,
      averageUtilization: parseFloat(avgUtilization),
      weightUtilization: parseFloat(avgWeightUtilization),
      iterations,
      processingTime
    };
  }

  /**
   * Advanced box packing with 3D space partitioning
   * @param {Array} items - Items to pack
   * @param {Object} box - Box specifications
   * @returns {Object} Packing result
   */
  tryPackBoxAdvanced(items, box) {
    const boxVolume = this.calculateVolume(box.innerDimensions);
    const spaces = [{
      x: 0, y: 0, z: 0,
      length: box.innerDimensions.length,
      width: box.innerDimensions.width,
      height: box.innerDimensions.height
    }];

    let currentWeight = 0;
    let usedVolume = 0;
    const packed = [];
    const layout = [];

    // Try to pack items using space partitioning
    for (const item of items) {
      if (currentWeight + item.weight > box.maxWeight) continue;

      // Find the best fitting space for this item
      let bestSpace = null;
      let bestFit = Infinity;

      for (let i = 0; i < spaces.length; i++) {
        const space = spaces[i];
        if (this.canFitInSpace(item.dimensions, space)) {
          const fit = this.calculateFitScore(item.dimensions, space);
          if (fit < bestFit) {
            bestFit = fit;
            bestSpace = { space, index: i };
          }
        }
      }

      if (bestSpace) {
        // Pack the item
        packed.push({
          ...item,
          position: {
            x: bestSpace.space.x,
            y: bestSpace.space.y,
            z: bestSpace.space.z
          }
        });

        currentWeight += item.weight;
        usedVolume += item.volume;

        // Update available spaces (space partitioning)
        const newSpaces = this.partitionSpace(bestSpace.space, item.dimensions);
        spaces.splice(bestSpace.index, 1, ...newSpaces);

        layout.push({
          item: item.name,
          position: bestSpace.space,
          method: 'space_partitioning'
        });
      }
    }

    const utilization = boxVolume > 0 ? (usedVolume / boxVolume * 100).toFixed(1) : 0;
    const weightUtilization = box.maxWeight > 0 ? (currentWeight / box.maxWeight * 100).toFixed(1) : 0;

    return {
      packed,
      utilization: parseFloat(utilization),
      weightUtilization: parseFloat(weightUtilization),
      layout: layout.slice(0, 10) // Limit layout details
    };
  }

  /**
   * AI-powered packing strategy analysis using Gemini
   * @param {Array} items - Items to analyze
   * @param {Object} algorithmicResult - Result from bin packing algorithm
   * @returns {Object} AI insights and recommendations
   */
  async getAIPackingStrategy(items, algorithmicResult) {
    try {
      const prompt = `Analyze this shipping optimization scenario and provide insights:

ITEMS TO SHIP:
${items.map(item => `- ${item.name}: ${item.dimensions.length}"×${item.dimensions.width}"×${item.dimensions.height}", ${item.weight}lbs, ${item.fragile ? 'FRAGILE' : 'regular'}`).join('\n')}

ALGORITHMIC SOLUTION:
- Boxes needed: ${algorithmicResult.boxes.length}
- Total cost: $${algorithmicResult.totalCost}
- Average utilization: ${algorithmicResult.averageUtilization}%

Provide analysis in JSON format:
{
  "strategy": "brief strategy description",
  "risks": ["potential packing risks"],
  "recommendations": ["optimization recommendations"],
  "specialHandling": ["items needing special care"],
  "confidence": "high/medium/low confidence in solution"
}`;

      const aiResponse = await this.geminiService.generateText(prompt);
      return JSON.parse(aiResponse.replace(/```json\n?|\n?```/g, ''));

    } catch (error) {
      console.warn('⚠️ AI strategy analysis failed:', error.message);
      return {
        strategy: "Algorithmic optimization using First Fit Decreasing",
        risks: ["Standard packing risks apply"],
        recommendations: ["Follow generated packing instructions"],
        specialHandling: items.filter(i => i.fragile).map(i => i.name),
        confidence: "medium"
      };
    }
  }

  /**
   * Generate detailed packing instructions
   * @param {Object} solution - Final packing solution
   * @returns {String} Human-readable packing instructions
   */
  async generatePackingInstructions(solution) {
    try {
      const prompt = `Generate clear, step-by-step packing instructions for warehouse staff:

PACKING PLAN:
${solution.boxes.map((box, idx) => `
Box ${idx + 1}: ${box.type}
- Items: ${box.items.map(i => i.name).join(', ')}
- Weight: ${box.weight.toFixed(1)} lbs
- Utilization: ${box.utilization}%`).join('\n')}

Create numbered instructions that include:
1. Box selection and preparation
2. Item placement order (fragile items first)
3. Protection requirements
4. Weight distribution tips
5. Final verification steps

Keep instructions practical and clear.`;

      return await this.geminiService.generateText(prompt);

    } catch (error) {
      return this.generateFallbackInstructions(solution);
    }
  }

  // === UTILITY METHODS ===

  normalizeDimensions(dims) {
    if (!dims) return { length: 6, width: 4, height: 2 };
    return {
      length: Math.max(parseFloat(dims.length) || 6, 0.5),
      width: Math.max(parseFloat(dims.width) || 4, 0.5),
      height: Math.max(parseFloat(dims.height) || 2, 0.5)
    };
  }

  normalizeWeight(weight) {
    return Math.max(parseFloat(weight) || 0.5, 0.1);
  }

  calculateVolume(dimensions) {
    return dimensions.length * dimensions.width * dimensions.height;
  }

  isFragile(material) {
    if (!material) return false;
    const fragileMaterials = ['glass', 'ceramic', 'crystal', 'porcelain'];
    return fragileMaterials.some(mat => material.toLowerCase().includes(mat));
  }

  isStackable(material, productType) {
    if (!material || !productType) return true;
    const unstackable = ['electronic', 'fragile', 'liquid'];
    return !unstackable.some(type =>
      productType.toLowerCase().includes(type) ||
      material.toLowerCase().includes(type)
    );
  }

  getDensityClass(weight, dimensions) {
    const volume = this.calculateVolume(this.normalizeDimensions(dimensions));
    const density = weight / volume;

    if (density > 0.5) return 'heavy';
    if (density > 0.2) return 'medium';
    return 'light';
  }

  canFitInSpace(itemDims, space) {
    return itemDims.length <= space.length &&
           itemDims.width <= space.width &&
           itemDims.height <= space.height;
  }

  calculateFitScore(itemDims, space) {
    const wastedSpace = (space.length * space.width * space.height) -
                       (itemDims.length * itemDims.width * itemDims.height);
    return wastedSpace; // Lower is better
  }

  partitionSpace(originalSpace, itemDims) {
    const newSpaces = [];

    // Create remaining spaces after placing item
    const remainingLength = originalSpace.length - itemDims.length;
    const remainingWidth = originalSpace.width - itemDims.width;
    const remainingHeight = originalSpace.height - itemDims.height;

    // Right space
    if (remainingLength > 0.5) {
      newSpaces.push({
        x: originalSpace.x + itemDims.length,
        y: originalSpace.y,
        z: originalSpace.z,
        length: remainingLength,
        width: originalSpace.width,
        height: originalSpace.height
      });
    }

    // Back space
    if (remainingWidth > 0.5) {
      newSpaces.push({
        x: originalSpace.x,
        y: originalSpace.y + itemDims.width,
        z: originalSpace.z,
        length: itemDims.length,
        width: remainingWidth,
        height: originalSpace.height
      });
    }

    // Top space
    if (remainingHeight > 0.5) {
      newSpaces.push({
        x: originalSpace.x,
        y: originalSpace.y,
        z: originalSpace.z + itemDims.height,
        length: itemDims.length,
        width: itemDims.width,
        height: remainingHeight
      });
    }

    return newSpaces.filter(space =>
      space.length > 0.5 && space.width > 0.5 && space.height > 0.5
    );
  }

  forcePackInLargestBox(items, box) {
    // Emergency packing when normal algorithm fails
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);

    if (totalWeight <= box.maxWeight) {
      return {
        box,
        items: items.map(item => ({ ...item, position: { x: 0, y: 0, z: 0 } })),
        utilization: 95, // Assume high utilization for forced packing
        weightUtilization: (totalWeight / box.maxWeight * 100).toFixed(1),
        packingLayout: 'emergency_packing'
      };
    }

    return { packed: [] }; // Cannot pack
  }

  async validateAndOptimize(algorithmicResult, aiStrategy, items) {
    // For now, return algorithmic result as it's already optimized
    // In future, could implement AI-based validation and adjustments
    return algorithmicResult;
  }

  calculateIndividualShippingSavings(items, totalCost) {
    const individualCost = items.length * 9.00; // Assume $9 per item
    return Math.max(0, individualCost - totalCost).toFixed(2);
  }

  calculateSingleBoxSavings(totalCost) {
    const singleLargeBoxCost = 14.00;
    return Math.max(0, singleLargeBoxCost - totalCost).toFixed(2);
  }

  generateFallbackInstructions(solution) {
    return solution.boxes.map((box, idx) => `
Box ${idx + 1}: Use ${box.type}
1. Place fragile items first with adequate protection
2. Fill remaining space with: ${box.items.map(i => i.name).join(', ')}
3. Total weight should be ${box.weight.toFixed(1)} lbs
4. Double-check all items are secure before sealing
`).join('\n');
  }
}

module.exports = ShippingOptimizationService;