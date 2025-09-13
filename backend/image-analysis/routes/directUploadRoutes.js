const express = require('express');
const multer = require('multer');
const GeminiService = require('../services/geminiService');
const DataFormatter = require('../utils/dataFormatter');
const DynamoDBService = require('../services/dynamoDBService');
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
const dynamoDBService = new DynamoDBService();
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
    
    // Step 1: Upload image to S3
    console.log(`Uploading image to S3 for product ${productId}`);
    const s3UploadResult = await s3Service.uploadImage(
      productId,
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );
    
    console.log(`Image uploaded to S3: ${s3UploadResult.imageUrl}`);
    
    // Step 2: Generate presigned URL for Gemini to access the image
    const presignedReadUrl = await s3Service.getPresignedReadUrl(s3UploadResult.s3Key, 3600); // 1 hour expiry
    console.log(`Generated presigned read URL for Gemini analysis`);
    
    // Step 3: Analyze image using the presigned URL
    const extractedData = await geminiService.analyzeProductImage(presignedReadUrl);
    
    // Step 4: Generate additional content
    const generatedContent = await geminiService.generateProductContent(extractedData);
    
    // Step 5: Format for DynamoDB with S3 URL
    const dynamoDBData = DataFormatter.formatForDynamoDB(
      userId,
      productId,
      s3UploadResult.imageUrl, // Use S3 URL
      extractedData,
      generatedContent
    );
    
    // Add S3 and file info
    dynamoDBData.s3Info = {
      s3Key: s3UploadResult.s3Key,
      bucket: process.env.S3_BUCKET_NAME,
      etag: s3UploadResult.etag,
      uploadedAt: s3UploadResult.uploadedAt
    };
    
    dynamoDBData.fileInfo = {
      originalName: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
      processedDirectly: true
    };
    
    // Step 5: Upload to DynamoDB
    try {
      await dynamoDBService.uploadProduct(dynamoDBData);
      console.log(`Product ${productId} successfully uploaded to DynamoDB`);
    } catch (dbError) {
      console.error('DynamoDB upload failed:', dbError.message);
      // If DynamoDB fails, we should clean up the S3 upload
      try {
        await s3Service.deleteImage(s3UploadResult.s3Key);
        console.log('Cleaned up S3 image after DynamoDB failure');
      } catch (cleanupError) {
        console.error('Failed to cleanup S3 image:', cleanupError.message);
      }
      
      return res.status(500).json({
        error: 'Failed to save product data',
        details: dbError.message
      });
    }
    
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
    
    // If there was an S3 upload but processing failed later, clean it up
    if (error.s3Key) {
      try {
        await s3Service.deleteImage(error.s3Key);
        console.log('Cleaned up S3 image after processing failure');
      } catch (cleanupError) {
        console.error('Failed to cleanup S3 image:', cleanupError.message);
      }
    }
    
    res.status(500).json({
      error: 'Failed to process image',
      details: error.message
    });
  }
});

module.exports = router;