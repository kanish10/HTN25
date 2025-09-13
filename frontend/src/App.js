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