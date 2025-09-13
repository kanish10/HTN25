const express = require('express');
const S3Service = require('../services/s3Service');
const GeminiService = require('../services/geminiService');
const DataFormatter = require('../utils/dataFormatter');

const router = express.Router();

// Initialize services
const s3Service = new S3Service();
const geminiService = new GeminiService();

// POST /upload - Generate presigned URL for image upload
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
      error: 'Failed to generate upload URL',
      details: error.message
    });
  }
});

// POST /analyze/:productId - Analyze uploaded image with Gemini
router.post('/analyze/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const { imageUrl } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({
        error: 'imageUrl is required'
      });
    }
    
    console.log(`Starting analysis for product ${productId}`);
    
    // Step 1: Analyze image with Gemini Vision
    console.log('Extracting product data from image...');
    const extractedData = await geminiService.analyzeProductImage(imageUrl);
    
    // Step 2: Generate additional content
    console.log('Generating marketing content...');
    const generatedContent = await geminiService.generateProductContent(extractedData);
    
    // Step 3: Format data for DynamoDB
    const dynamoDBData = DataFormatter.formatForDynamoDB(
      productId, 
      imageUrl, 
      extractedData, 
      generatedContent
    );
    
    console.log('Analysis completed successfully');
    
    // Return formatted response
    const response = DataFormatter.createAnalysisResponse(dynamoDBData);
    res.json(response);
    
  } catch (error) {
    console.error('Analysis route error:', error);
    res.status(500).json({
      error: 'Failed to analyze image',
      details: error.message
    });
  }
});

// GET /status/:productId - Get analysis status
router.get('/status/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    
    // In a real implementation, this would query DynamoDB
    // For now, return a mock response
    res.json({
      productId,
      status: 'ready_for_analysis',
      message: 'Product ready for analysis'
    });
    
  } catch (error) {
    console.error('Status route error:', error);
    res.status(500).json({
      error: 'Failed to get status',
      details: error.message
    });
  }
});

module.exports = router;