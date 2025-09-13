const { GoogleGenerativeAI } = require('@google/generative-ai');

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
  "seoTags": ["relevant", "keywords", "for", "seo"]
}

Be specific and accurate with measurements and materials. Base price estimates on similar products in the market.
Return ONLY valid JSON, no additional text.
`;
  }

  async processImageWithGemini(prompt, imagePart) {
    const result = await this.model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();
    
    // Clean up the response and parse JSON
    const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    try {
      const extractedData = JSON.parse(cleanedText);
      
      // Validate required fields
      this.validateExtractedData(extractedData);
      
      return extractedData;
    } catch (parseError) {
      console.error('Failed to parse Gemini response as JSON:', cleanedText);
      throw new Error('Invalid JSON response from Gemini API');
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

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleanedText);
      
    } catch (error) {
      console.error('Error generating content with Gemini:', error);
      throw new Error(`Content generation failed: ${error.message}`);
    }
  }
}

module.exports = GeminiService;