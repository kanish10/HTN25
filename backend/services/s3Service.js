const { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');

class S3Service {
  constructor(opts = {}) {
    this.region = process.env.AWS_REGION || opts.region || 'us-east-1';
    this.bucket = process.env.S3_BUCKET_NAME || opts.bucket;
    if (!this.bucket) {
      throw new Error('S3_BUCKET_NAME env var is required');
    }
    this.s3 = new S3Client({ region: this.region });
  }

  async uploadImage(productId, buffer, originalName, contentType = 'image/jpeg') {
    const ext = (originalName && originalName.split('.').pop()) || 'jpg';
    const key = `products/${productId}/${crypto.randomUUID()}.${ext}`;
    const cmd = new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: buffer, ContentType: contentType });
    const res = await this.s3.send(cmd);
    return {
      s3Key: key,
      imageUrl: `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`,
      etag: res.ETag,
      uploadedAt: new Date().toISOString()
    };
  }

  async getPresignedReadUrl(key, expiresInSeconds = 900) {
    const head = new HeadObjectCommand({ Bucket: this.bucket, Key: key });
    await this.s3.send(head).catch(() => {}); // optional existence check
    const url = await getSignedUrl(this.s3, new PutObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: expiresInSeconds });
    // Note: For read URLs, we need GetObjectCommand. Provide both for compatibility.
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const readUrl = await getSignedUrl(this.s3, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: expiresInSeconds });
    return readUrl;
  }

  async deleteImage(key) {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    return { success: true };
  }
}

module.exports = S3Service;
