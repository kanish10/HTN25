/*
  ShippingService
  - Multi-item shipping optimization for ShopBrain
  - Hybrid approach: simple rule engine + algorithmic 3D-ish bin packing
  - Optional LLM enhancement via Martian router (if available)

  Notes on Martian usage and models:
  - We prefer newer models (e.g., 'gpt-5', 'claude-4.1-sonnet', 'claude-4-opus')
  - See Martian docs for routing options and model identifiers
    https://docs.martian.run/ (placeholder reference)
  - Code degrades gracefully when MARTIAN_API_KEY is not set or lib is missing
*/

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');

class ShippingService {
  constructor(opts = {}) {
  const region = process.env.AWS_REGION || opts.awsRegion || 'us-east-1';
  const ddb = new DynamoDBClient({ region });
  this.ddb = DynamoDBDocumentClient.from(ddb);
    this.productsTable = process.env.SHOPBRAIN_DDB_TABLE || 'ShopBrainProducts';
    this.martianApiKey = process.env.MARTIAN_API_KEY || null;
  this.martianApiBaseUrl = process.env.MARTIAN_API_BASE_URL || 'https://api.withmartian.com';
  this.martian = this.createLlmRouter();
  }

  // Public API
  async calculate(items, destination) {
    // 1) Lookup dimensions/weights for all items
    const expandedItems = await this.fetchProductDimensions(items);

    // 2) Apply simple rules (inspired by deimos-router rule concepts)
    const ruleContext = this.applyRules(expandedItems);

    // 3) Compute algorithmic baseline
    const boxes = this.getAvailableBoxes(ruleContext);
    const algorithmicResult = this.runBinPackingAlgorithm(ruleContext.items, boxes);

    // 4) Enhance with LLM routing (Martian)
    const enhanced = await this.tryLlmEnhancedPlan(ruleContext.items, boxes, algorithmicResult);

    // 5) Finalize response
    const finalPlan = enhanced || algorithmicResult;

    return {
      ...finalPlan,
      optimization: {
        itemsTotal: ruleContext.items.length,
        boxesUsed: finalPlan.boxes.length,
        volumeUtilization: finalPlan.averageUtilization,
        weightUtilization: finalPlan.weightUtilization || null,
        savings: {
          vsIndividualShipping: this.calculateSavings(ruleContext.items, finalPlan),
          vsSingleLargeBox: (14.0 - finalPlan.totalCost).toFixed(2),
        },
      },
      aiCosts: enhanced?.aiCosts || {
        total: 0,
      },
    };
  }

  // ===== Data fetching =====
  async fetchProductDimensions(items) {
    const productData = [];

    for (const item of items) {
      const { productId, quantity = 1 } = item;
      try {
        const result = await this.ddb.send(
          new GetCommand({ TableName: this.productsTable, Key: { productId } })
        );

        const extracted = result?.Item?.extractedData;
        if (extracted?.dimensions && extracted?.estimatedWeight) {
          for (let i = 0; i < quantity; i++) {
            productData.push({
              id: `${productId}_${i}`,
              productId,
              name: extracted.productType || 'Item',
              dimensions: extracted.dimensions, // {length,width,height} in inches
              weight: extracted.estimatedWeight, // in lbs
              fragile:
                extracted.material === 'glass' || extracted.material === 'ceramic',
            });
          }
        }
      } catch (err) {
        console.warn(`DynamoDB get failed for ${productId}:`, err.message);
      }
    }

    return productData;
  }

  // ===== Rule Engine (inspired by deimos-router) =====
  applyRules(items) {
    // Simple, deterministic rules that influence packing
    // - Fragile items: pack fewer per box
    // - Very small/flat items: prefer envelopes
    // - Very heavy items: prefer larger boxes, limit count per box

    const rules = [this.ruleFragileProtection, this.ruleEnvelopeEligibility, this.ruleHeavyLimit];

    let context = {
      items: [...items],
      preferences: {
        preferEnvelope: false,
        maxItemsPerBoxFragile: 1,
        maxWeightPerBox: null, // lbs
      },
    };

    for (const rule of rules) {
      context = rule.call(this, context);
    }

    return context;
  }

  ruleFragileProtection(context) {
    const hasFragile = context.items.some((i) => i.fragile);
    if (hasFragile) {
      context.preferences.maxItemsPerBoxFragile = 1; // isolate fragile
    }
    return context;
  }

  ruleEnvelopeEligibility(context) {
    // If majority of items are very thin and light, allow envelope preference
    const thinLight = context.items.filter(
      (i) => i.dimensions?.height <= 1 && i.weight <= 1
    );
    if (thinLight.length > 0 && thinLight.length >= context.items.length / 2) {
      context.preferences.preferEnvelope = true;
    }
    return context;
  }

