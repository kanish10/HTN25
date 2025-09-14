const express = require('express');
const S3Service = require('../services/s3Service');
const { GetObjectCommand } = require('@aws-sdk/client-s3');

const router = express.Router();
const s3Service = new S3Service();

/**
 * Proxy route to serve images from S3 through the backend
 * This serves as a fallback when direct S3 access fails due to CORS or other issues
 */
router.get('/image/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const { ext = 'webp' } = req.query; // Default to webp, but allow override
    
    // Generate S3 key for the product image
    const s3Key = `products/${productId}.${ext}`;
    
    console.log(`🖼️ Serving image via proxy: ${s3Key}`);
    
    // Get the image from S3
    const getObjectParams = {
      Bucket: s3Service.bucketName,
      Key: s3Key
    };
    
    const command = new GetObjectCommand(getObjectParams);
    const response = await s3Service.s3.send(command);
    
    // Set appropriate headers
    res.set({
      'Content-Type': response.ContentType || `image/${ext}`,
      'Content-Length': response.ContentLength,
      'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
      'ETag': response.ETag,
      'Last-Modified': response.LastModified
    });
    
    // Stream the image data
    response.Body.pipe(res);
    
  } catch (error) {
    console.error('❌ Image proxy error:', error.message);
    
    if (error.name === 'NoSuchKey') {
      return res.status(404).json({
        error: 'Image not found',
        message: `No image found for product ${req.params.productId}`
      });
    }
    
    res.status(500).json({
      error: 'Failed to serve image',
      message: error.message
    });
  }
});

/**
 * Proxy route to serve images by S3 key
 * Useful when you have the full S3 key path
 */
router.get('/s3/*', async (req, res) => {
  try {
    // Extract the S3 key from the path (everything after /s3/)
    const s3Key = req.params[0];
    
    if (!s3Key) {
      return res.status(400).json({
        error: 'S3 key is required'
      });
    }
    
    console.log(`🖼️ Serving S3 image via proxy: ${s3Key}`);
    
    // Get the image from S3
    const getObjectParams = {
      Bucket: s3Service.bucketName,
      Key: s3Key
    };
    
    const command = new GetObjectCommand(getObjectParams);
    const response = await s3Service.s3.send(command);
    
    // Determine content type from S3 key extension
    const ext = s3Key.split('.').pop().toLowerCase();
    const contentType = response.ContentType || `image/${ext}`;
    
    // Set appropriate headers
    res.set({
      'Content-Type': contentType,
      'Content-Length': response.ContentLength,
      'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
      'ETag': response.ETag,
      'Last-Modified': response.LastModified,
      'Access-Control-Allow-Origin': '*', // Allow CORS for image requests
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    
    // Stream the image data
    response.Body.pipe(res);
    
  } catch (error) {
    console.error('❌ S3 proxy error:', error.message);
    
    if (error.name === 'NoSuchKey') {
      return res.status(404).json({
        error: 'Image not found',
        message: `No image found at S3 key: ${req.params[0]}`
      });
    }
    
    res.status(500).json({
      error: 'Failed to serve image',
      message: error.message
    });
  }
});

/**
 * Health check for image proxy service
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'image-proxy',
    bucket: s3Service.bucketName,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
