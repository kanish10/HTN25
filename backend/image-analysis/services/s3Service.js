const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

class S3Service {
  constructor() {
    // Configure AWS SDK
    AWS.config.update({
      region: process.env.AWS_REGION,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    });

    this.s3 = new AWS.S3();
    this.bucketName = process.env.S3_BUCKET_NAME;
  }

  /**
   * Generate a unique product ID
   * @returns {string} - Generated product ID
   */
  generateProductId() {
    const timestamp = Date.now();
    const uuid = uuidv4().split('-')[0];
    return `prod_${timestamp}_${uuid}`;
  }

  /**
   * Generate S3 key for a product image
   * @param {string} productId - The product ID
   * @param {string} fileName - Original file name
   * @returns {string} - S3 key
   */
  generateS3Key(productId, fileName) {
    const fileExtension = fileName.split('.').pop();
    return `products/${productId}.${fileExtension}`;
  }

  /**
   * Generate public URL for an S3 object
   * @param {string} s3Key - The S3 key
   * @returns {string} - Public URL
   */
  generatePublicUrl(s3Key) {
    return `https://${this.bucketName}.s3.amazonaws.com/${s3Key}`;
  }

  /**
   * Upload image directly to S3 with a specific product ID
   * @param {string} productId - The product ID to use
   * @param {Buffer} imageBuffer - Image buffer data
   * @param {string} fileName - Original file name
   * @param {string} contentType - MIME type of the image
   * @returns {Promise<Object>} - Upload result with URLs and metadata
   */
  async uploadImage(productId, imageBuffer, fileName, contentType) {
    try {
      const s3Key = this.generateS3Key(productId, fileName);
      
      console.log(`Uploading image for product ${productId} to S3 bucket: ${this.bucketName}`);
      
      const params = {
        Bucket: this.bucketName,
        Key: s3Key,
        Body: imageBuffer,
        ContentType: contentType,
        Metadata: {
          productId: productId,
          originalFileName: fileName,
          uploadedAt: new Date().toISOString()
        }
      };

      const result = await this.s3.upload(params).promise();
      const imageUrl = this.generatePublicUrl(s3Key);
      
      console.log(`Successfully uploaded image for product ${productId} to S3`);
      
      return {
        success: true,
        productId,
        s3Key,
        imageUrl,
        location: result.Location,
        etag: result.ETag,
        fileName,
        contentType,
        uploadedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error uploading image to S3:', error);
      throw new Error(`Failed to upload image to S3: ${error.message}`);
    }
  }

  /**
   * Get presigned URL for reading/downloading an image
   * @param {string} s3Key - The S3 key of the image
   * @param {number} expiresIn - Expiration time in seconds (default: 3600 = 1 hour)
   * @returns {Promise<string>} - Presigned URL for reading
   */
  async getPresignedReadUrl(s3Key, expiresIn = 3600) {
    try {
      const params = {
        Bucket: this.bucketName,
        Key: s3Key,
        Expires: expiresIn
      };

      const readUrl = await this.s3.getSignedUrlPromise('getObject', params);
      
      console.log(`Generated presigned read URL for ${s3Key}`);
      
      return readUrl;

    } catch (error) {
      console.error('Error generating presigned read URL:', error);
      throw new Error(`Failed to generate read URL: ${error.message}`);
    }
  }

  /**
   * Get presigned URL for client-side upload
   * @param {string} fileName - Original file name
   * @param {string} fileType - MIME type
   * @param {string} productId - Optional specific product ID, generates new one if not provided
   * @returns {Promise<Object>} - Presigned URL and metadata
   */
  async getPresignedUploadUrl(fileName, fileType, productId = null) {
    try {
      const finalProductId = productId || this.generateProductId();
      const s3Key = this.generateS3Key(finalProductId, fileName);

      const params = {
        Bucket: this.bucketName,
        Key: s3Key,
        Expires: 300, // 5 minutes
        ContentType: fileType,
        Metadata: {
          productId: finalProductId,
          originalFileName: fileName
        }
      };

      const uploadUrl = await this.s3.getSignedUrlPromise('putObject', params);
      const imageUrl = this.generatePublicUrl(s3Key);
      
      console.log(`Generated presigned URL for product ${finalProductId}`);
      
      return {
        success: true,
        productId: finalProductId,
        uploadUrl,
        imageUrl,
        s3Key,
        expiresIn: 300
      };

    } catch (error) {
      console.error('Error generating presigned URL:', error);
      throw new Error(`Failed to generate upload URL: ${error.message}`);
    }
  }

  /**
   * Get image metadata from S3
   * @param {string} productId - The product ID
   * @returns {Promise<Object>} - Image metadata
   */
  async getImageMetadata(productId) {
    try {
      // Find the image by scanning for objects with the product ID prefix
      const listParams = {
        Bucket: this.bucketName,
        Prefix: `products/${productId}.`
      };

      const listResult = await this.s3.listObjectsV2(listParams).promise();
      
      if (!listResult.Contents || listResult.Contents.length === 0) {
        throw new Error(`No image found for product ID ${productId}`);
      }

      const s3Key = listResult.Contents[0].Key;
      
      const headParams = {
        Bucket: this.bucketName,
        Key: s3Key
      };

      const metadata = await this.s3.headObject(headParams).promise();
      const imageUrl = this.generatePublicUrl(s3Key);
      
      return {
        productId,
        s3Key,
        imageUrl,
        size: metadata.ContentLength,
        contentType: metadata.ContentType,
        lastModified: metadata.LastModified,
        etag: metadata.ETag,
        metadata: metadata.Metadata
      };

    } catch (error) {
      console.error('Error getting image metadata:', error);
      throw new Error(`Failed to get image metadata: ${error.message}`);
    }
  }

  /**
   * List all product images with optional prefix filter
   * @param {string} prefix - Optional prefix filter (default: 'products/')
   * @param {number} maxKeys - Maximum number of keys to return
   * @returns {Promise<Object>} - List of images with metadata
   */
  async listImages(prefix = 'products/', maxKeys = 100) {
    try {
      const params = {
        Bucket: this.bucketName,
        Prefix: prefix,
        MaxKeys: maxKeys
      };

      const result = await this.s3.listObjectsV2(params).promise();
      
      const images = result.Contents.map(object => {
        // Extract product ID from key (assuming format: products/prod_timestamp_uuid.ext)
        const keyParts = object.Key.split('/');
        const fileName = keyParts[keyParts.length - 1];
        const productId = fileName.split('.')[0];
        
        return {
          productId,
          s3Key: object.Key,
          imageUrl: this.generatePublicUrl(object.Key),
          size: object.Size,
          lastModified: object.LastModified,
          etag: object.ETag
        };
      });

      return {
        images,
        count: images.length,
        isTruncated: result.IsTruncated,
        nextContinuationToken: result.NextContinuationToken
      };

    } catch (error) {
      console.error('Error listing images:', error);
      throw new Error(`Failed to list images: ${error.message}`);
    }
  }

  /**
   * Delete image from S3 by product ID
   * @param {string} productId - The product ID
   * @returns {Promise<Object>} - Delete operation result
   */
  async deleteImageByProductId(productId) {
    try {
      // First, find the image key
      const metadata = await this.getImageMetadata(productId);
      
      return await this.deleteImage(metadata.s3Key);

    } catch (error) {
      console.error('Error deleting image by product ID:', error);
      throw new Error(`Failed to delete image for product ${productId}: ${error.message}`);
    }
  }

  /**
   * Delete image from S3 by S3 key
   * @param {string} s3Key - The S3 key
   * @returns {Promise<Object>} - Delete operation result
   */
  async deleteImage(s3Key) {
    try {
      const params = {
        Bucket: this.bucketName,
        Key: s3Key
      };

      await this.s3.deleteObject(params).promise();
      
      console.log(`Successfully deleted image: ${s3Key}`);
      
      return {
        success: true,
        s3Key,
        message: 'Image deleted successfully'
      };

    } catch (error) {
      console.error('Error deleting image:', error);
      throw new Error(`Failed to delete image: ${error.message}`);
    }
  }

  /**
   * Copy image to a new location within the same bucket
   * @param {string} sourceProductId - Source product ID
   * @param {string} targetProductId - Target product ID
   * @returns {Promise<Object>} - Copy operation result
   */
  async copyImage(sourceProductId, targetProductId) {
    try {
      // Get source image metadata
      const sourceMetadata = await this.getImageMetadata(sourceProductId);
      
      // Generate target key
      const sourceFileName = sourceMetadata.s3Key.split('/').pop();
      const fileExtension = sourceFileName.split('.').pop();
      const targetS3Key = `products/${targetProductId}.${fileExtension}`;
      
      const copyParams = {
        Bucket: this.bucketName,
        CopySource: `${this.bucketName}/${sourceMetadata.s3Key}`,
        Key: targetS3Key,
        Metadata: {
          productId: targetProductId,
          copiedFrom: sourceProductId,
          copiedAt: new Date().toISOString()
        },
        MetadataDirective: 'REPLACE'
      };

      await this.s3.copyObject(copyParams).promise();
      
      const targetImageUrl = this.generatePublicUrl(targetS3Key);
      
      console.log(`Successfully copied image from ${sourceProductId} to ${targetProductId}`);
      
      return {
        success: true,
        sourceProductId,
        targetProductId,
        sourceS3Key: sourceMetadata.s3Key,
        targetS3Key,
        targetImageUrl
      };

    } catch (error) {
      console.error('Error copying image:', error);
      throw new Error(`Failed to copy image: ${error.message}`);
    }
  }
}

module.exports = S3Service;