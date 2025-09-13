# DynamoDB Schema - ShopBrainProducts

## Table Configuration
- **Table Name**: ShopBrainProducts
- **Partition Key**: productId (String)

## Sample Record Structure

```json
{
  "productId": "prod_1234567890_abc123",
  "createdAt": "2025-01-18T10:30:00Z",
  "status": "published", // uploaded | analyzing | ready_to_publish | published
  "imageUrl": "https://shopbrain-images.s3.amazonaws.com/products/...",
  
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
    "bulletPoints": ["...", "..."],
    "seoTags": ["canvas", "tote", "eco-friendly"],
    "faq": [{"question": "...", "answer": "..."}],
    "abVariants": {
      "titleA": "...",
      "titleB": "..."
    },
    "aiCosts": {
      "breakdown": [...],
      "total": 0.12
    }
  },
  
  "shippingData": {
    "singleItem": {
      "recommendedBox": "Medium Box",
      "boxId": "medium",
      "utilization": "78.5",
      "shippingCost": 6.50
    },
    "bulkOrders": [...],
    "savings": {
      "vsDefaultBox": "27.8",
      "description": "Save 27.8% vs standard shipping"
    }
  },
  
  "shopifyProductId": "7234567890",
  "publishedAt": "2025-01-18T10:35:00Z"
}
```

## Status Values
- `uploaded`: Image has been uploaded to S3
- `analyzing`: AI is processing the image
- `ready_to_publish`: Analysis complete, ready for Shopify
- `published`: Successfully published to Shopify