const axios = require('axios');

const BASE_URL = 'http://localhost:3002';

async function testMultipleImageAnalysis() {
  console.log('🧪 Testing ShopBrain Multiple Image Analysis Pipeline\n');

  try {
    // Test 1: Health check
    console.log('1. Testing health endpoint...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health check passed:', healthResponse.data.status);

    // Test 2: Multiple image upload endpoint
    console.log('\n2. Testing multiple image upload endpoint...');
    const uploadResponse = await axios.post(`${BASE_URL}/api/upload`, {
      files: [
        { fileName: 'product-1.jpg', fileType: 'image/jpeg' },
        { fileName: 'product-2.jpg', fileType: 'image/jpeg' },
        { fileName: 'product-3.jpg', fileType: 'image/jpeg' }
      ]
    });

    if (uploadResponse.data.success) {
      console.log('✅ Multiple upload URLs generated');
      console.log('   Product ID:', uploadResponse.data.productId);
      console.log('   Total Images:', uploadResponse.data.totalImages);
      console.log('   Upload URLs:', uploadResponse.data.uploads.length);
    }

    // Test 3: Multiple image analysis endpoint
    console.log('\n3. Testing multiple image analysis endpoint...');

    // Using different product images from Unsplash for testing
    const testImageUrls = [
      'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400', // Tote bag
      'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400', // Book/notebook
      'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400'  // Office supplies
    ];

    try {
      const analysisResponse = await axios.post(
        `${BASE_URL}/api/analyze/${uploadResponse.data.productId}`,
        { imageUrls: testImageUrls }
      );

      if (analysisResponse.data.success) {
        console.log('✅ Multiple image analysis completed');
        console.log('   Selected Image Index:', analysisResponse.data.data.imageAnalysis?.selectedImage?.index);
        console.log('   Total Images Analyzed:', analysisResponse.data.data.imageAnalysis?.totalImagesAnalyzed);
        console.log('   Product Type:', analysisResponse.data.data.extractedData.productType);
        console.log('   Price Range: $' +
          analysisResponse.data.data.extractedData.suggestedPrice.min +
          ' - $' +
          analysisResponse.data.data.extractedData.suggestedPrice.max
        );

        // Test new Shopify features
        console.log('   Shopify Collections:', analysisResponse.data.data.extractedData.shopifyCollections);
        console.log('   Color Variants:', analysisResponse.data.data.extractedData.variants.colors);
        console.log('   Size Variants:', analysisResponse.data.data.extractedData.variants.sizes);

        // Image quality scores for debugging
        if (analysisResponse.data.data.imageAnalysis?.analysisScores) {
          console.log('\n📊 Image Quality Scores:');
          analysisResponse.data.data.imageAnalysis.analysisScores.forEach((analysis, index) => {
            console.log(`   Image ${index + 1}: ${analysis.score?.toFixed(2) || 'Failed'} ${analysis.error ? '(Error: ' + analysis.error + ')' : ''}`);
          });
        }

        console.log('\n📄 Multi-Image Data Structure:');
        console.log('   Total Images:', analysisResponse.data.data.multiImageData.totalImages);
        console.log('   Selected Index:', analysisResponse.data.data.multiImageData.selectedImageIndex);
      }
    } catch (analysisError) {
      console.log('❌ Analysis failed:', analysisError.response?.data || analysisError.message);
      console.log('   This might be due to missing API keys or network issues');
    }

    // Test 4: Single image analysis (backward compatibility)
    console.log('\n4. Testing single image analysis (backward compatibility)...');
    try {
      const singleImageResponse = await axios.post(
        `${BASE_URL}/api/analyze/${uploadResponse.data.productId}`,
        { imageUrls: [testImageUrls[0]] }
      );

      if (singleImageResponse.data.success) {
        console.log('✅ Single image analysis (backward compatibility) works');
        console.log('   Product Type:', singleImageResponse.data.data.extractedData.productType);
      }
    } catch (error) {
      console.log('❌ Single image test failed:', error.response?.data || error.message);
    }

    // Test 5: Status endpoint
    console.log('\n5. Testing status endpoint...');
    const statusResponse = await axios.get(`${BASE_URL}/api/status/${uploadResponse.data.productId}`);
    console.log('✅ Status check passed:', statusResponse.data.status);

    console.log('\n🎉 Multi-image test suite completed!');

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

// Test error cases for multiple images
async function testMultiImageErrorCases() {
  console.log('\n🧪 Testing Multiple Image Error Cases\n');

  try {
    // Test too many images
    console.log('Testing too many images (>5)...');
    const tooManyResponse = await axios.post(`${BASE_URL}/api/upload`, {
      files: [
        { fileName: 'test1.jpg', fileType: 'image/jpeg' },
        { fileName: 'test2.jpg', fileType: 'image/jpeg' },
        { fileName: 'test3.jpg', fileType: 'image/jpeg' },
        { fileName: 'test4.jpg', fileType: 'image/jpeg' },
        { fileName: 'test5.jpg', fileType: 'image/jpeg' },
        { fileName: 'test6.jpg', fileType: 'image/jpeg' }
      ]
    });
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('✅ Correctly rejected too many images');
    }
  }

  try {
    // Test empty files array
    console.log('Testing empty files array...');
    const emptyResponse = await axios.post(`${BASE_URL}/api/upload`, {
      files: []
    });
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('✅ Correctly rejected empty files array');
    }
  }

  try {
    // Test invalid file format in multiple files
    console.log('Testing mixed valid/invalid file types...');
    const mixedResponse = await axios.post(`${BASE_URL}/api/upload`, {
      files: [
        { fileName: 'test1.jpg', fileType: 'image/jpeg' },
        { fileName: 'test2.txt', fileType: 'text/plain' }
      ]
    });
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('✅ Correctly rejected mixed file types');
    }
  }
}

// Test Gemini service enhancements
async function testGeminiEnhancements() {
  console.log('\n🧪 Testing Gemini Service Enhancements\n');

  try {
    const GeminiService = require('../services/geminiService.js');
    require('dotenv').config();

    const service = new GeminiService();
    console.log('✅ GeminiService with enhancements instantiated');

    // Test fallback data with new fields
    const fallbackData = service.generateFallbackData();
    console.log('✅ Enhanced fallback data generated');
    console.log('   Shopify Collections:', fallbackData.shopifyCollections);
    console.log('   Variants Keys:', Object.keys(fallbackData.variants));
    console.log('   Image Quality Keys:', Object.keys(fallbackData.imageQuality));

    console.log('🎉 Gemini enhancements test completed!');

  } catch (error) {
    console.error('❌ Gemini enhancement test failed:', error.message);
  }
}

// Run tests
if (require.main === module) {
  testMultipleImageAnalysis()
    .then(() => testMultiImageErrorCases())
    .then(() => testGeminiEnhancements())
    .catch(console.error);
}

module.exports = {
  testMultipleImageAnalysis,
  testMultiImageErrorCases,
  testGeminiEnhancements
};