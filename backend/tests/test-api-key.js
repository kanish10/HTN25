const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

async function testGeminiAPIKey() {
  console.log('🔑 Testing Gemini API Key\n');
  
  const apiKey = process.env.GEMINI_API_KEY;
  
  console.log('API Key from env:', apiKey ? '✅ Found' : '❌ Missing');
  console.log('API Key length:', apiKey ? apiKey.length : 0);
  console.log('API Key starts with:', apiKey ? apiKey.substring(0, 10) + '...' : 'N/A');
  console.log('API Key has quotes:', apiKey ? (apiKey.includes('"') ? '⚠️  Yes (remove quotes)' : '✅ No') : 'N/A');
  
  if (!apiKey) {
    console.log('❌ No API key found in environment');
    return;
  }
  
  // Clean the API key (remove quotes if present)
  const cleanApiKey = apiKey.replace(/"/g, '');
  console.log('Cleaned API Key length:', cleanApiKey.length);
  
  try {
    console.log('\n🧪 Testing API key with simple text request...');
    
    const genAI = new GoogleGenerativeAI(cleanApiKey);
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL });
    
    const result = await model.generateContent('Hello, can you respond with just "API key works"?');
    const response = await result.response;
    const text = response.text();
    
    console.log('✅ API Key is valid!');
    console.log('Response:', text.trim());
    
    return true;
    
  } catch (error) {
    console.log('❌ API Key test failed:');
    console.log('Error:', error.message);
    
    if (error.message.includes('API key not valid')) {
      console.log('\n💡 Possible solutions:');
      console.log('1. Check if the API key is correct');
      console.log('2. Ensure the key has Gemini API access enabled');
      console.log('3. Check if you have quota/billing enabled');
      console.log('4. Try generating a new API key');
      console.log('5. Remove quotes from the API key in .env file');
    }
    
    return false;
  }
}

async function testImageAnalysis() {
  console.log('\n🖼️  Testing Image Analysis (if API key works)...');
  
  const apiKey = process.env.GEMINI_API_KEY?.replace(/"/g, '');
  
  if (!apiKey) {
    console.log('❌ No API key available');
    return;
  }
  
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL });
    
    // Create a simple test image (1x1 red pixel)
    const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
    
    const imagePart = {
      inlineData: {
        data: testImageBase64,
        mimeType: 'image/png'
      }
    };
    
    const prompt = 'What do you see in this image? Respond in one sentence.';
    
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();
    
    console.log('✅ Image analysis works!');
    console.log('Response:', text.trim());
    
  } catch (error) {
    console.log('❌ Image analysis failed:');
    console.log('Error:', error.message);
  }
}

// Run tests
if (require.main === module) {
  testGeminiAPIKey()
    .then(async (success) => {
      if (success) {
        await testImageAnalysis();
      }
    })
    .catch(console.error);
}

module.exports = { testGeminiAPIKey, testImageAnalysis };