  ruleHeavyLimit(context) {
    const heavy = context.items.some((i) => i.weight >= 15);
    if (heavy) {
      context.preferences.maxWeightPerBox = 40; // stay within common carrier tiers
    }
    return context;
  }

  // ===== Boxes =====
  getAvailableBoxes(context) {
    const all = [
      {
        id: 'envelope',
        name: 'Padded Envelope',
        innerDimensions: { length: 12, width: 9, height: 1 },
        maxWeight: 1,
        cost: 3.0,
        type: 'envelope',
      },
      {
        id: 'small',
        name: 'Small Box',
        innerDimensions: { length: 10, width: 7, height: 4 },
        maxWeight: 3,
        cost: 4.5,
        type: 'box',
      },
      {
        id: 'medium',
        name: 'Medium Box',
        innerDimensions: { length: 14, width: 10, height: 6 },
        maxWeight: 10,
        cost: 6.5,
        type: 'box',
      },
      {
        id: 'large',
        name: 'Large Box',
        innerDimensions: { length: 18, width: 14, height: 8 },
        maxWeight: 20,
        cost: 9.0,
        type: 'box',
      },
      {
        id: 'xlarge',
        name: 'Extra Large Box',
        innerDimensions: { length: 24, width: 18, height: 12 },
        maxWeight: 40,
        cost: 14.0,
        type: 'box',
      },
    ];

    if (context.preferences.preferEnvelope) {
      // Slightly bias envelope first by ordering
      return [all[0], ...all.slice(1)];
    }
    return all;
  }

  // ===== LLM Enhancement via Martian (optional) =====
  createLlmRouter() {
    if (!this.martianApiKey) return null;
    try {
      // Router lives under routes to share with other modules
      const MartianRouter = require('../routes/martianRouter');
      return new MartianRouter({ baseURL: this.martianApiBaseUrl, apiKey: this.martianApiKey });
    } catch (e) {
      console.warn('Martian router unavailable. Proceeding without LLM enhancement.');
      return null;
    }
  }

  async tryLlmEnhancedPlan(items, availableBoxes, algorithmicResult) {
    if (!this.martian) return null;

    try {
      // Step 1: Strategy
      const packingStrategy = await this.martian.route({
        task: 'packing_strategy_analysis',
        prompt:
          `Analyze these items for optimal packing strategy. Return JSON with grouping recommendations.\n\n` +
          `Items: ${JSON.stringify(
            items.map((i) => ({
              name: i.name,
              dimensions: i.dimensions,
              weight: i.weight,
              quantity: 1,
              fragile: i.fragile,
            }))
          )}\n` +
          `Consider: 1) fragile protection, 2) weight distribution, 3) space optimization, 4) stackability.`,
        max_tokens: 600,
        // Updated model preferences to newer models
        model_preferences: ['gpt-5', 'claude-4.1-sonnet', 'claude-4-opus'],
      });

      // Step 2: Calculation
      const packingCalculation = await this.martian.route({
        task: 'bin_packing_calculation',
        prompt:
          `Given this packing strategy: ${packingStrategy.content}\n` +
          `Available boxes: ${JSON.stringify(availableBoxes)}\n` +
          `Calculate the optimal box configuration using 3D bin packing principles.\n` +
          `Consider: First Fit Decreasing, volume utilization, weight limits, and minimizing total cost.\n` +
          `Return JSON with exact box assignments.`,
        max_tokens: 1200,
        model_preferences: ['gpt-5', 'claude-4-opus', 'claude-4.1-sonnet'],
      });

      // Step 3: Validation
      const validationResult = await this.martian.route({
        task: 'packing_validation',
        prompt:
          `Validate this packing plan: ${packingCalculation.content}\n` +
          `Check: feasibility, weight distribution, fragile protection, cost optimization.\n` +
          `If issues are found, provide a corrected plan as JSON.`,
        max_tokens: 800,
        model_preferences: ['claude-4.1-haiku', 'gpt-4.1-mini'],
      });

      // Step 4: Human-readable instructions
      const packingInstructions = await this.martian.route({
        task: 'packing_instructions',
        prompt:
          `Create clear packing instructions for warehouse staff based on this plan: ${validationResult.content}\n` +
          `Include: steps, special handling, visual arrangement tips, protection requirements.`,
        max_tokens: 800,
        model_preferences: ['gpt-5', 'claude-4.1-sonnet'],
      });

      // Step 5: Compare LLM vs algorithmic
      const finalPlan = await this.martian.route({
        task: 'plan_comparison',
        prompt:
          `Compare these two packing plans and choose the best.\n` +
          `LLM Plan: ${validationResult.content}\n` +
          `Algorithm Plan: ${JSON.stringify(algorithmicResult)}\n` +
          `Consider cost, feasibility, protection, and efficiency. Return JSON with the better plan and reasoning.`,
        max_tokens: 500,
        model_preferences: ['gpt-5', 'claude-4-opus'],
      });

      // Parse JSONs where applicable with safe fallbacks
      const chosen = this.safeJsonParse(finalPlan.content) || algorithmicResult;

      return {
        boxes: chosen.boxes || algorithmicResult.boxes,
        totalCost: chosen.totalCost ?? algorithmicResult.totalCost,
        averageUtilization:
          chosen.averageUtilization ?? algorithmicResult.averageUtilization,
        packingInstructions: packingInstructions.content,
        aiCosts: {
          strategy: { model: packingStrategy.model_used, cost: packingStrategy.cost },
          calculation: { model: packingCalculation.model_used, cost: packingCalculation.cost },
          validation: { model: validationResult.model_used, cost: validationResult.cost },
          instructions: { model: packingInstructions.model_used, cost: packingInstructions.cost },
          comparison: { model: finalPlan.model_used, cost: finalPlan.cost },
          total: [
            packingStrategy,
            packingCalculation,
            validationResult,
            packingInstructions,
            finalPlan,
          ].reduce((sum, r) => sum + (r.cost || 0), 0),
        },
      };
    } catch (err) {
      console.warn('LLM enhancement failed, using algorithmic result:', err.message);
      return null;
    }
  }

