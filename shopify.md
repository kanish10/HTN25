Multi-Item Shipping Optimization with Martian Agents
Step 1: Create Shipping Calculation Endpoint
Add this new endpoint to your backend that will be called from your Shopify checkout:

// ===== Multi-Item Shipping Optimization Endpoint =====
app.post('/api/shipping/calculate', async (req, res) => {
  try {
    const { items, destination } = req.body;
    // items = [{ productId, quantity, variantId }]
    
    // 1. Fetch product dimensions from DynamoDB for all items
    const productDimensions = await fetchProductDimensions(items);
    
    // 2. Use Martian to create an intelligent packing agent
    const packingAgent = await createPackingAgent();
    
    // 3. Calculate optimal box configuration
    const packingResult = await packingAgent.calculateOptimalPacking({
      items: productDimensions,
      availableBoxes: getAvailableBoxes(),
      destination
    });
    
    res.json({
      success: true,
      ...packingResult
    });
    
  } catch (error) {
    console.error('Shipping calculation error:', error);
    res.status(500).json({ error: 'Failed to calculate shipping' });
  }
});

// Fetch product dimensions from your DynamoDB
async function fetchProductDimensions(items) {
  const productData = [];
  
  for (const item of items) {
    const result = await dynamodb.get({
      TableName: 'ShopBrainProducts',
      Key: { productId: item.productId }
    }).promise();
    
    if (result.Item && result.Item.extractedData) {
      const { dimensions, estimatedWeight, productType } = result.Item.extractedData;
      
      // Expand based on quantity
      for (let i = 0; i < item.quantity; i++) {
        productData.push({
          id: `${item.productId}_${i}`,
          productId: item.productId,
          name: productType,
          dimensions,
          weight: estimatedWeight,
          fragile: result.Item.extractedData.material === 'glass' || 
                   result.Item.extractedData.material === 'ceramic'
        });
      }
    }
  }
  
  return productData;
}

