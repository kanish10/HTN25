ShopBrain: AI-Powered Product Listing & Shipping Optimization🎯 Project OverviewShopBrain transforms a single product image into a complete Shopify listing with optimized shipping calculations in under 30 seconds.What We're Building

User uploads product image
AI extracts product specifications and dimensions
Generates SEO-optimized content using multiple LLMs
Calculates optimal shipping box configuration
Publishes complete listing to Shopify
Key Features

Image Analysis: Gemini Vision extracts product details
Smart Content Generation: Martian routes to optimal LLMs for each content type
Shipping Optimization: Custom bin-packing algorithm saves 20-40% on shipping
A/B Testing: Generate multiple title/description variants
One-Click Publishing: Direct to Shopify with all metadata
🏗️ Technical ArchitectureTech Stack

Frontend: React + Vite
Backend: Node.js + Express
Storage: AWS S3 (images) + DynamoDB (metadata)
AI: Gemini Vision + Martian Router + Multiple LLMs
Deployment: Cloudflare Workers/Pages
E-commerce: Shopify Admin API
API Flow
1. POST /api/upload → S3 presigned URL → Store image
2. POST /api/analyze → Gemini Vision → Extract specs → Generate content → Calculate shipping → Publish


import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function App() {
  const [products, setProducts] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState({});

  // Handle file upload
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);
    
    try {
      // Step 1: Get presigned URL
      const { data } = await axios.post(`${API_URL}/api/upload`, {
        fileName: file.name,
        fileType: file.type
      });

      // Step 2: Upload to S3
      await axios.put(data.uploadUrl, file, {
        headers: {
          'Content-Type': file.type
        }
      });

      // Step 3: Start analysis
      setAnalyzing(prev => ({ ...prev, [data.productId]: 'analyzing' }));
      
      const analysisResult = await axios.post(`${API_URL}/api/analyze/${data.productId}`);
      
      // Add to products list
      setProducts(prev => [...prev, analysisResult.data]);
      setAnalyzing(prev => ({ ...prev, [data.productId]: 'complete' }));
      
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // Publish to Shopify
  const handlePublish = async (productId) => {
    try {
      setAnalyzing(prev => ({ ...prev, [productId]: 'publishing' }));
      
      const { data } = await axios.post(`${API_URL}/api/publish/${productId}`);
      
      // Update product status
      setProducts(prev => prev.map(p => 
        p.productId === productId 
          ? { ...p, shopifyUrl: data.productUrl, status: 'published' }
          : p
      ));
      
      setAnalyzing(prev => ({ ...prev, [productId]: 'published' }));
      
    } catch (error) {
      console.error('Publish failed:', error);
      alert('Publishing failed. Please try again.');
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>🧠 ShopBrain</h1>
        <p>AI-Powered Product Listings & Shipping Optimization</p>
      </header>

      <div className="upload-section">
        <label className="upload-button">
          {uploading ? 'Uploading...' : 'Upload Product Image'}
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            disabled={uploading}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      <div className="products-grid">
        {products.map(product => (
          <ProductCard
            key={product.productId}
            product={product}
            status={analyzing[product.productId]}
            onPublish={() => handlePublish(product.productId)}
          />
        ))}
      </div>
    </div>
  );
}

function ProductCard({ product, status, onPublish }) {
  const { extractedData, generatedContent, shippingData } = product;

  return (
    <div className="product-card">
      <div className="status-badge">{status || 'ready'}</div>
      
      {extractedData && (
        <>
          <h3>{generatedContent.title}</h3>
          <p className="price">${extractedData.suggestedPrice.min} - ${extractedData.suggestedPrice.max}</p>
          
          <div className="details">
            <div className="spec">
              <strong>Type:</strong> {extractedData.productType}
            </div>
            <div className="spec">
              <strong>Material:</strong> {extractedData.material}
            </div>
            <div className="spec">
              <strong>Dimensions:</strong> {extractedData.dimensions.length}" × {extractedData.dimensions.width}" × {extractedData.dimensions.height}"
            </div>
          </div>

          <div className="shipping-info">
            <h4>📦 Shipping Optimization</h4>
            <p>Recommended: {shippingData.singleItem.recommendedBox}</p>
            <p>Cost: ${shippingData.singleItem.shippingCost}</p>
            <p className="savings">💰 {shippingData.savings.description}</p>
          </div>

          <div className="ai-costs">
            <strong>AI Processing Cost:</strong> ${generatedContent.aiCosts.total.toFixed(2)}
          </div>

          {status !== 'published' && status !== 'publishing' && (
            <button 
              className="publish-button"
              onClick={onPublish}
              disabled={status === 'publishing'}
            >
              {status === 'publishing' ? 'Publishing...' : 'Publish to Shopify'}
            </button>
          )}

          {product.shopifyUrl && (
            <a href={product.shopifyUrl} target="_blank" rel="noopener noreferrer" className="view-link">
              View in Shopify →
            </a>
          )}
        </>
      )}
    </div>
  );
}

export default App;





import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function App() {
  const [products, setProducts] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState({});

  // Handle file upload
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);
    
    try {
      // Step 1: Get presigned URL
      const { data } = await axios.post(`${API_URL}/api/upload`, {
        fileName: file.name,
        fileType: file.type
      });

      // Step 2: Upload to S3
      await axios.put(data.uploadUrl, file, {
        headers: {
          'Content-Type': file.type
        }
      });

      // Step 3: Start analysis
      setAnalyzing(prev => ({ ...prev, [data.productId]: 'analyzing' }));
      
      const analysisResult = await axios.post(`${API_URL}/api/analyze/${data.productId}`);
      
      // Add to products list
      setProducts(prev => [...prev, analysisResult.data]);
      setAnalyzing(prev => ({ ...prev, [data.productId]: 'complete' }));
      
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // Publish to Shopify
  const handlePublish = async (productId) => {
    try {
      setAnalyzing(prev => ({ ...prev, [productId]: 'publishing' }));
      
      const { data } = await axios.post(`${API_URL}/api/publish/${productId}`);
      
      // Update product status
      setProducts(prev => prev.map(p => 
        p.productId === productId 
          ? { ...p, shopifyUrl: data.productUrl, status: 'published' }
          : p
      ));
      
      setAnalyzing(prev => ({ ...prev, [productId]: 'published' }));
      
    } catch (error) {
      console.error('Publish failed:', error);
      alert('Publishing failed. Please try again.');
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>🧠 ShopBrain</h1>
        <p>AI-Powered Product Listings & Shipping Optimization</p>
      </header>

      <div className="upload-section">
        <label className="upload-button">
          {uploading ? 'Uploading...' : 'Upload Product Image'}
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            disabled={uploading}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      <div className="products-grid">
        {products.map(product => (
          <ProductCard
            key={product.productId}
            product={product}
            status={analyzing[product.productId]}
            onPublish={() => handlePublish(product.productId)}
          />
        ))}
      </div>
    </div>
  );
}

function ProductCard({ product, status, onPublish }) {
  const { extractedData, generatedContent, shippingData } = product;

  return (
    <div className="product-card">
      <div className="status-badge">{status || 'ready'}</div>
      
      {extractedData && (
        <>
          <h3>{generatedContent.title}</h3>
          <p className="price">${extractedData.suggestedPrice.min} - ${extractedData.suggestedPrice.max}</p>
          
          <div className="details">
            <div className="spec">
              <strong>Type:</strong> {extractedData.productType}
            </div>
            <div className="spec">
              <strong>Material:</strong> {extractedData.material}
            </div>
            <div className="spec">
              <strong>Dimensions:</strong> {extractedData.dimensions.length}" × {extractedData.dimensions.width}" × {extractedData.dimensions.height}"
            </div>
          </div>

          <div className="shipping-info">
            <h4>📦 Shipping Optimization</h4>
            <p>Recommended: {shippingData.singleItem.recommendedBox}</p>
            <p>Cost: ${shippingData.singleItem.shippingCost}</p>
            <p className="savings">💰 {shippingData.savings.description}</p>
          </div>

          <div className="ai-costs">
            <strong>AI Processing Cost:</strong> ${generatedContent.aiCosts.total.toFixed(2)}
          </div>

          {status !== 'published' && status !== 'publishing' && (
            <button 
              className="publish-button"
              onClick={onPublish}
              disabled={status === 'publishing'}
            >
              {status === 'publishing' ? 'Publishing...' : 'Publish to Shopify'}
            </button>
          )}

          {product.shopifyUrl && (
            <a href={product.shopifyUrl} target="_blank" rel="noopener noreferrer" className="view-link">
              View in Shopify →
            </a>
          )}
        </>
      )}
    </div>
  );
}

export default App;


# AWS
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key

# AI Services
GEMINI_API_KEY=your_gemini_api_key
MARTIAN_API_KEY=your_martian_api_key

# Shopify
SHOPIFY_SHOP_NAME=your-shop-name
SHOPIFY_ACCESS_TOKEN=your_shopify_access_token

# Server
PORT=3001




// Table Name: ShopBrainProducts
// Partition Key: productId (String)

{
  productId: "prod_1234567890_abc123",
  createdAt: "2025-01-18T10:30:00Z",
  status: "published", // uploaded | analyzing | ready_to_publish | published
  imageUrl: "https://shopbrain-images.s3.amazonaws.com/products/...",
  
  extractedData: {
    productType: "tote bag",
    category: "Bags",
    dimensions: { length: 14, width: 4, height: 16 },
    estimatedWeight: 0.8,
    material: "canvas",
    color: "beige",
    features: ["zipper closure", "interior pocket"],
    suggestedName: "Canvas Tote Bag",
    targetAudience: "eco-conscious shoppers",
    suggestedPrice: { min: 25, max: 35 }
  },
  
  generatedContent: {
    title: "Eco-Friendly Canvas Tote Bag with Zipper",
    description: "...",
    bulletPoints: ["...", "..."],
    seoTags: ["canvas", "tote", "eco-friendly"],
    faq: [{question: "...", answer: "..."}],
    abVariants: {
      titleA: "...",
      titleB: "..."
    },
    aiCosts: {
      breakdown: [...],
      total: 0.12
    }
  },
  
  shippingData: {
    singleItem: {
      recommendedBox: "Medium Box",
      boxId: "medium",
      utilization: "78.5",
      shippingCost: 6.50
    },
    bulkOrders: [...],
    savings: {
      vsDefaultBox: "27.8",
      description: "Save 27.8% vs standard shipping"
    }
  },
  
  shopifyProductId: "7234567890",
  publishedAt: "2025-01-18T10:35:00Z"
}


{
  "name": "shopbrain-backend",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "aws-sdk": "^2.1400.0",
    "@google/generative-ai": "^0.1.0",
    "shopify-api-node": "^3.12.6",
    "martian-sdk": "^1.0.0",
    "multer": "^1.4.5-lts.1",
    "cors": "^2.8.5",
    "dotenv": "^16.0.3"
  },
  "devDependencies": {
    "nodemon": "^2.0.22"
  }
}


.app {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.app-header {
  text-align: center;
  margin-bottom: 40px;
}

.app-header h1 {
  font-size: 2.5em;
  margin-bottom: 10px;
}

.upload-section {
  text-align: center;
  margin-bottom: 40px;
}

.upload-button {
  display: inline-block;
  padding: 12px 24px;
  background: #5c6ac4;
  color: white;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: background 0.2s;
}

.upload-button:hover {
  background: #4451b7;
}

.products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 20px;
}

.product-card {
  background: white;
  border: 1px solid #e1e1e1;
  border-radius: 12px;
  padding: 20px;
  position: relative;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.status-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  background: #f0f0f0;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.85em;
  text-transform: capitalize;
}

.product-card h3 {
  margin: 0 0 10px 0;
  font-size: 1.2em;
}

.price {
  color: #5c6ac4;
  font-size: 1.1em;
  font-weight: 600;
  margin-bottom: 15px;
}

.details {
  background: #f8f8f8;
  padding: 10px;
  border-radius: 6px;
  margin-