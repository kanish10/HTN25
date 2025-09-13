// ULTRATHINK DEBUG: Test exact API response structure
const axios = require('axios');
const fs = require('fs');

async function debugUploadMore() {
  try {
    console.log('🧠 ULTRATHINK DEBUG: Testing /upload-more response structure\n');

    // Create test images (mock base64 data)
    const mockImages = [
      {
        fileName: 'test1.jpg',
        fileType: 'image/jpeg',
        imageData: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==' // 1x1 pixel
      },
      {
        fileName: 'test2.jpg',
        fileType: 'image/jpeg',
        imageData: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
      },
      {
        fileName: 'test3.jpg',
        fileType: 'image/jpeg',
        imageData: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
      }
    ];

    console.log('📤 Sending request to /upload-more...');
    const response = await axios.post('http://localhost:3002/api/upload-more', {
      images: mockImages
    });

    console.log('✅ RESPONSE RECEIVED');
    console.log('📊 Response status:', response.status);
    console.log('🔍 Response structure:');
    console.log(JSON.stringify(response.data, null, 2));

    console.log('\n🎯 CRITICAL ANALYSIS:');
    console.log('response.data.success:', response.data.success);
    console.log('response.data.data exists:', !!response.data.data);
    console.log('response.data.data.imageUrl:', response.data.data?.imageUrl);
    console.log('response.data.data.imageAnalysis exists:', !!response.data.data?.imageAnalysis);
    console.log('response.data.data.imageAnalysis?.selectedImage:', response.data.data?.imageAnalysis?.selectedImage);

    // Test what frontend would receive
    if (response.data.success) {
      const payload = response.data.data;
      console.log('\n🔧 FRONTEND SIMULATION:');
      const selectedImageUrl = payload.imageUrl || payload.imageAnalysis?.selectedImage?.url;
      const selectedImageIndex = payload.imageAnalysis?.selectedImage?.index || 0;

      console.log('payload.imageUrl:', payload.imageUrl);
      console.log('payload.imageAnalysis?.selectedImage?.url:', payload.imageAnalysis?.selectedImage?.url);
      console.log('selectedImageUrl (final):', selectedImageUrl);
      console.log('selectedImageIndex:', selectedImageIndex);

      console.log('\n🎯 FRONTEND WOULD USE IMAGE:', selectedImageUrl);
    }

  } catch (error) {
    console.error('❌ ULTRATHINK DEBUG FAILED:', error.response?.data || error.message);
  }
}

debugUploadMore();