const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3002';
const IMAGE_PATH = path.join(__dirname, '../images/tote_bag.jpg');

async function testWithRealImage() {
  console.log('🧪 Testing with Real Image: tote_bag.jpg\n');
  
  try {
    // Check if image exists
    if (!fs.existsSync(IMAGE_PATH)) {
      console.error('❌ Image not found at:', IMAGE_PATH);
      return;
    }
    
    const imageStats = fs.statSync(IMAGE_PATH);
    console.log('📸 Image Info:');
    console.log('   Path:', IMAGE_PATH);
    console.log('   Size:', imageStats.size, 'bytes');
    console.log('   Size:', (imageStats.size / 1024).toFixed(2), 'KB');
    
    // Test 1: Health check
    console.log('\n1. Testing health endpoint...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health check passed:', healthResponse.data.status);
    
    // Test 2: Direct upload with real image
    console.log('\n2. Testing direct upload with tote_bag.jpg...');
    console.log('   🔄 Processing image with Gemini Vision...');
    
    const formData = new FormData();
    formData.append('image', fs.createReadStream(IMAGE_PATH), {
      filename: 'tote_bag.jpg',
      contentType: 'image/jpeg'
    });
    
    const startTime = Date.now();
    
    try {
      const uploadResponse = await axios.post(
        `${BASE_URL}/api/direct-upload`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
          },
          timeout: 60000 // 60 second timeout for AI processing
        }
      );
      
      const processingTime = Date.now() - startTime;
      
      if (uploadResponse.data.success) {
        console.log('✅ Analysis completed successfully!');
        console.log('   ⏱️  Processing time:', processingTime + 'ms');
        console.log('\n📊 Analysis Results:');
        
        const data = uploadResponse.data.data;
        console.log('   Product ID:', uploadResponse.data.productId);
        console.log('   Product Type:', data.extractedData.productType);
        console.log('   Category:', data.extractedData.category);
        console.log('   Material:', data.extractedData.material);
        console.log('   Color:', data.extractedData.color);
        console.log('   Dimensions:', 
          data.extractedData.dimensions.length + '" × ' +
          data.extractedData.dimensions.width + '" × ' +
          data.extractedData.dimensions.height + '"'
        );
        console.log('   Weight:', data.extractedData.estimatedWeight, 'lbs');
        console.log('   Price Range: $' + 
          data.extractedData.suggestedPrice.min + 
          ' - $' + 
          data.extractedData.suggestedPrice.max
        );
        
        console.log('\n📝 Generated Content:');
        console.log('   Title:', data.generatedContent.title);
        console.log('   SEO Tags:', data.generatedContent.seoTags.join(', '));
        console.log('   Features:', data.extractedData.features.join(', '));
        
        console.log('\n📦 Shipping Info:');
        console.log('   Recommended Box:', data.shippingData.singleItem.recommendedBox);
        console.log('   Shipping Cost: $' + data.shippingData.singleItem.shippingCost);
        console.log('   Savings:', data.shippingData.savings.description);
        
        console.log('\n💰 AI Costs:');
        console.log('   Total: $' + data.generatedContent.aiCosts.total);
        data.generatedContent.aiCosts.breakdown.forEach(cost => {
          console.log('   -', cost.service + ':', '$' + cost.cost);
        });
        
        console.log('\n📄 Complete DynamoDB Record:');
        console.log('=====================================');
        console.log(JSON.stringify({
          productId: uploadResponse.data.productId,
          status: uploadResponse.data.status,
          ...data
        }, null, 2));
        
        console.log('\n🎯 Ready for DynamoDB insertion!');
      }
      
    } catch (uploadError) {
      if (uploadError.code === 'ECONNABORTED') {
        console.log('⏱️  Request timed out - Gemini processing can take 30-60 seconds');
        console.log('   Try increasing timeout or check your Gemini API key');
      } else {
        console.log('❌ Upload failed:', uploadError.response?.data || uploadError.message);
        
        if (uploadError.response?.data?.details?.includes('API key')) {
          console.log('\n💡 Check your Gemini API key in .env file');
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Server not running. Start it with:');
      console.log('   cd backend/image-analysis');
      console.log('   npm run dev');
    }
  }
}

// Also test the S3 method (without actually uploading to S3)
async function testS3Method() {
  console.log('\n🧪 Testing S3 Method (URL generation only)\n');
  
  try {
    const uploadResponse = await axios.post(`${BASE_URL}/api/upload`, {
      fileName: 'tote_bag.jpg',
      fileType: 'image/jpeg'
    });
    
    if (uploadResponse.data.success) {
      console.log('✅ S3 presigned URL generated');
      console.log('   Product ID:', uploadResponse.data.productId);
      console.log('   Upload URL length:', uploadResponse.data.uploadUrl.length, 'chars');
      console.log('   Image URL:', uploadResponse.data.imageUrl);
    }
    
  } catch (error) {
    console.log('❌ S3 method failed:', error.response?.data || error.message);
    console.log('   This is expected if AWS credentials are not configured');
  }
}

// Run the test
if (require.main === module) {
  testWithRealImage()
    .then(() => testS3Method())
    .catch(console.error);
}

module.exports = { testWithRealImage };