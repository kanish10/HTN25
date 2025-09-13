const axios = require('axios');

const BASE_URL = 'http://localhost:3002';

async function testImageAnalysis() {
  console.log('🧪 Testing ShopBrain Image Analysis Pipeline\n');
  
  try {
    // Test 1: Health check
    console.log('1. Testing health endpoint...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health check passed:', healthResponse.data.status);
    
    // Test 2: Upload endpoint
    console.log('\n2. Testing upload endpoint...');
    const uploadResponse = await axios.post(`${BASE_URL}/api/upload`, {
      fileName: 'test-product.jpg',
      fileType: 'image/jpeg'
    });
    
    if (uploadResponse.data.success) {
      console.log('✅ Upload URL generated');
      console.log('   Product ID:', uploadResponse.data.productId);
      console.log('   Upload URL available');
    }
    
    // Test 3: Analysis endpoint (with mock image URL)
    console.log('\n3. Testing analysis endpoint...');
    const mockImageUrl = 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400'; // Canvas tote bag
    
    try {
      const analysisResponse = await axios.post(
        `${BASE_URL}/api/analyze/${uploadResponse.data.productId}`,
        { imageUrl: mockImageUrl }
      );
      
      if (analysisResponse.data.success) {
        console.log('✅ Image analysis completed');
        console.log('   Product Type:', analysisResponse.data.data.extractedData.productType);
        console.log('   Price Range: $' + 
          analysisResponse.data.data.extractedData.suggestedPrice.min + 
          ' - $' + 
          analysisResponse.data.data.extractedData.suggestedPrice.max
        );
        console.log('   Title:', analysisResponse.data.data.generatedContent.title);
        console.log('   Shipping Cost: $' + analysisResponse.data.data.shippingData.singleItem.shippingCost);
        
        // Display full DynamoDB-ready JSON
        console.log('\n📄 Complete DynamoDB Data Structure:');
        console.log(JSON.stringify(analysisResponse.data.data, null, 2));
      }
    } catch (analysisError) {
      console.log('❌ Analysis failed:', analysisError.response?.data || analysisError.message);
      console.log('   This might be due to missing API keys or network issues');
    }
    
    // Test 4: Status endpoint
    console.log('\n4. Testing status endpoint...');
    const statusResponse = await axios.get(`${BASE_URL}/api/status/${uploadResponse.data.productId}`);
    console.log('✅ Status check passed:', statusResponse.data.status);
    
    console.log('\n🎉 Test suite completed!');
    
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

// Test error handling
async function testErrorCases() {
  console.log('\n🧪 Testing Error Cases\n');
  
  try {
    // Test invalid file type
    console.log('Testing invalid file type...');
    const invalidResponse = await axios.post(`${BASE_URL}/api/upload`, {
      fileName: 'test.txt',
      fileType: 'text/plain'
    });
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('✅ Correctly rejected non-image file');
    }
  }
  
  try {
    // Test missing parameters
    console.log('Testing missing parameters...');
    const missingResponse = await axios.post(`${BASE_URL}/api/upload`, {});
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('✅ Correctly rejected missing parameters');
    }
  }
}

// Run tests
if (require.main === module) {
  testImageAnalysis()
    .then(() => testErrorCases())
    .catch(console.error);
}

module.exports = { testImageAnalysis, testErrorCases };