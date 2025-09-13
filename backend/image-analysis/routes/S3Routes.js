const express = require('express');
const multer = require('multer');
const S3Service = require('../services/s3Service');

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    }
});

// Initialize S3 service
const s3Service = new S3Service();

/**
 * POST /api/s3/upload - Direct upload image to S3
 */
router.post('/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: 'No image file provided'
            });
        }

        const { productId } = req.body;
        const finalProductId = productId || s3Service.generateProductId();

        const result = await s3Service.uploadImage(
            finalProductId,
            req.file.buffer,
            req.file.originalname,
            req.file.mimetype
        );

        res.json({
            success: true,
            message: 'Image uploaded successfully to S3',
            data: result
        });

    } catch (error) {
        console.error('S3 upload route error:', error);
        res.status(500).json({
            error: 'Failed to upload image to S3',
            details: error.message
        });
    }
});

/**
 * POST /api/s3/presigned-read-url - Generate presigned URL for reading an image
 */
router.post('/presigned-read-url', async (req, res) => {
    try {
        const { s3Key, expiresIn } = req.body;

        if (!s3Key) {
            return res.status(400).json({
                error: 's3Key is required'
            });
        }

        const readUrl = await s3Service.getPresignedReadUrl(s3Key, expiresIn || 3600);

        res.json({
            success: true,
            message: 'Presigned read URL generated successfully',
            data: {
                readUrl,
                s3Key,
                expiresIn: expiresIn || 3600
            }
        });

    } catch (error) {
        console.error('Presigned read URL route error:', error);
        res.status(500).json({
            error: 'Failed to generate presigned read URL',
            details: error.message
        });
    }
});

/**
 * POST /api/s3/presigned-url - Generate presigned URL for client-side upload
 */
router.post('/presigned-url', async (req, res) => {
    try {
        const { fileName, fileType, productId } = req.body;

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

        const result = await s3Service.getPresignedUploadUrl(fileName, fileType, productId);

        res.json({
            success: true,
            message: 'Presigned URL generated successfully',
            data: result
        });

    } catch (error) {
        console.error('Presigned URL route error:', error);
        res.status(500).json({
            error: 'Failed to generate presigned URL',
            details: error.message
        });
    }
});

/**
 * GET /api/s3/images - List all images
 */
router.get('/images', async (req, res) => {
    try {
        const { prefix, maxKeys } = req.query;

        const result = await s3Service.listImages(
            prefix || 'products/',
            parseInt(maxKeys) || 100
        );

        res.json({
            success: true,
            message: 'Images retrieved successfully',
            data: result
        });

    } catch (error) {
        console.error('List images route error:', error);
        res.status(500).json({
            error: 'Failed to list images',
            details: error.message
        });
    }
});

/**
 * GET /api/s3/images/:productId - Get image metadata by product ID
 */
router.get('/images/:productId', async (req, res) => {
    try {
        const { productId } = req.params;

        const result = await s3Service.getImageMetadata(productId);

        res.json({
            success: true,
            message: 'Image metadata retrieved successfully',
            data: result
        });

    } catch (error) {
        console.error('Get image metadata route error:', error);

        if (error.message.includes('No image found')) {
            res.status(404).json({
                error: 'Image not found',
                details: error.message
            });
        } else {
            res.status(500).json({
                error: 'Failed to get image metadata',
                details: error.message
            });
        }
    }
});

/**
 * DELETE /api/s3/images/:productId - Delete image by product ID
 */
router.delete('/images/:productId', async (req, res) => {
    try {
        const { productId } = req.params;

        const result = await s3Service.deleteImageByProductId(productId);

        res.json({
            success: true,
            message: 'Image deleted successfully',
            data: result
        });

    } catch (error) {
        console.error('Delete image route error:', error);

        if (error.message.includes('No image found')) {
            res.status(404).json({
                error: 'Image not found',
                details: error.message
            });
        } else {
            res.status(500).json({
                error: 'Failed to delete image',
                details: error.message
            });
        }
    }
});

/**
 * DELETE /api/s3/images/key/:s3Key - Delete image by S3 key
 */
router.delete('/images/key/:s3Key(*)', async (req, res) => {
    try {
        const { s3Key } = req.params;

        // Decode the S3 key (in case it was URL encoded)
        const decodedS3Key = decodeURIComponent(s3Key);

        const result = await s3Service.deleteImage(decodedS3Key);

        res.json({
            success: true,
            message: 'Image deleted successfully',
            data: result
        });

    } catch (error) {
        console.error('Delete image by key route error:', error);
        res.status(500).json({
            error: 'Failed to delete image',
            details: error.message
        });
    }
});

/**
 * POST /api/s3/images/copy - Copy image from one product ID to another
 */
router.post('/images/copy', async (req, res) => {
    try {
        const { sourceProductId, targetProductId } = req.body;

        if (!sourceProductId || !targetProductId) {
            return res.status(400).json({
                error: 'sourceProductId and targetProductId are required'
            });
        }

        const result = await s3Service.copyImage(sourceProductId, targetProductId);

        res.json({
            success: true,
            message: 'Image copied successfully',
            data: result
        });

    } catch (error) {
        console.error('Copy image route error:', error);

        if (error.message.includes('No image found')) {
            res.status(404).json({
                error: 'Source image not found',
                details: error.message
            });
        } else {
            res.status(500).json({
                error: 'Failed to copy image',
                details: error.message
            });
        }
    }
});

/**
 * GET /api/s3/health - Health check for S3 service
 */
router.get('/health', async (req, res) => {
    try {
        // Simple health check by listing bucket contents (limited to 1 item)
        await s3Service.listImages('products/', 1);

        res.json({
            success: true,
            message: 'S3 service is healthy',
            timestamp: new Date().toISOString(),
            bucket: process.env.S3_BUCKET_NAME
        });

    } catch (error) {
        console.error('S3 health check error:', error);
        res.status(500).json({
            success: false,
            error: 'S3 service health check failed',
            details: error.message
        });
    }
});

module.exports = router;