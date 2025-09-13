const { GoogleGenerativeAI } = require('@google/generative-ai');

class QuotaExhaustedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'QuotaExhaustedError';
  }
}

class GeminiService {
  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    console.log('🔑 GeminiService - API Key check:', apiKey ? 'Found' : 'Missing');
    console.log('🔑 GeminiService - API Key length:', apiKey ? apiKey.length : 0);

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Rate limiting configuration
    this.requestCount = 0;
    this.dailyLimit = 45; // Set below the 50 request limit for safety
    this.resetTime = new Date();
    this.resetTime.setUTCHours(24, 0, 0, 0); // Reset at midnight UTC

    // Retry configuration
    this.maxRetries = 3;
    this.baseDelay = 1000; // 1 second base delay
  }

  async analyzeProductImage(imageUrl) {
    const prompt = this.getAnalysisPrompt();

    try {
      // For image analysis, we need to fetch the image first
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
      }
      
      const imageBuffer = await imageResponse.arrayBuffer();
      const base64Image = Buffer.from(imageBuffer).toString('base64');
      
      const imagePart = {
        inlineData: {
          data: base64Image,
          mimeType: imageResponse.headers.get('content-type') || 'image/jpeg'
        }
      };

      return await this.processImageWithGemini(prompt, imagePart);
      
    } catch (error) {
      console.error('Error analyzing image with Gemini:', error);
      throw new Error(`Image analysis failed: ${error.message}`);
    }
  }

  async analyzeProductImageDirect(imageBuffer, mimeType) {
    const prompt = this.getAnalysisPrompt();
    
    try {
      const base64Image = imageBuffer.toString('base64');
      
      const imagePart = {
        inlineData: {
          data: base64Image,
          mimeType: mimeType
        }
      };

      return await this.processImageWithGemini(prompt, imagePart);
      
    } catch (error) {
      console.error('Error analyzing image buffer with Gemini:', error);
      throw new Error(`Direct image analysis failed: ${error.message}`);
    }
  }

  getAnalysisPrompt() {
    return `
Analyze this product image and extract the following information in JSON format:

{
  "productType": "specific product category (e.g., 'tote bag', 'coffee mug', 'sneakers')",
  "category": "general category (e.g., 'Bags', 'Kitchen', 'Footwear')",
  "dimensions": {
    "length": "estimated length in inches",
    "width": "estimated width in inches",
    "height": "estimated height in inches"
  },
  "estimatedWeight": "estimated weight in pounds",
  "material": "primary material (e.g., 'canvas', 'ceramic', 'leather')",
  "color": "primary color",
  "features": ["array", "of", "key", "features"],
  "suggestedName": "descriptive product name",
  "targetAudience": "who would buy this product",
  "suggestedPrice": {
    "min": "minimum price estimate in USD",
    "max": "maximum price estimate in USD"
  },
  "description": "detailed product description for e-commerce",
  "bulletPoints": ["key", "selling", "points", "array"],
  "seoTags": ["relevant", "keywords", "for", "seo"],
  "shopifyCollections": ["suggested", "shopify", "collections", "for", "this", "product"],
  "variants": {
    "colors": ["available", "color", "options", "if", "applicable"],
    "sizes": ["available", "size", "options", "if", "applicable"],
    "materials": ["material", "variants", "if", "applicable"],
    "styles": ["style", "variants", "if", "applicable"]
  },
  "imageQuality": {
    "clarity": "score 1-10 for image sharpness and focus",
    "lighting": "score 1-10 for lighting quality",
    "angle": "score 1-10 for product visibility and angle",
    "background": "score 1-10 for background quality",
    "overall": "overall image quality score 1-10"
  }
}

Be specific and accurate with measurements and materials. Base price estimates on similar products in the market.
For Shopify collections, suggest relevant categories like "Featured Products", "New Arrivals", product category names, etc.
For variants, only suggest realistic options based on what you can see or infer from the product.
Image quality scores help select the best image when multiple are provided.
Return ONLY valid JSON, no additional text.
`;
  }

  checkRateLimit() {
    const now = new Date();

    // Reset counter if we've passed the reset time
    if (now >= this.resetTime) {
      this.requestCount = 0;
      this.resetTime = new Date(now);
      this.resetTime.setUTCHours(24, 0, 0, 0);
      console.log('🔄 GeminiService - Daily rate limit reset');
    }

    if (this.requestCount >= this.dailyLimit) {
      const timeUntilReset = this.resetTime - now;
      const hoursUntilReset = Math.ceil(timeUntilReset / (1000 * 60 * 60));
      throw new Error(`Daily Gemini API limit reached (${this.dailyLimit}/${this.dailyLimit}). Resets in ${hoursUntilReset} hours.`);
    }

    return true;
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async makeGeminiRequest(requestFn, retryCount = 0) {
    try {
      this.checkRateLimit();

      const result = await requestFn();
      this.requestCount++;
      console.log(`🔢 GeminiService - Request count: ${this.requestCount}/${this.dailyLimit}`);

      return result;
    } catch (error) {
      console.error(`🚫 GeminiService - API Error (attempt ${retryCount + 1}):`, error.message);

      // Handle quota exceeded errors
      if (error.message.includes('429') || error.message.includes('quota') || error.message.includes('Too Many Requests')) {
        if (retryCount < this.maxRetries) {
          const delay = this.baseDelay * Math.pow(2, retryCount) + Math.random() * 1000; // Exponential backoff with jitter
          console.log(`⏳ GeminiService - Retrying in ${delay}ms (attempt ${retryCount + 1}/${this.maxRetries})`);

          await this.sleep(delay);
          return this.makeGeminiRequest(requestFn, retryCount + 1);
        }

        console.log('🔄 GeminiService - Quota exhausted, falling back to mock data');
        throw new QuotaExhaustedError('Gemini API quota exhausted');
      }

      // Re-throw non-quota errors
      throw error;
    }
  }

  async analyzeMultipleImages(imageUrls) {
    console.log(`Analyzing ${imageUrls.length} images to select the best one...`);

    const analyses = [];

    for (let i = 0; i < imageUrls.length; i++) {
      const imageUrl = imageUrls[i];
      console.log(`Analyzing image ${i + 1}/${imageUrls.length}...`);

      try {
        const extractedData = await this.analyzeProductImage(imageUrl);
        const score = this.calculateImageScore(extractedData);

        analyses.push({
          index: i,
          imageUrl,
          extractedData,
          score,
          error: null
        });

        console.log(`Image ${i + 1} analyzed - Quality Score: ${score.toFixed(2)}`);

      } catch (error) {
        console.error(`Failed to analyze image ${i + 1}:`, error.message);
        analyses.push({
          index: i,
          imageUrl,
          extractedData: null,
          score: 0,
          error: error.message
        });
      }
    }

    // Select best analysis
    const bestAnalysis = analyses.reduce((best, current) => {
      return current.score > best.score ? current : best;
    });

    if (!bestAnalysis.extractedData) {
      throw new Error('Failed to analyze any of the provided images');
    }

    console.log(`Selected image ${bestAnalysis.index + 1} as best (score: ${bestAnalysis.score.toFixed(2)})`);

    // Generate content for the best analysis
    const generatedContent = await this.generateProductContent(bestAnalysis.extractedData);

    return {
      selectedImageUrl: bestAnalysis.imageUrl,
      selectedIndex: bestAnalysis.index,
      extractedData: bestAnalysis.extractedData,
      generatedContent,
      totalImagesAnalyzed: imageUrls.length,
      allAnalyses: analyses.map(a => ({
        index: a.index,
        imageUrl: a.imageUrl,
        score: a.score,
        error: a.error
      }))
    };
  }

  calculateImageScore(extractedData) {
    if (!extractedData || extractedData._fallbackData) {
      return 0;
    }

    let score = 0;

    // Image quality scores (40% of total)
    if (extractedData.imageQuality) {
      const qualityScore = (
        (parseInt(extractedData.imageQuality.clarity) || 0) +
        (parseInt(extractedData.imageQuality.lighting) || 0) +
        (parseInt(extractedData.imageQuality.angle) || 0) +
        (parseInt(extractedData.imageQuality.background) || 0) +
        (parseInt(extractedData.imageQuality.overall) || 0)
      ) / 5;
      score += qualityScore * 4; // Weight: 40%
    }

    // Data completeness (60% of total)
    let completenessScore = 0;
    const checkFields = [
      'productType', 'category', 'material', 'color', 'suggestedName',
      'dimensions', 'suggestedPrice', 'description'
    ];

    checkFields.forEach(field => {
      if (extractedData[field]) {
        if (typeof extractedData[field] === 'object') {
          // For objects like dimensions, check if they have values
          if (Object.keys(extractedData[field]).length > 0) {
            completenessScore += 1;
          }
        } else if (typeof extractedData[field] === 'string') {
          // For strings, check if non-empty and not generic
          if (extractedData[field].length > 3 &&
              !extractedData[field].toLowerCase().includes('unavailable') &&
              !extractedData[field].toLowerCase().includes('analysis')) {
            completenessScore += 1;
          }
        } else {
          completenessScore += 1;
        }
      }
    });

    const completenessPercentage = (completenessScore / checkFields.length) * 10;
    score += completenessPercentage * 6; // Weight: 60%

    return Math.min(score, 100); // Cap at 100
  }

  generateFallbackData(isContent = false) {
    if (isContent) {
      return {
        title: "Product Analysis - Limited Service",
        description: "Product analysis temporarily unavailable. Please contact support for detailed product information.",
        bulletPoints: [
          "Service temporarily unavailable",
          "Contact support for assistance",
          "Full analysis will be available soon"
        ],
        seoTags: ["product", "analysis", "limited"],
        faq: [
          {
            question: "Why is the analysis limited?",
            answer: "Our analysis service is temporarily at capacity. Please try again later."
          }
        ],
        abVariants: {
          titleA: "Product Analysis - Limited Service",
          titleB: "Analysis Temporarily Unavailable"
        }
      };
    }

    return {
      productType: "product",
      category: "General",
      dimensions: {
        length: "12",
        width: "8",
        height: "4"
      },
      estimatedWeight: "1.0",
      material: "mixed materials",
      color: "various",
      features: ["Quality product", "Durable construction"],
      suggestedName: "Product - Analysis Unavailable",
      targetAudience: "General consumers",
      suggestedPrice: {
        min: "19.99",
        max: "39.99"
      },
      description: "Product analysis is temporarily unavailable due to service limitations. Please contact support for detailed product information and specifications.",
      bulletPoints: [
        "Service temporarily limited",
        "Contact support for details",
        "Full analysis coming soon"
      ],
      seoTags: ["product", "general", "limited-analysis"],
      shopifyCollections: ["General"],
      variants: {
        colors: [],
        sizes: [],
        materials: [],
        styles: []
      },
      imageQuality: {
        clarity: "5",
        lighting: "5",
        angle: "5",
        background: "5",
        overall: "5"
      },
      _fallbackData: true
    };
  }

  async processImageWithGemini(prompt, imagePart) {
    const requestFn = async () => {
      const result = await this.model.generateContent([prompt, imagePart]);
      const response = await result.response;
      return response.text();
    };

    try {
      const text = await this.makeGeminiRequest(requestFn);

      // Clean up the response and parse JSON
      const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      try {
        const extractedData = JSON.parse(cleanedText);

        // Validate required fields
        this.validateExtractedData(extractedData);

        return extractedData;
      } catch (parseError) {
        console.error('JSON parse error:', parseError.message);
        console.error('Raw response length:', text.length);
        console.error('Cleaned response length:', cleanedText.length);
        console.error('First 500 chars of cleaned response:', cleanedText.substring(0, 500));

        // Try more aggressive cleaning
        try {
          const moreCleanedText = cleanedText
            .replace(/^\s*```\s*json\s*/i, '')
            .replace(/```\s*$/i, '')
            .replace(/^\s*{\s*\n/, '{\n')
            .replace(/\n\s*}\s*$/, '\n}')
            .trim();

          const extractedData = JSON.parse(moreCleanedText);
          this.validateExtractedData(extractedData);
          console.log('✅ Successfully parsed with aggressive cleaning');
          return extractedData;
        } catch (secondParseError) {
          console.error('Second parse attempt failed:', secondParseError.message);
          throw new Error('Invalid JSON response from Gemini API');
        }
      }
    } catch (error) {
      if (error instanceof QuotaExhaustedError) {
        console.log('🔄 GeminiService - Using fallback data for image analysis');
        return this.generateFallbackData();
      }
      throw error;
    }
  }

  validateExtractedData(data) {
    const requiredFields = [
      'productType', 'category', 'dimensions', 'material',
      'color', 'suggestedName', 'suggestedPrice'
    ];

    for (const field of requiredFields) {
      if (!data[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate dimensions
    if (!data.dimensions.length || !data.dimensions.width || !data.dimensions.height) {
      throw new Error('Missing dimension data');
    }

    // Validate price range
    if (!data.suggestedPrice.min || !data.suggestedPrice.max) {
      throw new Error('Missing price range data');
    }

    // Validate new fields (optional but should be arrays/objects if present)
    if (data.shopifyCollections && !Array.isArray(data.shopifyCollections)) {
      data.shopifyCollections = [];
    }

    if (data.variants && typeof data.variants !== 'object') {
      data.variants = { colors: [], sizes: [], materials: [], styles: [] };
    }

    if (data.imageQuality && typeof data.imageQuality !== 'object') {
      data.imageQuality = { clarity: "5", lighting: "5", angle: "5", background: "5", overall: "5" };
    }

    return true;
  }

  async generateProductContent(extractedData) {
    const prompt = `
Based on this product data: ${JSON.stringify(extractedData)}

Generate additional e-commerce content in JSON format:

{
  "title": "SEO-optimized product title (60 chars max)",
  "description": "compelling product description for Shopify",
  "bulletPoints": ["key", "selling", "points", "3-5 items"],
  "seoTags": ["relevant", "seo", "keywords"],
  "faq": [
    {"question": "common question", "answer": "helpful answer"},
    {"question": "another question", "answer": "another answer"}
  ],
  "abVariants": {
    "titleA": "first title variant",
    "titleB": "second title variant for A/B testing"
  }
}

Make it compelling and conversion-focused. Return ONLY valid JSON.
`;

    const requestFn = async () => {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    };

    try {
      const text = await this.makeGeminiRequest(requestFn);
      const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleanedText);

    } catch (error) {
      if (error instanceof QuotaExhaustedError) {
        console.log('🔄 GeminiService - Using fallback data for content generation');
        return this.generateFallbackData(true);
      }
      console.error('Error generating content with Gemini:', error);
      throw new Error(`Content generation failed: ${error.message}`);
    }
  }
}

module.exports = GeminiService;