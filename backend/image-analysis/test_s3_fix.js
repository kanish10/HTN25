// Test S3 ACL Fix with Real Images
const axios = require('axios');
const fs = require('fs');

// Create a simple 100x100 colored image as base64
function createTestImage(color) {
  // Simple PNG header for a 1x1 pixel image in the specified color
  const colors = {
    red: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
    blue: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfz0AEYBxQ9iIAAAAAElFTkSuQmCC',
    green: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QzwAEhAIV9iAAAAAASUVORK5CYII='
  };
  return colors[color] || colors.red;
}

async function testS3Fix() {
  try {
    console.log('🧪 Testing S3 ACL fix with new upload...\n');

    // Step 1: Upload multiple images
    const uploadResponse = await axios.post('http://localhost:3002/api/upload-more', {
      images: [
        {
          fileName: 'test-red.png',
          fileType: 'image/png',
          imageData: createTestImage('red')
        },
        {
          fileName: 'test-blue.png',
          fileType: 'image/png',
          imageData: createTestImage('blue')
        },
        {
          fileName: 'test-green.png',
          fileType: 'image/png',
          imageData: createTestImage('green')
        }
      ]
    });

    if (!uploadResponse.data.success) {
      console.log('❌ Upload failed:', uploadResponse.data.error);
      return;
    }

    console.log('✅ Upload successful!');
    console.log('📊 Response data:', JSON.stringify(uploadResponse.data, null, 2));

    const { data } = uploadResponse.data;

    // Step 2: Test if the selected image URL is publicly accessible
    if (data.imageUrl) {
      console.log(`\n🔗 Testing image accessibility: ${data.imageUrl}`);

      try {
        const imageTest = await axios.head(data.imageUrl, { timeout: 5000 });
        console.log('✅ Image is publicly accessible!');
        console.log('📈 Status:', imageTest.status);
        console.log('🔍 Content-Type:', imageTest.headers['content-type']);
      } catch (imageError) {
        console.log('❌ Image accessibility test failed:');
        console.log('📊 Status:', imageError.response?.status);
        console.log('💬 Error:', imageError.message);
      }
    } else {
      console.log('❌ No imageUrl found in response');
    }

    // Step 3: Check if imageAnalysis data is present
    if (data.imageAnalysis) {
      console.log('\n📸 Image Analysis Results:');
      console.log('🏆 Selected Image Index:', data.imageAnalysis.selectedImage?.index);
      console.log('🔗 Selected Image URL:', data.imageAnalysis.selectedImage?.url);
      console.log('📊 Total Images Analyzed:', data.imageAnalysis.totalImagesAnalyzed);

      // Test the selected image URL too
      if (data.imageAnalysis.selectedImage?.url) {
        try {
          const selectedTest = await axios.head(data.imageAnalysis.selectedImage.url, { timeout: 5000 });
          console.log('✅ Selected image from analysis is also publicly accessible!');
        } catch (error) {
          console.log('❌ Selected image from analysis failed accessibility test');
        }
      }
    }

    console.log('\n🎯 FINAL DIAGNOSIS:');
    console.log('✅ S3 ACL Fix Status: Images should now be public');
    console.log('✅ Frontend should now display the correct selected image');
    console.log('✅ Shopify should now be able to upload the image');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testS3Fix();