  safeJsonParse(s) {
    try {
      return JSON.parse(s);
    } catch (_) {
      return null;
    }
  }

  // ===== Algorithmic bin packing (greedy FFD) =====
  runBinPackingAlgorithm(items, boxes) {
    const sortedItems = [...items].sort((a, b) => this.volume(b) - this.volume(a));

    const packedBoxes = [];
    let remainingItems = [...sortedItems];

    while (remainingItems.length > 0) {
      let bestBox = null;
      let bestBoxItems = [];
      let bestUtilization = 0;

      for (const boxType of boxes) {
        const { packed, utilization } = this.tryPackBox(remainingItems, boxType);
        if (packed.length > 0 && utilization > bestUtilization) {
          bestBox = boxType;
          bestBoxItems = packed;
          bestUtilization = utilization;
        }
      }

      if (bestBox) {
        packedBoxes.push({ box: bestBox, items: bestBoxItems, utilization: bestUtilization });
        // Remove packed items
        const packedSet = new Set(bestBoxItems.map((i) => i.id));
        remainingItems = remainingItems.filter((it) => !packedSet.has(it.id));
      } else {
        throw new Error('Items too large for available boxes');
      }
    }

    const totalCost = packedBoxes.reduce((sum, pb) => sum + pb.box.cost, 0);
    const averageUtilization = (
      packedBoxes.reduce((sum, pb) => sum + pb.utilization, 0) / packedBoxes.length
    ).toFixed(1);

    return {
      boxes: packedBoxes.map((pb) => ({
        type: pb.box.name,
        boxId: pb.box.id,
        items: pb.items.map((i) => i.id),
        weight: pb.items.reduce((sum, i) => sum + (i.weight || 0), 0),
        utilization: Number(pb.utilization.toFixed ? pb.utilization.toFixed(1) : pb.utilization),
        cost: pb.box.cost,
      })),
      totalCost,
      averageUtilization,
    };
  }

  tryPackBox(items, box) {
    const boxVol = this.boxVolume(box);
    let remainingVolume = boxVol;
    let currentWeight = 0;
    const packed = [];

    for (const item of items) {
      const itemVol = this.volume(item);
      if (
        this.canFitInBox(item.dimensions, box.innerDimensions) &&
        itemVol <= remainingVolume &&
        currentWeight + (item.weight || 0) <= (box.maxWeight || Infinity)
      ) {
        packed.push(item);
        remainingVolume -= itemVol;
        currentWeight += item.weight || 0;
      }
    }

    const utilization = ((boxVol - remainingVolume) / boxVol) * 100;
    return { packed, utilization };
  }

  canFitInBox(itemDim, boxDim) {
    // Allow rotation: check all permutations of item orientation
    const orientations = [
      [itemDim.length, itemDim.width, itemDim.height],
      [itemDim.length, itemDim.height, itemDim.width],
      [itemDim.width, itemDim.length, itemDim.height],
      [itemDim.width, itemDim.height, itemDim.length],
      [itemDim.height, itemDim.length, itemDim.width],
      [itemDim.height, itemDim.width, itemDim.length],
    ];
    return orientations.some(
      ([l, w, h]) => l <= boxDim.length && w <= boxDim.width && h <= boxDim.height
    );
  }

  boxVolume(box) {
    return (
      box.innerDimensions.length * box.innerDimensions.width * box.innerDimensions.height
    );
  }

  volume(item) {
    return item.dimensions.length * item.dimensions.width * item.dimensions.height;
  }

  calculateSavings(items, plan) {
    const individualCost = items.length * 9.0; // baseline assumption
    return (individualCost - plan.totalCost).toFixed(2);
  }
}

module.exports = ShippingService;