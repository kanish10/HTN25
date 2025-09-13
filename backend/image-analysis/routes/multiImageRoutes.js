const express = require('express');
const S3Service = require('../services/s3Service');
const GeminiService = require('../services/geminiService');
const DataFormatter = require('../utils/dataFormatter');
const MongoDBService = require('../services/mongoDBService');

const router = express.Router();

// Initialize services
const s3Service = new S3Service();
const geminiService = new GeminiService();
const mongoDBService = new MongoDBService();

// POST /upload-more - Handle multiple image analysis and store only the best one
router.post('/upload-more', async (req, res) => {
  try {
    const { images } = req.body; // Array of { fileName, fileType, imageData } or imageUrls

    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({
        error: 'images array is required with at least one image'
      });
    }

    if (images.length > 5) {
      return res.status(400).json({
        error: 'Maximum 5 images allowed for analysis'
      });
    }

    console.log(`🖼️ Analyzing ${images.length} images to select the best one...`);

    // Convert images to format Gemini can analyze
    const imageAnalyses = [];

    for (let i = 0; i < images.length; i++) {
      const image = images[i];

      try {
        let extractedData;

        if (image.imageUrl) {
          // External URL provided
          extractedData = await geminiService.analyzeProductImage(image.imageUrl);
        } else if (image.imageData) {
          // Base64 data provided
          const imageBuffer = Buffer.from(image.imageData, 'base64');
          const mimeType = image.fileType || 'image/jpeg';
          extractedData = await geminiService.analyzeProductImageDirect(imageBuffer, mimeType);
        } else {
          throw new Error('Either imageUrl or imageData must be provided');
        }

        const score = geminiService.calculateImageScore(extractedData);

        imageAnalyses.push({
          index: i,
          fileName: image.fileName || `image-${i + 1}`,
          extractedData,
          score,
          originalImage: image
        });

        console.log(`📊 Image ${i + 1}: Score ${score.toFixed(2)}`);

      } catch (error) {
        console.error(`❌ Failed to analyze image ${i + 1}:`, error.message);
        imageAnalyses.push({
          index: i,
          fileName: image.fileName || `image-${i + 1}`,
          extractedData: null,
          score: 0,
          error: error.message,
          originalImage: image
        });
      }
    }

    // Find the best image
    const bestImage = imageAnalyses.reduce((best, current) => {
      return current.score > best.score ? current : best;
    });

    if (!bestImage.extractedData) {
      return res.status(400).json({
        error: 'Failed to analyze any of the provided images',
        analyses: imageAnalyses.map(a => ({
          index: a.index,
          fileName: a.fileName,
          score: a.score,
          error: a.error
        }))
      });
    }

    console.log(`🏆 Selected image ${bestImage.index + 1} as best (score: ${bestImage.score.toFixed(2)})`);

    // Now upload ONLY the best image to S3
    const productId = s3Service.generateProductId();
    let imageUrl;

    if (bestImage.originalImage.imageData) {
      // Upload the best image data to S3
      const imageBuffer = Buffer.from(bestImage.originalImage.imageData, 'base64');
      const uploadResult = await s3Service.uploadImage(
        productId,
        imageBuffer,
        bestImage.fileName,
        bestImage.originalImage.fileType || 'image/jpeg'
      );
      imageUrl = uploadResult.imageUrl;
      console.log(`📤 Uploaded best image to S3: ${imageUrl}`);
    } else {
      // Use the external URL
      imageUrl = bestImage.originalImage.imageUrl;
      console.log(`🔗 Using external URL: ${imageUrl}`);
    }

    // Generate additional content for the best image
    const generatedContent = await geminiService.generateProductContent(bestImage.extractedData);

    // Format data for MongoDB
    const mongoDBData = DataFormatter.formatForDynamoDB(
      productId,
      imageUrl,
      bestImage.extractedData,
      generatedContent,
      {
        totalImages: images.length,
        selectedImageIndex: bestImage.index,
        analysisScores: imageAnalyses.map(a => ({
          index: a.index,
          fileName: a.fileName,
          score: a.score,
          error: a.error
        }))
      }
    );

    // Upload to MongoDB
    try {
      await mongoDBService.uploadProduct(mongoDBData);
      console.log(`✅ Product ${productId} successfully saved to MongoDB`);
    } catch (dbError) {
      console.error('❌ MongoDB upload failed:', dbError.message);
    }

    // Return response
    const response = DataFormatter.createAnalysisResponse(mongoDBData, {
      selectedImageUrl: imageUrl,
      selectedIndex: bestImage.index,
      extractedData: bestImage.extractedData,
      generatedContent,
      totalImagesAnalyzed: images.length,
      allAnalyses: imageAnalyses.map(a => ({
        index: a.index,
        fileName: a.fileName,
        score: a.score,
        error: a.error
      }))
    });

    res.json(response);

  } catch (error) {
    console.error('❌ Upload more images failed:', error);
    res.status(500).json({
      error: 'Failed to process multiple images',
      details: error.message
    });
  }
});

module.exports = router;