#!/usr/bin/env node

/**
 * S3 Bucket Configuration Script
 * 
 * This script configures the S3 bucket for ShopBrain to allow:
 * 1. Public read access to images
 * 2. CORS configuration for browser access
 * 3. Proper bucket policy for web access
 * 
 * Run with: node configure-s3-bucket.js
 */

const {
    S3Client,
    PutBucketCorsCommand,
    PutBucketPolicyCommand,
    PutPublicAccessBlockCommand,
    GetBucketCorsCommand,
    GetBucketPolicyCommand
} = require('@aws-sdk/client-s3');

require('dotenv').config({ path: '../.env' });

class S3BucketConfigurator {
    constructor() {
        const region = process.env.AWS_REGION;
        const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
        const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

        if (!region || !accessKeyId || !secretAccessKey) {
            throw new Error('Missing required AWS credentials in environment variables');
        }

        this.s3 = new S3Client({
            region,
            credentials: { accessKeyId, secretAccessKey }
        });
        
        this.bucketName = process.env.S3_BUCKET_NAME;
        
        if (!this.bucketName) {
            throw new Error('S3_BUCKET_NAME environment variable is required');
        }

        console.log(`🪣 Configuring S3 bucket: ${this.bucketName}`);
    }

    /**
     * Configure CORS for the S3 bucket to allow browser access
     */
    async configureCORS() {
        console.log('\n🌐 Configuring CORS...');
        
        const corsConfiguration = {
            CORSRules: [
                {
                    AllowedHeaders: ['*'],
                    AllowedMethods: ['GET', 'HEAD'],
                    AllowedOrigins: [
                        'http://localhost:3000',
                        'http://localhost:3001', 
                        'http://localhost:5173',
                        'https://*.vercel.app',
                        'https://*.netlify.app'
                    ],
                    ExposeHeaders: ['ETag'],
                    MaxAgeSeconds: 3000
                }
            ]
        };

        try {
            await this.s3.send(new PutBucketCorsCommand({
                Bucket: this.bucketName,
                CORSConfiguration: corsConfiguration
            }));
            
            console.log('✅ CORS configuration applied successfully');
            
            // Verify CORS configuration
            const corsResult = await this.s3.send(new GetBucketCorsCommand({
                Bucket: this.bucketName
            }));
            
            console.log('📋 Current CORS rules:');
            corsResult.CORSRules.forEach((rule, index) => {
                console.log(`   Rule ${index + 1}:`);
                console.log(`     Methods: ${rule.AllowedMethods.join(', ')}`);
                console.log(`     Origins: ${rule.AllowedOrigins.join(', ')}`);
            });
            
        } catch (error) {
            console.error('❌ Failed to configure CORS:', error.message);
            throw error;
        }
    }

    /**
     * Configure bucket policy for public read access to images
     */
    async configureBucketPolicy() {
        console.log('\n🔒 Configuring bucket policy for public read access...');
        
        const bucketPolicy = {
            Version: '2012-10-17',
            Statement: [
                {
                    Sid: 'PublicReadGetObject',
                    Effect: 'Allow',
                    Principal: '*',
                    Action: 's3:GetObject',
                    Resource: `arn:aws:s3:::${this.bucketName}/products/*`
                }
            ]
        };

        try {
            await this.s3.send(new PutBucketPolicyCommand({
                Bucket: this.bucketName,
                Policy: JSON.stringify(bucketPolicy)
            }));
            
            console.log('✅ Bucket policy applied successfully');
            console.log('📋 Policy allows public read access to /products/* objects');
            
        } catch (error) {
            console.error('❌ Failed to configure bucket policy:', error.message);
            throw error;
        }
    }

    /**
     * Configure public access block settings
     */
    async configurePublicAccessBlock() {
        console.log('\n🚫 Configuring public access block settings...');
        
        const publicAccessBlockConfig = {
            BlockPublicAcls: true,
            IgnorePublicAcls: true,
            BlockPublicPolicy: false, // Allow public policy for read access
            RestrictPublicBuckets: false // Allow public bucket policy
        };

        try {
            await this.s3.send(new PutPublicAccessBlockCommand({
                Bucket: this.bucketName,
                PublicAccessBlockConfiguration: publicAccessBlockConfig
            }));
            
            console.log('✅ Public access block configured successfully');
            console.log('📋 Settings:');
            console.log('   - Block Public ACLs: true');
            console.log('   - Ignore Public ACLs: true');
            console.log('   - Block Public Policy: false (allows our read policy)');
            console.log('   - Restrict Public Buckets: false (allows our read policy)');
            
        } catch (error) {
            console.error('❌ Failed to configure public access block:', error.message);
            throw error;
        }
    }

    /**
     * Test bucket configuration by generating a test URL
     */
    async testConfiguration() {
        console.log('\n🧪 Testing bucket configuration...');
        
        const testImagePath = `products/test-image-${Date.now()}.jpg`;
        const testUrl = `https://${this.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${testImagePath}`;
        
        console.log('📋 Test configuration summary:');
        console.log(`   Bucket: ${this.bucketName}`);
        console.log(`   Region: ${process.env.AWS_REGION}`);
        console.log(`   Test URL format: ${testUrl}`);
        console.log('\n💡 To test image access:');
        console.log('   1. Upload an image using the ShopBrain upload feature');
        console.log('   2. Check browser console for S3 URLs');
        console.log('   3. Verify images load without CORS errors');
    }

    /**
     * Run complete S3 bucket configuration
     */
    async configure() {
        try {
            console.log('🚀 Starting S3 bucket configuration for ShopBrain...');
            
            await this.configurePublicAccessBlock();
            await this.configureBucketPolicy();
            await this.configureCORS();
            await this.testConfiguration();
            
            console.log('\n🎉 S3 bucket configuration completed successfully!');
            console.log('\n📝 Next steps:');
            console.log('   1. Test image uploads in ShopBrain');
            console.log('   2. Verify images display correctly in browser');
            console.log('   3. Check browser console for any remaining CORS errors');
            
        } catch (error) {
            console.error('\n💥 Configuration failed:', error.message);
            console.log('\n🔧 Troubleshooting:');
            console.log('   1. Verify AWS credentials have S3 permissions');
            console.log('   2. Check bucket name is correct in .env file');
            console.log('   3. Ensure bucket exists in the specified region');
            process.exit(1);
        }
    }
}

// Run configuration if called directly
if (require.main === module) {
    const configurator = new S3BucketConfigurator();
    configurator.configure();
}

module.exports = S3BucketConfigurator;
