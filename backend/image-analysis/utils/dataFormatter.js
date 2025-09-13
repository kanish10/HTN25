const { v4: uuidv4 } = require('uuid');

class DataFormatter {
  static formatForDynamoDB(userId, productId, imageUrl, extractedData, generatedContent) {
    const timestamp = new Date().toISOString();
    
    // Calculate estimated shipping dimensions and weight
    const shippingData = this.calculateShippingOptimization(extractedData.dimensions, extractedData.estimatedWeight);
    
    // Estimate AI processing costs (mock calculation)
    const aiCosts = this.calculateAICosts(extractedData, generatedContent);
    
    return {
        userId,
      productId,
      createdAt: timestamp,
      status: 'analyzed', // uploaded | analyzing | analyzed | ready_to_publish | published
      imageUrl,
      
      extractedData: {
        productType: extractedData.productType,
        category: extractedData.category,
        dimensions: {
          length: Number(extractedData.dimensions.length),
          width: Number(extractedData.dimensions.width),
          height: Number(extractedData.dimensions.height)
        },
        estimatedWeight: Number(extractedData.estimatedWeight),
        material: extractedData.material,
        color: extractedData.color,
        features: extractedData.features || [],
        suggestedName: extractedData.suggestedName,
        targetAudience: extractedData.targetAudience,
        suggestedPrice: {
          min: Number(extractedData.suggestedPrice.min),
          max: Number(extractedData.suggestedPrice.max)
        }
      },
      
      generatedContent: {
        title: generatedContent.title,
        description: generatedContent.description,
        bulletPoints: generatedContent.bulletPoints || [],
        seoTags: generatedContent.seoTags || [],
        faq: generatedContent.faq || [],
        abVariants: generatedContent.abVariants || {},
        aiCosts: aiCosts
      },
      
      shippingData: shippingData,
      
      // Shopify fields (empty until published)
      shopifyProductId: null,
      publishedAt: null
    };
  }

  static calculateShippingOptimization(dimensions, weight) {
    // Mock shipping calculation - in real implementation, use bin-packing algorithm
    const volume = dimensions.length * dimensions.width * dimensions.height;
    
    let recommendedBox = 'Small Box';
    let utilization = 85;
    let baseCost = 4.50;
    
    if (volume > 200) {
      recommendedBox = 'Medium Box';
      utilization = 78;
      baseCost = 6.50;
    }
    
    if (volume > 500) {
      recommendedBox = 'Large Box';
      utilization = 72;
      baseCost = 8.50;
    }
    
    // Add weight-based adjustments
    const weightAdjustment = weight > 2 ? (weight - 2) * 1.5 : 0;
    const finalCost = baseCost + weightAdjustment;
    
    return {
      singleItem: {
        recommendedBox,
        boxId: recommendedBox.toLowerCase().replace(' ', '_'),
        utilization: utilization.toString(),
        shippingCost: Math.round(finalCost * 100) / 100
      },
      bulkOrders: [
        {
          quantity: 5,
          recommendedBox: recommendedBox,
          costPerItem: Math.round((finalCost * 0.9) * 100) / 100,
          totalCost: Math.round((finalCost * 0.9 * 5) * 100) / 100
        },
        {
          quantity: 10,
          recommendedBox: 'Bulk Box',
          costPerItem: Math.round((finalCost * 0.8) * 100) / 100,
          totalCost: Math.round((finalCost * 0.8 * 10) * 100) / 100
        }
      ],
      savings: {
        vsDefaultBox: '27.8',
        description: 'Save 27.8% vs standard shipping'
      }
    };
  }

  static calculateAICosts(extractedData, generatedContent) {
    // Mock AI cost calculation based on API usage
    const imageCost = 0.03; // Gemini Vision cost per image
    const textTokens = JSON.stringify(generatedContent).length / 4; // Rough token estimate
    const textCost = (textTokens / 1000) * 0.002; // Mock text generation cost
    
    const breakdown = [
      {
        service: 'Gemini Vision',
        operation: 'Image Analysis',
        cost: imageCost
      },
      {
        service: 'Gemini Pro',
        operation: 'Content Generation',
        cost: Math.round(textCost * 100) / 100
      }
    ];
    
    const total = breakdown.reduce((sum, item) => sum + item.cost, 0);
    
    return {
      breakdown,
      total: Math.round(total * 100) / 100
    };
  }

  static createAnalysisResponse(dynamoDBData) {
    return {
      success: true,
      productId: dynamoDBData.productId,
      status: dynamoDBData.status,
      data: {
        extractedData: dynamoDBData.extractedData,
        generatedContent: dynamoDBData.generatedContent,
        shippingData: dynamoDBData.shippingData,
        imageUrl: dynamoDBData.imageUrl,
        createdAt: dynamoDBData.createdAt
      }
    };
  }
}

module.exports = DataFormatter;