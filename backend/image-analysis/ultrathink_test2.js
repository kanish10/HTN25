// ULTRATHINK Part 2: Test exact response format
const DataFormatter = require('./utils/dataFormatter');

// Simulate exact data structure
const mockDynamoData = {
  productId: 'test-123',
  imageUrl: 'https://shopbrain-images.s3.amazonaws.com/products/test-image.png',
  extractedData: { productType: 'Test' },
  generatedContent: { title: 'Test Product' },
  shippingData: { singleItem: { recommendedBox: 'Small Box' } },
  createdAt: '2025-01-01T00:00:00.000Z'
};

const mockBestAnalysis = {
  selectedImageUrl: 'https://shopbrain-images.s3.amazonaws.com/products/test-image.png',
  selectedIndex: 2,
  totalImagesAnalyzed: 5,
  allAnalyses: [
    { index: 0, fileName: 'img1.png', score: 85 },
    { index: 1, fileName: 'img2.png', score: 87 },
    { index: 2, fileName: 'img3.png', score: 92 },
    { index: 3, fileName: 'img4.png', score: 88 },
    { index: 4, fileName: 'img5.png', score: 89 }
  ]
};

console.log('🧠 ULTRATHINK Part 2: Testing DataFormatter response structure\n');

const response = DataFormatter.createAnalysisResponse(mockDynamoData, mockBestAnalysis);

console.log('📊 FULL RESPONSE STRUCTURE:');
console.log(JSON.stringify(response, null, 2));

console.log('\n🎯 CRITICAL ANALYSIS:');
console.log('response.success:', response.success);
console.log('response.data exists:', !!response.data);
console.log('response.data.imageUrl:', response.data.imageUrl);
console.log('response.data.imageAnalysis exists:', !!response.data.imageAnalysis);

if (response.data.imageAnalysis) {
  console.log('response.data.imageAnalysis.selectedImage:', response.data.imageAnalysis.selectedImage);
  console.log('response.data.imageAnalysis.selectedImage.url:', response.data.imageAnalysis.selectedImage.url);
  console.log('response.data.imageAnalysis.selectedImage.index:', response.data.imageAnalysis.selectedImage.index);
}

// Test frontend logic simulation
console.log('\n🔧 FRONTEND LOGIC SIMULATION:');
if (response.success) {
  const payload = response.data;

  console.log('payload.imageUrl:', payload.imageUrl);
  console.log('payload.imageAnalysis?.selectedImage?.url:', payload.imageAnalysis?.selectedImage?.url);

  const selectedImageUrl = payload.imageUrl || payload.imageAnalysis?.selectedImage?.url;
  const selectedImageIndex = payload.imageAnalysis?.selectedImage?.index || 0;

  console.log('🎯 FINAL FRONTEND RESULTS:');
  console.log('selectedImageUrl:', selectedImageUrl);
  console.log('selectedImageIndex:', selectedImageIndex);
  console.log('imageToDisplay would be:', selectedImageUrl || '[fallback to local preview]');
}

console.log('\n🔍 DIAGNOSIS:');
if (response.data.imageUrl) {
  console.log('✅ imageUrl is present in response.data');
} else {
  console.log('❌ imageUrl is MISSING from response.data');
}

if (response.data.imageAnalysis?.selectedImage?.url) {
  console.log('✅ imageAnalysis.selectedImage.url is present');
} else {
  console.log('❌ imageAnalysis.selectedImage.url is MISSING');
}

if (response.data.imageUrl || response.data.imageAnalysis?.selectedImage?.url) {
  console.log('✅ Frontend SHOULD show correct image');
} else {
  console.log('❌ Frontend will fall back to local preview - THIS IS THE BUG!');
}