const express = require('express');
const multer = require('multer');
const GeminiService = require('../services/geminiService');
const DataFormatter = require('../utils/dataFormatter');
const MongoDBService = require('../services/mongoDBService');
const S3Service = require('../services/s3Service');

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
const mongoDBService = new MongoDBService();
const s3Service = new S3Service();

// POST /direct-upload - Upload image directly and analyze
router.post('/direct-upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No image file provided'
      });
    }

    console.log('Processing direct upload:', req.file.originalname);

    // get userId TO-DO
      const userId = req.userId ?? process.env.USER_ID ?? 'unknown'

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
    
    // Step 5: Format for MongoDB with S3 URL
    const mongoDBData = DataFormatter.formatForDynamoDB(
      userId,
      productId,
      null, // No image URL since we processed directly
      extractedData,
      generatedContent
    );
    
    // Add S3 and file info
    mongoDBData.s3Info = {
      s3Key: s3UploadResult.s3Key,
      bucket: process.env.S3_BUCKET_NAME,
      etag: s3UploadResult.etag,
      uploadedAt: s3UploadResult.uploadedAt
    };

    mongoDBData.fileInfo = {
      originalName: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
      processedDirectly: true
    };
    
    // Step 6: Upload to MongoDB
    try {
      await mongoDBService.uploadProduct(mongoDBData);
      console.log(`Product ${productId} successfully uploaded to MongoDB`);
    } catch (dbError) {
      console.error('MongoDB upload failed:', dbError.message);
      // If MongoDB fails, we should clean up the S3 upload
      try {
        await s3Service.deleteImage(s3UploadResult.s3Key);
        console.log('Cleaned up S3 image after MongoDB failure');
      } catch (cleanupError) {
        console.error('Failed to cleanup S3 image:', cleanupError.message);
      }
      
      return res.status(500).json({
        error: 'Failed to save product data',
        details: dbError.message
      });
    }
    
    const response = DataFormatter.createAnalysisResponse(mongoDBData);

    // Auto-store product data for shipping calculations
    try {
      const axios = require('axios');
      await axios.post(`http://localhost:${process.env.PORT || 3002}/api/shipping/store-product`, {
        productId: productId,
        productData: mongoDBData
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