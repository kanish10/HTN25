const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

class S3Service {
  constructor() {
    this.s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION
    });
    this.bucketName = process.env.S3_BUCKET_NAME;
  }

  generateProductId() {
    const timestamp = Date.now();
    const uuid = uuidv4().split('-')[0];
    return `prod_${timestamp}_${uuid}`;
  }

  async getPresignedUploadUrl(fileName, fileType) {
    const productId = this.generateProductId();
    const fileExtension = fileName.split('.').pop();
    const s3Key = `products/${productId}.${fileExtension}`;

    const params = {
      Bucket: this.bucketName,
      Key: s3Key,
      Expires: 300, // 5 minutes
      ContentType: fileType,
      ACL: 'public-read'
    };

    try {
      const uploadUrl = await this.s3.getSignedUrlPromise('putObject', params);
      const imageUrl = `https://${this.bucketName}.s3.amazonaws.com/${s3Key}`;
      
      return {
        productId,
        uploadUrl,
        imageUrl,
        s3Key
      };
    } catch (error) {
      console.error('Error generating presigned URL:', error);
      throw new Error('Failed to generate upload URL');
    }
  }

  async deleteImage(s3Key) {
    const params = {
      Bucket: this.bucketName,
      Key: s3Key
    };

    try {
      await this.s3.deleteObject(params).promise();
      console.log(`Successfully deleted ${s3Key}`);
    } catch (error) {
      console.error('Error deleting image:', error);
      throw error;
    }
  }
}

module.exports = S3Service;