function getAvailableBoxes() {
  return [
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

Step 2: Create Martian Packing Agent
This is where we leverage Martian's ability to route to different LLMs for different subtasks:
// ===== Martian Intelligent Packing Agent =====
async function createPackingAgent() {
  const martian = new Martian({ apiKey: process.env.MARTIAN_API_KEY });
  
  return {
    async calculateOptimalPacking({ items, availableBoxes, destination }) {
      // Step 1: Analyze items for packing strategy
      const packingStrategy = await martian.route({
        task: 'packing_strategy_analysis',
        prompt: `Analyze these items for optimal packing strategy:
          Items: ${JSON.stringify(items.map(i => ({
            name: i.name,
            dimensions: i.dimensions,
            weight: i.weight,
            quantity: 1,
            fragile: i.fragile
          })))}
          
          Consider:
          1. Item compatibility (fragile items need protection)
          2. Weight distribution
          3. Space optimization
          4. Whether items can be nested/stacked
          
          Return a JSON strategy with grouping recommendations.`,
        max_tokens: 500,
        model_preferences: ['claude-3-opus', 'gpt-4'] // Prefer advanced reasoning models
      });
      
      // Step 2: Use different LLM for mathematical optimization
      const packingCalculation = await martian.route({
        task: 'bin_packing_calculation',
        prompt: `Given this packing strategy: ${strategy.content}
          
          Available boxes: ${JSON.stringify(availableBoxes)}
          
          Calculate the optimal box configuration using 3D bin packing principles.
          Consider:
          - First Fit Decreasing algorithm
          - Volume utilization
          - Weight limits
          - Minimize total shipping cost
          
          Return JSON with exact box assignments.`,
        max_tokens: 1000,
        model_preferences: ['gpt-4-turbo', 'claude-3-opus'] // Models good at math
      });
      
      // Step 3: Validate and optimize the packing plan
      const validationResult = await martian.route({
        task: 'packing_validation',
        prompt: `Validate this packing plan: ${packingCalculation.content}
          
          Check for:
          1. Physical feasibility (items actually fit)
          2. Weight distribution issues
          3. Fragile item protection
          4. Cost optimization opportunities
          
          If issues found, provide corrected plan.`,
        max_tokens: 800,
        model_preferences: ['claude-3-sonnet', 'gpt-3.5-turbo'] // Fast validation
      });
      
      // Step 4: Generate human-readable packing instructions
      const packingInstructions = await martian.route({
        task: 'packing_instructions',
        prompt: `Create clear packing instructions for warehouse staff:
          Packing plan: ${validationResult.content}
          
          Include:
          - Step-by-step instructions
          - Special handling notes
          - Visual arrangement tips
          - Protection requirements`,
        max_tokens: 600,
        model_preferences: ['gpt-4', 'claude-3-opus'] // Good at clear instructions
      });
      
      // Parse results and combine
      const strategy = JSON.parse(packingStrategy.content);
      const calculation = JSON.parse(packingCalculation.content);
      const validation = JSON.parse(validationResult.content);
      
      // Apply our own bin packing algorithm as fallback/verification
      const algorithmicResult = runBinPackingAlgorithm(items, availableBoxes);
      
      // Compare LLM suggestion with algorithmic result
      const finalPlan = await martian.route({
        task: 'plan_comparison',
        prompt: `Compare these two packing plans and choose the best:
          
          LLM Plan: ${JSON.stringify(validation)}
          Algorithm Plan: ${JSON.stringify(algorithmicResult)}
          
          Consider: cost, feasibility, protection, efficiency.
          Return the better plan with reasoning.`,
        max_tokens: 400
      });
      
      const chosenPlan = JSON.parse(finalPlan.content);
      
      return {
        boxes: chosenPlan.boxes,
        totalCost: chosenPlan.totalCost,
        packingInstructions: packingInstructions.content,
        optimization: {
          itemsTotal: items.length,
          boxesUsed: chosenPlan.boxes.length,
          volumeUtilization: chosenPlan.averageUtilization,
          weightUtilization: chosenPlan.weightUtilization,
          savings: {
            vsIndividualShipping: calculateSavings(items, chosenPlan),
            vsSingleLargeBox: (14.00 - chosenPlan.totalCost).toFixed(2)
          }
        },
        aiCosts: {
          strategy: { model: packingStrategy.model_used, cost: packingStrategy.cost },
          calculation: { model: packingCalculation.model_used, cost: packingCalculation.cost },
          validation: { model: validationResult.model_used, cost: validationResult.cost },
          instructions: { model: packingInstructions.model_used, cost: packingInstructions.cost },
          comparison: { model: finalPlan.model_used, cost: finalPlan.cost },
          total: [packingStrategy, packingCalculation, validationResult, packingInstructions, finalPlan]
            .reduce((sum, r) => sum + (r.cost || 0.01), 0)
        }
      };
    }
  };
}

// Algorithmic bin packing implementation
function runBinPackingAlgorithm(items, boxes) {
  // Sort items by volume (largest first - First Fit Decreasing)
  const sortedItems = [...items].sort((a, b) => {
    const volA = a.dimensions.length * a.dimensions.width * a.dimensions.height;
    const volB = b.dimensions.length * b.dimensions.width * b.dimensions.height;
    return volB - volA;
  });
  
  const packedBoxes = [];
  const remainingItems = [...sortedItems];
  
  while (remainingItems.length > 0) {
    let bestBox = null;
    let bestBoxItems = [];
    let bestUtilization = 0;
    
    // Try each box type
    for (const boxType of boxes) {
      const { packed, remaining, utilization } = tryPackBox(remainingItems, boxType);
      
      if (packed.length > 0 && utilization > bestUtilization) {
        bestBox = boxType;
        bestBoxItems = packed;
        bestUtilization = utilization;
      }
    }
    
    if (bestBox) {
      packedBoxes.push({
        box: bestBox,
        items: bestBoxItems,
        utilization: bestUtilization
      });
      
      // Remove packed items
      remainingItems = remainingItems.filter(item => 
        !bestBoxItems.find(packed => packed.id === item.id)
      );
    } else {
      // No items fit in any box - shouldn't happen with proper box sizes
      throw new Error('Items too large for available boxes');
    }
  }
  
  return {
    boxes: packedBoxes.map(pb => ({
      type: pb.box.name,
      boxId: pb.box.id,
      items: pb.items.map(i => i.id),
      weight: pb.items.reduce((sum, i) => sum + i.weight, 0),
      utilization: pb.utilization,
      cost: pb.box.cost
    })),
    totalCost: packedBoxes.reduce((sum, pb) => sum + pb.box.cost, 0),
    averageUtilization: (packedBoxes.reduce((sum, pb) => sum + pb.utilization, 0) / packedBoxes.length).toFixed(1)
  };
}

function tryPackBox(items, box) {
  const boxVolume = box.innerDimensions.length * box.innerDimensions.width * box.innerDimensions.height;
  let remainingVolume = boxVolume;
  let currentWeight = 0;
  const packed = [];
  
  for (const item of items) {
    const itemVolume = item.dimensions.length * item.dimensions.width * item.dimensions.height;
    
    if (canFitInBox(item.dimensions, box.innerDimensions) &&
        itemVolume <= remainingVolume &&
        currentWeight + item.weight <= box.maxWeight) {
      
      packed.push(item);
      remainingVolume -= itemVolume;
      currentWeight += item.weight;
    }
  }
  
  const utilization = ((boxVolume - remainingVolume) / boxVolume * 100);
  
  return {
    packed,
    remaining: items.filter(i => !packed.find(p => p.id === i.id)),
    utilization
  };
}

Step 3: Shopify Carrier Service Integration
To use this in real Shopify checkouts, create a carrier service:
// ===== Shopify Carrier Service Webhook =====
app.post('/api/shopify/shipping-rates', async (req, res) => {
  try {
    const { rate } = req.body;
    const { items, destination } = rate;
    
    // Transform Shopify items to our format
    const shopifyItems = items.map(item => ({
      productId: item.product_id,
      variantId: item.variant_id,
      quantity: item.quantity,
      sku: item.sku
    }));
    
    // Look up product IDs from SKUs if needed
    const mappedItems = await mapShopifyItemsToProducts(shopifyItems);
    
    // Calculate optimal shipping
    const shippingCalc = await fetch(`${process.env.API_URL}/api/shipping/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: mappedItems,
        destination
      })
    }).then(r => r.json());
    
    // Return rates to Shopify
    res.json({
      rates: [
        {
          service_name: 'ShopBrain Optimized Shipping',
          service_code: 'SHOPBRAIN_OPTIMIZED',
          total_price: Math.round(shippingCalc.totalCost * 100), // Convert to cents
          description: `${shippingCalc.boxes.length} optimized packages`,
          currency: 'USD',
          metadata: {
            boxes_count: shippingCalc.boxes.length,
            utilization: shippingCalc.optimization.volumeUtilization,
            packing_plan: JSON.stringify(shippingCalc.boxes)
          }
        },
        // Add a standard shipping option for comparison
        {
          service_name: 'Standard Shipping',
          service_code: 'STANDARD',
          total_price: Math.round(items.length * 9.00 * 100), // Assume large box per item
          description: 'Standard packaging',
          currency: 'USD'
        }
      ]
    });
    
  } catch (error) {
    console.error('Carrier service error:', error);
    res.status(500).json({ error: 'Failed to calculate rates' });
  }
});

Step 4: Add Testing Interface to Your Frontend
Add a shipping calculator component to test multi-item optimization:

// Shipping Calculator Component
function ShippingCalculator({ products }) {
  const [selectedItems, setSelectedItems] = useState([]);
  const [shippingResult, setShippingResult] = useState(null);
  const [calculating, setCalculating] = useState(false);
  
  const handleCalculate = async () => {
    setCalculating(true);
    
    try {
      const response = await axios.post(`${API_URL}/api/shipping/calculate`, {
        items: selectedItems,
        destination: {
          country: 'US',
          postal_code: '10001',
          province: 'NY'
        }
      });
      
      setShippingResult(response.data);
    } catch (error) {
      console.error('Calculation failed:', error);
    } finally {
      setCalculating(false);
    }
  };
  
  const addItem = (product) => {
    const existing = selectedItems.find(i => i.productId === product.productId);
    if (existing) {
      setSelectedItems(items => 
        items.map(i => i.productId === product.productId 
          ? { ...i, quantity: i.quantity + 1 }
          : i
        )
      );
    } else {
      setSelectedItems(items => [...items, { 
        productId: product.productId, 
        quantity: 1 
      }]);
    }
  };
  
  return (
    <div className="shipping-calculator">
      <h2>📦 Multi-Item Shipping Calculator</h2>
      
      <div className="product-selector">
        <h3>Select Products:</h3>
        {products.map(product => (
          <div key={product.productId} className="product-item">
            <span>{product.generatedContent?.title}</span>
            <button onClick={() => addItem(product)}>Add to Order</button>
          </div>
        ))}
      </div>
      
      <div className="selected-items">
        <h3>Order Items:</h3>
        {selectedItems.map(item => {
          const product = products.find(p => p.productId === item.productId);
          return (
            <div key={item.productId} className="order-item">
              <span>{product?.generatedContent?.title}</span>
              <span>Qty: {item.quantity}</span>
            </div>
          );
        })}
      </div>
      
      <button 
        onClick={handleCalculate} 
        disabled={calculating || selectedItems.length === 0}
        className="calculate-button"
      >
        {calculating ? 'Calculating...' : 'Calculate Optimal Shipping'}
      </button>
      
      {shippingResult && (
        <div className="shipping-result">
          <h3>Optimized Shipping Plan:</h3>
          
          <div className="boxes-summary">
            <h4>📦 {shippingResult.boxes.length} Box(es) Required</h4>
            {shippingResult.boxes.map((box, idx) => (
              <div key={idx} className="box-detail">
                <strong>Box {idx + 1}: {box.type}</strong>
                <p>Items: {box.items.length}</p>
                <p>Weight: {box.weight.toFixed(1)} lbs</p>
                <p>Utilization: {box.utilization}%</p>
                <p>Cost: ${box.cost.toFixed(2)}</p>
              </div>
            ))}
          </div>
          
          <div className="cost-summary">
            <h4>💰 Cost Analysis:</h4>
            <p>Total Shipping: ${shippingResult.totalCost.toFixed(2)}</p>
            <p>Saved vs Individual: ${shippingResult.optimization.savings.vsIndividualShipping}</p>
            <p>Saved vs Single Large Box: ${shippingResult.optimization.savings.vsSingleLargeBox}</p>
          </div>
          
          <div className="packing-instructions">
            <h4>📋 Packing Instructions:</h4>
            <pre>{shippingResult.packingInstructions}</pre>
          </div>
          
          <div className="ai-usage">
            <h4>🤖 AI Processing:</h4>
            <p>Total AI Cost: ${shippingResult.aiCosts.total.toFixed(3)}</p>
            <details>
              <summary>Model Usage Details</summary>
              <ul>
                <li>Strategy: {shippingResult.aiCosts.strategy.model} - ${shippingResult.aiCosts.strategy.cost.toFixed(3)}</li>
                <li>Calculation: {shippingResult.aiCosts.calculation.model} - ${shippingResult.aiCosts.calculation.cost.toFixed(3)}</li>
                <li>Validation: {shippingResult.aiCosts.validation.model} - ${shippingResult.aiCosts.validation.cost.toFixed(3)}</li>
                <li>Instructions: {shippingResult.aiCosts.instructions.model} - ${shippingResult.aiCosts.instructions.cost.toFixed(3)}</li>
              </ul>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}

Step 5: Update Your App Component
// Add to your main App component
function App() {
  // ... existing code ...
  
  return (
    <div className="app">
      {/* ... existing components ... */}
      
      {products.length > 0 && (
        <ShippingCalculator products={products.filter(p => p.status === 'published')} />
      )}
    </div>
  );
}