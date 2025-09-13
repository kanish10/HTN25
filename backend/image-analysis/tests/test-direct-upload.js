const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3002';

async function testDirectUpload() {
  console.log('🧪 Testing Direct Image Upload (No S3)\n');
  
  try {
    // Test 1: Health check
    console.log('1. Testing health endpoint...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health check passed:', healthResponse.data.status);
    
    // Test 2: Create a test image (1x1 pixel PNG)
    console.log('\n2. Creating test image...');
    const testImageBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    
    // Test 3: Direct upload with FormData
    console.log('3. Testing direct upload endpoint...');
    
    const formData = new FormData();
    formData.append('image', testImageBuffer, {
      filename: 'test-product.png',
      contentType: 'image/png'
    });
    
    try {
      const uploadResponse = await axios.post(
        `${BASE_URL}/api/direct-upload`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
          },
          timeout: 30000 // 30 second timeout for AI processing
        }
      );
      
      if (uploadResponse.data.success) {
        console.log('✅ Direct upload and analysis completed!');
        console.log('   Product ID:', uploadResponse.data.productId);
        console.log('   Product Type:', uploadResponse.data.data.extractedData.productType);
        console.log('   Price Range: $' + 
          uploadResponse.data.data.extractedData.suggestedPrice.min + 
          ' - $' + 
          uploadResponse.data.data.extractedData.suggestedPrice.max
        );
        console.log('   Title:', uploadResponse.data.data.generatedContent.title);
        
        // Display processing method
        console.log('\n📄 Processing Info:');
        console.log('   File:', uploadResponse.data.data.fileInfo?.originalName);
        console.log('   Size:', uploadResponse.data.data.fileInfo?.size, 'bytes');
        console.log('   Processed Directly:', uploadResponse.data.data.fileInfo?.processedDirectly);
        
        console.log('\n🎯 Complete Analysis Result:');
        console.log(JSON.stringify(uploadResponse.data.data, null, 2));
      }
      
    } catch (uploadError) {
      if (uploadError.code === 'ECONNABORTED') {
        console.log('⏱️  Request timed out - AI processing can take time');
      } else {
        console.log('❌ Direct upload failed:', uploadError.response?.data || uploadError.message);
        console.log('   This might be due to missing Gemini API key');
      }
    }
    
    console.log('\n🎉 Direct upload test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Make sure the server is running:');
      console.log('   cd backend/image-analysis');
      console.log('   npm install');
      console.log('   npm run dev');
    }
  }
}

// Test error cases for direct upload
async function testDirectUploadErrors() {
  console.log('\n🧪 Testing Direct Upload Error Cases\n');
  
  try {
    // Test no file
    console.log('Testing upload without file...');
    const noFileResponse = await axios.post(`${BASE_URL}/api/direct-upload`);
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('✅ Correctly rejected upload without file');
    }
  }
  
  try {
    // Test non-image file
    console.log('Testing upload with non-image file...');
    const formData = new FormData();
    formData.append('image', Buffer.from('Hello World'), {
      filename: 'test.txt',
      contentType: 'text/plain'
    });
    
    const nonImageResponse = await axios.post(
      `${BASE_URL}/api/direct-upload`,
      formData,
      { headers: formData.getHeaders() }
    );
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('✅ Correctly rejected non-image file');
    }
  }
}

// Comparison test
async function compareUploadMethods() {
  console.log('\n📊 Comparing Upload Methods\n');
  
  console.log('📤 S3 Upload Method:');
  console.log('   ✅ Stores images permanently');
  console.log('   ✅ Scalable for production');
  console.log('   ✅ CDN distribution');
  console.log('   ❌ Requires AWS setup');
  console.log('   ❌ Two-step process');
  
  console.log('\n📤 Direct Upload Method:');
  console.log('   ✅ Single API call');
  console.log('   ✅ No AWS dependencies');
  console.log('   ✅ Faster for testing');
  console.log('   ❌ Images not stored');
  console.log('   ❌ Memory usage for large files');
  
  console.log('\n💡 Recommendation:');
  console.log('   Use direct upload for development/testing');
  console.log('   Use S3 upload for production');
}

// Run tests
if (require.main === module) {
  testDirectUpload()
    .then(() => testDirectUploadErrors())
    .then(() => compareUploadMethods())
    .catch(console.error);
}

module.exports = { testDirectUpload, testDirectUploadErrors };