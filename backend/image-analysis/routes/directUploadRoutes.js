const express = require('express');
const multer = require('multer');
const GeminiService = require('../services/geminiService');
const DataFormatter = require('../utils/dataFormatter');

const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

const geminiService = new GeminiService();

// POST /direct-upload - Upload image directly and analyze
router.post('/direct-upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No image file provided'
      });
    }

    console.log('Processing direct upload:', req.file.originalname);
    
    // Generate product ID
    const timestamp = Date.now();
    const productId = `prod_${timestamp}_direct`;
    
    // Analyze image directly from buffer
    const extractedData = await geminiService.analyzeProductImageDirect(
      req.file.buffer, 
      req.file.mimetype
    );
    
    // Generate additional content
    const generatedContent = await geminiService.generateProductContent(extractedData);
    
    // Format for DynamoDB (no S3 URL needed)
    const dynamoDBData = DataFormatter.formatForDynamoDB(
      productId,
      null, // No image URL since we processed directly
      extractedData,
      generatedContent
    );
    
    // Add file info
    dynamoDBData.fileInfo = {
      originalName: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
      processedDirectly: true
    };
    
    const response = DataFormatter.createAnalysisResponse(dynamoDBData);

    // Auto-store product data for shipping calculations
    try {
      const axios = require('axios');
      await axios.post(`http://localhost:${process.env.PORT || 3002}/api/shipping/store-product`, {
        productId: productId,
        productData: dynamoDBData
      });
      console.log(`📦 Product ${productId} automatically stored for shipping calculations`);
    } catch (storeError) {
      console.warn('⚠️ Failed to auto-store product for shipping:', storeError.message);
      // Don't fail the main request if shipping storage fails
    }

    res.json(response);
    
  } catch (error) {
    console.error('Direct upload error:', error);
    res.status(500).json({
      error: 'Failed to process image',
      details: error.message
    });
  }
});

module.exports = router;