# ShopBrain Image Analysis Module

This module handles image upload to S3 and product analysis using Google's Gemini Vision API.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env
# Edit .env with your API keys

# Start development server
npm run dev

# Run tests
npm test
```

## 📡 API Endpoints

### POST /api/upload
Generate S3 presigned URL for image upload.

**Request:**
```json
{
  "fileName": "product.jpg",
  "fileType": "image/jpeg"
}
```

**Response:**
```json
{
  "success": true,
  "productId": "prod_1234567890_abc123",
  "uploadUrl": "https://s3-presigned-url...",
  "imageUrl": "https://your-bucket.s3.amazonaws.com/products/..."
}
```

### POST /api/analyze/:productId
Analyze uploaded product image with Gemini Vision.

**Request:**
```json
{
  "imageUrl": "https://your-bucket.s3.amazonaws.com/products/..."
}
```

**Response:**
```json
{
  "success": true,
  "productId": "prod_1234567890_abc123",
  "status": "analyzed",
  "data": {
    "extractedData": { /* Gemini analysis results */ },
    "generatedContent": { /* Marketing content */ },
    "shippingData": { /* Shipping optimization */ },
    "imageUrl": "...",
    "createdAt": "2025-01-18T10:30:00Z"
  }
}
```

### GET /api/status/:productId
Check analysis status for a product.

### GET /health
Health check endpoint.

## 🔧 Environment Variables

```env
# AWS Configuration
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
S3_BUCKET_NAME=shopbrain-images

# Google Gemini
GEMINI_API_KEY=your_gemini_api_key

# Server
PORT=3002
```

## 📊 Data Structure

The analysis produces a DynamoDB-ready JSON structure:

```json
{
  "productId": "prod_1234567890_abc123",
  "createdAt": "2025-01-18T10:30:00Z",
  "status": "analyzed",
  "imageUrl": "https://...",
  "extractedData": {
    "productType": "tote bag",
    "category": "Bags",
    "dimensions": { "length": 14, "width": 4, "height": 16 },
    "estimatedWeight": 0.8,
    "material": "canvas",
    "color": "beige",
    "features": ["zipper closure", "interior pocket"],
    "suggestedName": "Canvas Tote Bag",
    "targetAudience": "eco-conscious shoppers",
    "suggestedPrice": { "min": 25, "max": 35 }
  },
  "generatedContent": {
    "title": "Eco-Friendly Canvas Tote Bag with Zipper",
    "description": "...",
    "bulletPoints": ["..."],
    "seoTags": ["canvas", "tote", "eco-friendly"],
    "faq": [{"question": "...", "answer": "..."}],
    "abVariants": { "titleA": "...", "titleB": "..." },
    "aiCosts": { "breakdown": [...], "total": 0.12 }
  },
  "shippingData": {
    "singleItem": {
      "recommendedBox": "Medium Box",
      "utilization": "78.5",
      "shippingCost": 6.50
    },
    "savings": {
      "vsDefaultBox": "27.8",
      "description": "Save 27.8% vs standard shipping"
    }
  }
}
```

## 🧪 Testing

The test suite includes:
- Health check verification
- Upload URL generation
- Image analysis with real API calls
- Error handling validation

Run with: `npm test`

## 🏗️ Architecture

```
backend/image-analysis/
├── services/
│   ├── s3Service.js      # AWS S3 operations
│   └── geminiService.js  # Gemini Vision API
├── routes/
│   └── uploadRoutes.js   # API endpoints
├── utils/
│   └── dataFormatter.js  # DynamoDB formatting
├── tests/
│   └── test-analysis.js  # Test suite
└── server.js             # Express app
```

## 🔍 Features

- **S3 Integration**: Presigned URLs for secure uploads
- **Gemini Vision**: Advanced image analysis
- **Content Generation**: SEO-optimized product content
- **Shipping Optimization**: Smart box recommendations
- **Cost Tracking**: AI processing cost estimates
- **Error Handling**: Comprehensive validation
- **Testing**: Automated test suite