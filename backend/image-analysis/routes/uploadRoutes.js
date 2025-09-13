const express = require('express');
const S3Service = require('../services/s3Service');
const GeminiService = require('../services/geminiService');
const DataFormatter = require('../utils/dataFormatter');
const DynamoDBService = require('../services/dynamoDBService');

const router = express.Router();

// Initialize services
const s3Service = new S3Service();
const geminiService = new GeminiService();
const dynamoDBService = new DynamoDBService();

// POST /upload - Generate presigned URL for single image upload (simplified)
router.post('/upload', async (req, res) => {
  try {
    const { fileName, fileType } = req.body;

    if (!fileName || !fileType) {
      return res.status(400).json({
        error: 'fileName and fileType are required'
      });
    }

    if (!fileType.startsWith('image/')) {
      return res.status(400).json({
        error: 'Only image files are allowed'
      });
    }

    const uploadData = await s3Service.getPresignedUploadUrl(fileName, fileType);

    res.json({
      success: true,
      productId: uploadData.productId,
      uploadUrl: uploadData.uploadUrl,
      imageUrl: uploadData.imageUrl
    });

  } catch (error) {
    console.error('Upload route error:', error);
    res.status(500).json({
      error: 'Failed to generate upload URLs',
      details: error.message
    });
  }
});

// POST /analyze/:productId - Analyze uploaded images with Gemini and select best
router.post('/analyze/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    let { imageUrls } = req.body; // Array of image URLs

    // If no imageUrls provided, try to get them from S3
    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      console.log(`No imageUrls provided, fetching from S3 for product ${productId}`);
      try {
        const productImages = await s3Service.listProductImages(productId);
        if (productImages.length === 0) {
          return res.status(400).json({
            error: 'No images found for this product. Please upload images first.'
          });
        }
        imageUrls = productImages.map(img => img.imageUrl);
        console.log(`Found ${imageUrls.length} images in S3 for product ${productId}`);
      } catch (error) {
        return res.status(400).json({
          error: 'Failed to retrieve product images. Please provide imageUrls or upload images first.'
        });
      }
    }

    console.log(`Starting analysis for product ${productId} with ${imageUrls.length} image(s)`);

    let bestAnalysis;

    if (imageUrls.length === 1) {
      // Single image - standard flow
      console.log('Analyzing single image...');
      const extractedData = await geminiService.analyzeProductImage(imageUrls[0]);
      const generatedContent = await geminiService.generateProductContent(extractedData);

      bestAnalysis = {
        selectedImageUrl: imageUrls[0],
        selectedIndex: 0,
        extractedData,
        generatedContent,
        totalImagesAnalyzed: 1
      };
    } else {
      // Multiple images - analyze all and select best
      console.log('Analyzing multiple images and selecting best...');
      bestAnalysis = await geminiService.analyzeMultipleImages(imageUrls);
    }

    // Step 3: Format data for DynamoDB
    const dynamoDBData = DataFormatter.formatForDynamoDB(
      productId,
      bestAnalysis.selectedImageUrl,
      bestAnalysis.extractedData,
      bestAnalysis.generatedContent,
      {
        totalImages: imageUrls.length,
        selectedImageIndex: bestAnalysis.selectedIndex,
        allImageUrls: imageUrls
      }
    );

    console.log(`Analysis completed successfully. Best image: ${bestAnalysis.selectedIndex + 1}/${imageUrls.length}`);

    // Upload to DynamoDB
    try {
      await dynamoDBService.uploadProduct(dynamoDBData);
      console.log(`Product ${productId} successfully uploaded to DynamoDB`);
    } catch (dbError) {
      console.error('DynamoDB upload failed:', dbError.message);
      // Continue with response even if DB upload fails
    }

    // Return formatted response
    const response = DataFormatter.createAnalysisResponse(dynamoDBData, bestAnalysis);
    res.json(response);

  } catch (error) {
    console.error('Analysis route error:', error);
    res.status(500).json({
      error: 'Failed to analyze images',
      details: error.message
    });
  }
});

// GET /status/:productId - Get analysis status
router.get('/status/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    
    // Query DynamoDB for actual status
    try {
      const product = await dynamoDBService.getProduct(productId);
      res.json({
        productId,
        status: product.status,
        createdAt: product.createdAt,
        message: `Product status: ${product.status}`
      });
    } catch (error) {
      // If product not found, assume it's ready for analysis
      res.json({
        productId,
        status: 'ready_for_analysis',
        message: 'Product ready for analysis'
      });
    }
    
  } catch (error) {
    console.error('Status route error:', error);
    res.status(500).json({
      error: 'Failed to get status',
      details: error.message
    });
  }
});

module.exports = router;