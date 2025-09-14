import React, { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Upload, Wand2, Box, Zap, CheckCircle, ExternalLink,
  AlertCircle, ChevronDown, ChevronUp, Package, Tag, DollarSign, Truck,
  LogIn, LogOut, User, Calculator, X, Eye, Monitor, Maximize2
} from "lucide-react";
import axios from "axios";
import ShippingCalculator from "./ShippingCalculator";
import ShippingOptimizer from "./ShippingOptimizer";
import { login, logout, isAuthenticated, getUser, verifyToken } from "./auth";
import "./App.css"; // keep your current CSS

// ========= Config =========
const API_URL = "http://localhost:3002";

// ========= Image Loading Utilities =========
const ImageWithFallback = ({ src, alt, className, style, onError, ...props }) => {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [hasError, setHasError] = useState(false);

  // Reset when src changes
  useEffect(() => {
    setCurrentSrc(src);
    setHasError(false);
  }, [src]);

  const handleError = (e) => {
    if (!hasError && src && src.includes('s3.')) {
      // If S3 direct access fails, try backend proxy
      const s3Key = extractS3KeyFromUrl(src);
      if (s3Key) {
        const proxyUrl = `${API_URL}/api/images/s3/${s3Key}`;
        console.log(`🔄 S3 direct access failed, trying proxy: ${proxyUrl}`);
        setCurrentSrc(proxyUrl);
        setHasError(true);
        return;
      }
    }
    
    // Call original onError if provided
    if (onError) {
      onError(e);
    }
  };

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      style={style}
      onError={handleError}
      {...props}
    />
  );
};

// Extract S3 key from S3 URL
const extractS3KeyFromUrl = (url) => {
  if (!url || !url.includes('s3.')) return null;
  
  try {
    // Handle both formats:
    // https://bucket.s3.region.amazonaws.com/key
    // https://s3.region.amazonaws.com/bucket/key
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(part => part);
    
    if (urlObj.hostname.includes('.s3.')) {
      // Format: https://bucket.s3.region.amazonaws.com/key
      return pathParts.join('/');
    } else if (urlObj.hostname.startsWith('s3.')) {
      // Format: https://s3.region.amazonaws.com/bucket/key
      return pathParts.slice(1).join('/'); // Skip bucket name
    }
    
    return null;
  } catch (error) {
    console.warn('Failed to extract S3 key from URL:', url, error);
    return null;
  }
};

// ========= Local storage for uploads =========
const UPLOADS_KEY = "sb_uploads";

const getUploads = () => {
  try { return JSON.parse(localStorage.getItem(UPLOADS_KEY) || "[]"); } catch { return []; }
};
const addUpload = (item) => {
  const arr = getUploads();
  arr.unshift(item);
  localStorage.setItem(UPLOADS_KEY, JSON.stringify(arr.slice(0, 50)));
};

// ========= AI AGENT COMPONENTS =========

// AI Agent Wrapper Component
const AIAgentWrapper = ({ children, isActive, className = "", ...props }) => {
  return (
    <div className={`ai-agent-wrapper ${isActive ? 'active' : ''} ${className}`} {...props}>
      {children}
    </div>
  );
};

// AI Status Messages Component
const AIStatusMessage = ({ message, submessage, type = "processing", icon: Icon }) => {
  const [displayedMessage, setDisplayedMessage] = useState("");
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    if (type === "processing" && message) {
      setDisplayedMessage("");
      setMessageIndex(0);

      const timer = setInterval(() => {
        setMessageIndex((prevIndex) => {
          if (prevIndex < message.length) {
            setDisplayedMessage(message.slice(0, prevIndex + 1));
            return prevIndex + 1;
          } else {
            clearInterval(timer);
            return prevIndex;
          }
        });
      }, 50);

      return () => clearInterval(timer);
    } else {
      setDisplayedMessage(message);
    }
  }, [message, type]);

  return (
    <div className="ai-status-container">
      <div className="ai-status-message">
        <div className={`ai-status-icon ${type}`}>
          {Icon ? <Icon size={14} /> : <Wand2 size={14} />}
        </div>
        <span className={type === "processing" ? "typing-effect" : ""}>
          {displayedMessage}
        </span>
      </div>
      {submessage && (
        <div className="ai-status-submessage">
          {submessage}
        </div>
      )}
    </div>
  );
};

// AI Progress Steps Component
const AIProgressSteps = ({ steps, currentStep }) => {
  return (
    <div className="ai-progress-steps">
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isActive = index === currentStep;

        return (
          <div
            key={index}
            className={`ai-progress-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
          >
            <div className="ai-progress-indicator">
              {isCompleted ? <CheckCircle size={16} /> : index + 1}
            </div>
            <div className="ai-progress-content">
              <div className="ai-progress-title">{step.title}</div>
              <div className="ai-progress-description">{step.description}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Embedded Shopify Preview Component
const EmbeddedShopifyPreview = ({
  isOpen,
  onClose,
  productData,
  onPublish,
  publishStatus,
  publishResult,
  autoScroll = true
}) => {
  const [currentHighlight, setCurrentHighlight] = useState(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const mockShopifyFields = [
    { id: 'title', label: 'Product Title', value: productData?.generatedContent?.title || 'Loading...', delay: 1000 },
    { id: 'description', label: 'Description', value: productData?.generatedContent?.description || 'Loading...', delay: 2000 },
    { id: 'price', label: 'Price', value: productData?.extractedData?.suggestedPrice ? `$${productData.extractedData.suggestedPrice.min} - $${productData.extractedData.suggestedPrice.max}` : 'Loading...', delay: 3000 },
    { id: 'tags', label: 'SEO Tags', value: productData?.generatedContent?.seoTags?.join(', ') || 'Loading...', delay: 4000 },
    { id: 'shipping', label: 'Shipping', value: productData?.shippingData?.singleItem?.recommendedBox || 'Loading...', delay: 5000 }
  ];

  // Auto-scroll simulation
  useEffect(() => {
    if (!isOpen || !autoScroll || isHovered) return;

    let currentIndex = 0;
    const scrollInterval = setInterval(() => {
      if (currentIndex < mockShopifyFields.length && !isHovered) {
        setCurrentHighlight(mockShopifyFields[currentIndex].id);
        setScrollProgress((currentIndex + 1) / mockShopifyFields.length * 100);
        currentIndex++;
      } else if (currentIndex >= mockShopifyFields.length) {
        clearInterval(scrollInterval);
        setCurrentHighlight(null);
      }
    }, 1500);

    return () => clearInterval(scrollInterval);
  }, [isOpen, autoScroll, isHovered, mockShopifyFields.length]);

  if (!isOpen) return null;

  return (
    <motion.div
      className="embedded-preview-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="embedded-preview-container">
        <div className="embedded-preview-header">
          <div className="embedded-preview-title">
            <Monitor size={20} />
            Shopify Product Preview
          </div>
          <div className="embedded-preview-controls">
            <button className="btn ai-secondary" onClick={() => window.open('#', '_blank')}>
              <Maximize2 size={14} />
              Open in New Tab
            </button>
            <button className="btn" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="embedded-preview-content">
          <div className="embedded-preview-sidebar">
            <h3 style={{ marginTop: 0, color: '#065f46' }}>Auto-Populate Progress</h3>
            <div style={{ marginBottom: '20px' }}>
              <div className="progress-bar-container">
                <div
                  className="progress-bar"
                  style={{ width: `${scrollProgress}%`, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
                ></div>
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
                {Math.round(scrollProgress)}% Complete
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {mockShopifyFields.map((field) => (
                <div
                  key={field.id}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    border: currentHighlight === field.id
                      ? '2px solid #10b981'
                      : '1px solid #e5e7eb',
                    background: currentHighlight === field.id
                      ? 'rgba(16, 185, 129, 0.1)'
                      : 'white',
                    transition: 'all 0.5s ease'
                  }}
                >
                  <div style={{ fontWeight: '600', fontSize: '13px', color: '#374151', marginBottom: '4px' }}>
                    {field.label}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    {field.value}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #e5e7eb' }}>
              {publishStatus === 'success' ? (
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
                    padding: '16px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    border: '1px solid #22c55e'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
                      <CheckCircle size={20} color="#22c55e" />
                      <span style={{ fontWeight: '600', color: '#15803d' }}>Successfully Published!</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '13px', color: '#166534' }}>
                      Your product is now in Shopify as a draft
                    </p>
                  </div>
                  <a
                    className="btn ai-primary"
                    style={{
                      width: '100%',
                      background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                      border: 'none',
                      color: 'white'
                    }}
                    href={publishResult?.productUrl || `https://shopify.com/admin/products`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink size={16} />
                    Go to Shopify & Edit
                  </a>
                </div>
              ) : (
                <button
                  className={`btn ai-primary`}
                  style={{ width: '100%' }}
                  onClick={onPublish}
                  disabled={publishStatus === 'publishing'}
                >
                  {publishStatus === 'publishing' ? (
                    <>
                      <div className="ai-loading-dots">
                        <div className="ai-loading-dot"></div>
                        <div className="ai-loading-dot"></div>
                        <div className="ai-loading-dot"></div>
                      </div>
                      Publishing...
                    </>
                  ) : (
                    <>
                      <Zap size={16} />
                      Publish to Shopify
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          <div
            className="embedded-preview-main"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            {/* Mock Shopify Interface */}
            <div style={{
              padding: '40px',
              minHeight: '100%',
              overflow: 'auto',
              background: '#f8fafc',
              position: 'relative'
            }}>
              <div style={{
                maxWidth: '800px',
                margin: '0 auto',
                background: 'white',
                borderRadius: '12px',
                padding: '32px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                minHeight: '600px'
              }}>
                <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '24px', color: '#1f2937' }}>
                  Create Product
                </h1>

                {mockShopifyFields.map((field) => (
                  <div
                    key={field.id}
                    style={{
                      marginBottom: '24px',
                      position: 'relative'
                    }}
                  >
                    {currentHighlight === field.id && (
                      <div
                        className="scroll-highlight-overlay active"
                        style={{
                          position: 'absolute',
                          inset: '-8px',
                          zIndex: 5
                        }}
                      />
                    )}
                    <label style={{
                      display: 'block',
                      fontWeight: '600',
                      marginBottom: '8px',
                      color: '#374151',
                      fontSize: '14px'
                    }}>
                      {field.label}
                    </label>
                    {field.id === 'description' ? (
                      <textarea
                        style={{
                          width: '100%',
                          minHeight: '120px',
                          padding: '12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '14px',
                          background: currentHighlight === field.id ? 'rgba(16, 185, 129, 0.05)' : 'white',
                          transition: 'background-color 0.5s ease'
                        }}
                        value={field.value}
                        readOnly
                      />
                    ) : (
                      <input
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '14px',
                          background: currentHighlight === field.id ? 'rgba(16, 185, 129, 0.05)' : 'white',
                          transition: 'background-color 0.5s ease'
                        }}
                        value={field.value}
                        readOnly
                      />
                    )}
                  </div>
                ))}

                <div style={{
                  marginTop: '32px',
                  padding: '20px',
                  background: '#f0fdf4',
                  borderRadius: '8px',
                  border: '1px solid #bbf7d0'
                }}>
                  <div style={{ fontSize: '14px', color: '#065f46', fontWeight: '600', marginBottom: '8px' }}>
                    ✨ AI Generated Content Ready!
                  </div>
                  <div style={{ fontSize: '13px', color: '#047857', lineHeight: '1.5' }}>
                    Your product listing has been automatically populated with AI-generated content.
                    Review the fields above and click "Save" when ready to publish.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ========= Analysis Results (enhanced with embedded preview) =========
const AnalysisResults = ({ result, processingTime }) => {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [publishStatus, setPublishStatus] = useState("idle"); // idle | publishing | success | error
  const [publishError, setPublishError] = useState(null);
  const [publishResult, setPublishResult] = useState(null);
  const [showEmbeddedPreview, setShowEmbeddedPreview] = useState(false);

  const tabs = [
    { id: "overview", label: "Overview", icon: Package },
    { id: "content", label: "Content", icon: Tag },
    { id: "shipping", label: "Shipping", icon: Truck },
    { id: "pricing", label: "Pricing", icon: DollarSign }
  ];

  const handlePublishToShopify = async () => {
    setPublishStatus("publishing");
    setPublishError(null);

    try {
      const response = await axios.post(`${API_URL}/api/publish/${result.productId || 'temp-id'}`, {
        extractedData: result.extractedData,
        generatedContent: result.generatedContent,
        shippingData: result.shippingData,
        imageUrl: result.imageUrl
      });

      if (response.data.success) {
        setPublishResult(response.data.data);
        setPublishStatus("success");

        // Update localStorage with published status
        const uploads = getUploads();
        const updatedUploads = uploads.map(upload => {
          if (upload.title === result.generatedContent.title) {
            return { ...upload, shopifyHandle: response.data.data.shopifyProductId };
          }
          return upload;
        });
        localStorage.setItem(UPLOADS_KEY, JSON.stringify(updatedUploads));
      } else {
        throw new Error(response.data.message || 'Publishing failed');
      }
    } catch (error) {
      console.error('Publish error:', error);
      setPublishStatus("error");
      if (error.response?.data?.message) {
        setPublishError(error.response.data.message);
      } else if (error.message?.includes('not configured')) {
        setPublishError('Shopify not configured. Please check your SHOPIFY_SHOP_NAME and SHOPIFY_ACCESS_TOKEN environment variables.');
      } else {
        setPublishError(error.message || 'Failed to publish to Shopify');
      }
    }
  };

  return (
    <div className="result">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p className="result-title">
          Analysis Complete {processingTime > 0 && (
            <span style={{ fontWeight: 'normal', color: '#6b7280' }}>
              ({(processingTime/1000).toFixed(1)}s)
            </span>
          )}
        </p>
        <button className="btn" onClick={() => setExpanded(!expanded)} style={{ padding: '4px 8px', fontSize: '12px' }}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          {expanded ? 'Less' : 'More'}
        </button>
      </div>

      <ul className="bullets">
        <li><strong>Product:</strong> {result.extractedData.productType} ({result.extractedData.material})</li>
        <li><strong>Title:</strong> {result.generatedContent.title}</li>
        <li><strong>Price:</strong> ${result.extractedData.suggestedPrice.min} - ${result.extractedData.suggestedPrice.max}</li>
        <li><strong>Shipping:</strong> {result.shippingData.singleItem.recommendedBox} (${result.shippingData.singleItem.shippingCost})</li>
      </ul>

      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}
        >
          <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', borderBottom: '1px solid var(--border)' }}>
            {tabs.map(tab => {
              const IconComponent = tab.icon;
              return (
                <button
                  key={tab.id}
                  className={`link ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    borderBottom: activeTab === tab.id ? '2px solid var(--brand)' : '2px solid transparent',
                    backgroundColor: activeTab === tab.id ? 'var(--bg-weak)' : 'transparent',
                    color: activeTab === tab.id ? 'var(--brand)' : 'var(--text)',
                    borderRadius: '4px 4px 0 0',
                    fontWeight: activeTab === tab.id ? '600' : '400'
                  }}
                >
                  <IconComponent size={14} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div style={{ minHeight: '300px', width: '100%', maxWidth: '100%' }}>
            {activeTab === "overview" && (
              <div style={{ display: 'grid', gap: '12px', width: '100%', maxWidth: '100%', minHeight: '280px' }}>
                {result.imageUrl && (
                  <div className="card" style={{ padding: '12px' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600' }}>Selected Product Image</h4>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                      <ImageWithFallback
                        src={result.imageUrl}
                        alt="Selected product"
                        style={{
                          maxWidth: '300px',
                          maxHeight: '300px',
                          objectFit: 'contain',
                          borderRadius: '8px',
                          border: '2px solid var(--brand)',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                        }}
                      />
                    </div>
                    {result.imageAnalysis?.selectedImage && (
                      <div style={{ textAlign: 'center', fontSize: '12px', color: '#6b7280' }}>
                        Best image selected (#{result.imageAnalysis.selectedImage.index + 1} of {result.imageAnalysis.totalImagesAnalyzed})
                      </div>
                    )}
                  </div>
                )}
                <div className="card" style={{ padding: '12px' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600' }}>Product Details</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '14px' }}>
                    <div><strong>Type:</strong> {result.extractedData.productType}</div>
                    <div><strong>Category:</strong> {result.extractedData.category}</div>
                    <div><strong>Material:</strong> {result.extractedData.material}</div>
                    <div><strong>Color:</strong> {result.extractedData.color}</div>
                    <div><strong>Weight:</strong> {result.extractedData.estimatedWeight} lbs</div>
                    <div><strong>Target:</strong> {result.extractedData.targetAudience}</div>
                  </div>
                </div>
                <div className="card" style={{ padding: '12px' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600' }}>Dimensions</h4>
                  <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--brand)' }}>
                    {result.extractedData.dimensions.length}" × {result.extractedData.dimensions.width}" × {result.extractedData.dimensions.height}"
                  </div>
                </div>
                <div className="card" style={{ padding: '12px' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600' }}>Features</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {result.extractedData.features.map((feature, i) => (
                      <span key={i} className="chip" style={{ fontSize: '12px' }}>{feature}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "content" && (
              <div style={{ display: 'grid', gap: '16px', width: '100%', maxWidth: '100%' }}>
                <div className="card" style={{ padding: '16px' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600' }}>Generated Title</h4>
                  <p style={{ margin: 0, fontWeight: '600', fontSize: '18px', color: 'var(--brand)', lineHeight: '1.3' }}>{result.generatedContent.title}</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="card" style={{ padding: '16px' }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600' }}>Description</h4>
                    <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.6', color: '#374151' }}>{result.generatedContent.description}</p>
                  </div>

                  <div className="card" style={{ padding: '16px' }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600' }}>Key Features</h4>
                    <ul style={{ margin: 0, paddingLeft: '18px', listStyle: 'disc' }}>
                      {result.generatedContent.bulletPoints.slice(0, 4).map((point, i) => (
                        <li key={i} style={{ fontSize: '14px', marginBottom: '6px', lineHeight: '1.4', color: '#374151' }}>{point}</li>
                      ))}
                    </ul>
                    {result.generatedContent.bulletPoints.length > 4 && (
                      <div style={{ marginTop: '8px', fontSize: '12px', color: '#6b7280', fontStyle: 'italic' }}>
                        +{result.generatedContent.bulletPoints.length - 4} more features
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: result.generatedContent.abVariants ? '2fr 1fr' : '1fr', gap: '16px' }}>
                  <div className="card" style={{ padding: '16px' }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600' }}>SEO Tags</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {result.generatedContent.seoTags.map((tag, i) => (
                        <span key={i} className="chip" style={{ fontSize: '12px', background: 'var(--chip)', padding: '4px 8px' }}>{tag}</span>
                      ))}
                    </div>
                  </div>

                  {result.generatedContent.abVariants && (
                    <div className="card" style={{ padding: '16px' }}>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600' }}>A/B Test Variants</h4>
                      <div style={{ display: 'grid', gap: '10px' }}>
                        <div style={{ fontSize: '13px', lineHeight: '1.4' }}>
                          <div style={{ fontWeight: '600', color: '#059669', marginBottom: '2px' }}>Variant A:</div>
                          <div style={{ color: '#374151' }}>{result.generatedContent.abVariants.titleA}</div>
                        </div>
                        <div style={{ fontSize: '13px', lineHeight: '1.4' }}>
                          <div style={{ fontWeight: '600', color: '#0ea5e9', marginBottom: '2px' }}>Variant B:</div>
                          <div style={{ color: '#374151' }}>{result.generatedContent.abVariants.titleB}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "shipping" && (
              <div style={{ display: 'grid', gap: '16px', width: '100%', maxWidth: '100%' }}>
                <div className="card" style={{ padding: '16px', background: '#f0f9ff' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600' }}>Recommended Shipping</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '16px' }}>
                    <div>
                      <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--brand)' }}>
                        {result.shippingData.singleItem.recommendedBox}
                      </div>
                      <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>Optimal Box Type</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '20px', fontWeight: '700', color: '#059669' }}>
                        ${result.shippingData.singleItem.shippingCost}
                      </div>
                      <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>Shipping Cost</div>
                    </div>
                  </div>
                  <div style={{ padding: '12px', background: '#dcfce7', borderRadius: '8px', borderLeft: '4px solid #22c55e' }}>
                    <div style={{ fontSize: '14px', color: '#166534', fontWeight: '600' }}>
                      {result.shippingData.savings.description}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "pricing" && (
              <div style={{ display: 'grid', gap: '16px', width: '100%', maxWidth: '100%' }}>
                <div className="card" style={{ padding: '20px', background: 'linear-gradient(135deg, #f0fdf4 0%, #f0f9ff 100%)' }}>
                  <h4 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '700', color: '#1f2937' }}>AI-Suggested Price Range</h4>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '32px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '32px', fontWeight: '800', color: '#059669', lineHeight: '1' }}>
                        ${result.extractedData.suggestedPrice.min}
                      </div>
                      <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px', fontWeight: '500' }}>Minimum Price</div>
                    </div>
                    <div style={{ fontSize: '24px', color: '#d1d5db', fontWeight: '300' }}>—</div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '32px', fontWeight: '800', color: '#059669', lineHeight: '1' }}>
                        ${result.extractedData.suggestedPrice.max}
                      </div>
                      <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px', fontWeight: '500' }}>Maximum Price</div>
                    </div>
                  </div>
                  <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '13px', color: '#6b7280', fontStyle: 'italic' }}>
                    Based on market analysis and product characteristics
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Publish Status Messages */}
      {publishStatus === "success" && publishResult && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }} // Delay to show after autocomplete animation
          className="result"
          style={{
            marginTop: '16px',
            background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
            borderColor: '#22c55e',
            border: '2px solid #22c55e',
            boxShadow: '0 4px 12px rgba(34, 197, 94, 0.2)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: '#22c55e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <CheckCircle size={20} color="white" />
            </div>
            <div>
              <p className="result-title" style={{ color: '#15803d', margin: 0, fontSize: '18px' }}>
                🎉 Successfully Published!
              </p>
              <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#166534' }}>
                Your product is now live in Shopify as a draft
              </p>
            </div>
          </div>

          <div style={{
            background: 'rgba(34, 197, 94, 0.1)',
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '16px',
            border: '1px solid rgba(34, 197, 94, 0.2)'
          }}>
            <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#166534', fontWeight: '600' }}>
              ✅ What's been created:
            </p>
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#166534' }}>
              <li>Product listing with AI-generated content</li>
              <li>Optimized shipping configuration</li>
              <li>SEO tags and metadata</li>
              <li>Ready for review and activation</li>
            </ul>
          </div>

          <div className="row gap">
            <a
              className="btn ai-primary"
              href={publishResult.productUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                border: 'none',
                color: 'white',
                fontWeight: '600'
              }}
            >
              <ExternalLink size={16} />
              Go to Shopify & Edit
            </a>
            <a className="btn ai-secondary" href={publishResult.publicUrl} target="_blank" rel="noreferrer">
              <Eye size={14} />
              Preview Product
            </a>
          </div>

          <p style={{
            margin: '12px 0 0 0',
            fontSize: '12px',
            color: '#6b7280',
            textAlign: 'center',
            fontStyle: 'italic'
          }}>
            💡 Tip: Review your product details in Shopify, then publish when ready!
          </p>
        </motion.div>
      )}

      {publishStatus === "error" && (
        <div className="result" style={{ marginTop: '16px', background: '#fef2f2', borderColor: '#ef4444' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626' }}>
            <AlertCircle size={16} />
            <p className="result-title" style={{ color: '#dc2626', margin: 0 }}>Publishing Failed</p>
          </div>
          <p style={{ margin: '8px 0', fontSize: '14px', color: '#7f1d1d' }}>{publishError}</p>
          <button className="btn" onClick={() => setPublishStatus("idle")}>Try Again</button>
        </div>
      )}

      <div className="row gap" style={{ marginTop: '16px' }}>
        <button
          className={`btn ${publishStatus === "success" ? "ai-success" : "ai-primary"}`}
          disabled={publishStatus === "publishing"}
          onClick={() => publishStatus === "success" ? setPublishStatus("idle") : setShowEmbeddedPreview(true)}
        >
          <Eye size={16} />
          {publishStatus === "publishing" ? "Publishing..." :
           publishStatus === "success" ? "Published ✓ - New Upload" :
           "Preview & Publish"}
        </button>
        <button
          className={`btn ${publishStatus === "success" ? "ai-success" : "ai-secondary"}`}
          disabled={publishStatus === "publishing"}
          onClick={() => publishStatus === "success" ? setPublishStatus("idle") : handlePublishToShopify()}
        >
          <Zap size={16} />
          {publishStatus === "publishing" ? "Publishing..." :
           publishStatus === "success" ? "Published ✓ - New Upload" :
           "Quick Publish"}
        </button>
      </div>

      {/* Embedded Shopify Preview */}
      <EmbeddedShopifyPreview
        isOpen={showEmbeddedPreview}
        onClose={() => setShowEmbeddedPreview(false)}
        productData={result}
        onPublish={handlePublishToShopify}
        publishStatus={publishStatus}
        publishResult={publishResult}
      />
    </div>
  );
};

// ========= Router =========
const useHashRoute = (initial = "home") => {
  const [route, setRoute] = useState(() => location.hash?.replace("#", "") || initial);
  React.useEffect(() => {
    const onHash = () => setRoute(location.hash?.replace("#", "") || initial);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [initial]);
  const nav = (r) => (location.hash = r);
  return { route, nav };
};

// ========= Shared UI =========
const Container = ({ className = "", children }) => (
  <div className={`container ${className}`}>{children}</div>
);

// Top nav uses your existing classes (.nav, .nav-inner, etc.)
const Nav = ({ onNav, route, user, onLogout }) => {
  const authed = isAuthenticated();

  const handleLogout = async () => {
    await logout();
    onLogout();
    onNav("login");
  };

  return (
    <header className="nav">
      <Container className="nav-inner">
        <button className="brand" onClick={() => onNav("home")}>
          <Box size={22} />
          <span className="brand-name">ShopBrain</span>
        </button>
        <nav className="nav-links">
          <button className={`link ${route === "home" ? "active" : ""}`} onClick={() => onNav("home")}>Home</button>
          <button className={`link ${route === "upload" ? "active" : ""}`} onClick={() => onNav("upload")}>Upload</button>
          {/* <button className={`link ${route === "shipping" ? "active" : ""}`} onClick={() => onNav("shipping")}>
            <Calculator size={14} /> Shipping
          </button>
          <button className={`link ${route === "checkout" ? "active" : ""}`} onClick={() => onNav("checkout")}>
            <Package size={14} /> Checkout Demo
          </button> */}
          {authed && (
            <button className={`link ${route === "dashboard" ? "active" : ""}`} onClick={() => onNav("dashboard")}>Dashboard</button>
          )}
          {authed ? (
            <button className="link" onClick={handleLogout}><LogOut size={14}/> Logout</button>
          ) : (
            <button className={`link ${route === "login" ? "active" : ""}`} onClick={() => onNav("login")}>Login</button>
          )}
          <a className="pill" href="https://github.com/kanish10/HTN25" target="_blank" rel="noreferrer">
            <ExternalLink size={14} /> Repo
          </a>
        </nav>
      </Container>
    </header>
  );
};

const Footer = () => (
  <footer className="footer">
    <Container className="footer-inner">
      <p>© {new Date().getFullYear()} ShopBrain</p>
      <p className="made-with"></p>
    </Container>
  </footer>
);

// ========= Pages =========
const HomePage = ({ onStart }) => (
  <>
    <section className="hero">
      <Container className="hero-grid">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="hero-title">AI-Powered Product Listing & Shipping Optimization</h1>
          <p className="hero-sub">Drop in a product photo. ShopBrain drafts your title, description, SEO,
            and recommends the cheapest box that fits—then publishes to Shopify.</p>
          <div className="hero-actions">
            <button className="btn primary" onClick={onStart}><Upload size={16} /> Try the Uploader</button>
            <a className="btn ghost" href="#upload" onClick={onStart}>See how it works <ExternalLink size={16} /></a>
          </div>
          <ul className="benefits">
            <li><CheckCircle size={16} /> 30–60 min → ~30 sec per product</li>
            <li><CheckCircle size={16} /> 20–40% lower shipping with better box picks</li>
            <li><CheckCircle size={16} /> A/B titles & SEO tags included</li>
          </ul>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
          <div className="card stack">
            <div className="row"><div className="icon-box"><Wand2 size={18} /></div><div><p className="row-title">From photo → listing</p><p className="row-sub">Title, bullets, FAQ, SEO in one go.</p></div></div>
            <div className="row"><div className="icon-box"><Box size={18} /></div><div><p className="row-title">3D Bin Packing</p><p className="row-sub">NP-Hard optimization with AI strategy.</p></div></div>
            <div className="row"><div className="icon-box"><Calculator size={18} /></div><div><p className="row-title">Multi-Item Optimizer</p><p className="row-sub">Calculate optimal shipping for bulk orders.</p></div></div>
            <div className="row"><div className="icon-box"><Zap size={18} /></div><div><p className="row-title">One-click publish</p><p className="row-sub">Push to Shopify with metafields.</p></div></div>
          </div>
        </motion.div>
      </Container>
    </section>

    <section className="how">
      <Container>
        <h2 className="section-title">How it works</h2>
        <div className="cols">
          {["Upload", "Generate", "Publish"].map((step, i) => (
            <div key={step} className="card">
              <div className="step">{i + 1}</div>
              <p className="card-title">{step}</p>
              <p className="card-sub">{[
                "Drop a product image (JPG/PNG).",
                "AI drafts title, bullets, FAQ and picks a box.",
                "Review → Publish to Shopify in one click.",
              ][i]}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  </>
);

// Upload page: Enhanced with AI Agent interface
const UploadPage = () => {
  const multiInputRef = useRef(null);
  const [files, setFiles] = useState([]); // For images
  const [status, setStatus] = useState("idle"); // idle | uploading | processing | ready | error
  const [previews, setPreviews] = useState([]); // For image previews
  const [textPrompt, setTextPrompt] = useState(""); // For user text input
  const [analysisResult, setAnalysisResult] = useState(null);
  const [error, setError] = useState(null);
  const [processingTime, setProcessingTime] = useState(0);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(-1);
  const [aiMessage, setAiMessage] = useState("");
  const [aiSubmessage, setAiSubmessage] = useState("");

  // AI Progress Steps Configuration
  const aiProgressSteps = [
    {
      title: "Initializing AI Agent",
      description: "Preparing Gemini Vision for multi-image analysis"
    },
    {
      title: "Analyzing Images",
      description: "Processing visual content and extracting product details"
    },
    {
      title: "Setting Things Up",
      description: "Initializing your listing and product image"
    },
    {
      title: "Generating Content",
      description: "Creating title, description, and SEO tags"
    }
  ];

  // Enhanced progress handling with AI steps
  React.useEffect(() => {
    let interval = null;
    let stepInterval = null;

    if (status === "processing") {
      setProgress(0);
      setCurrentStep(0);
      setAiMessage("Initializing AI Agent...");
      setAiSubmessage("Starting Gemini Vision analysis for your product images");

      // Progress bar animation
      interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 95) {
            clearInterval(interval);
            return 95;
          }
          const increment = Math.random() * 8;
          return Math.min(prev + increment, 95);
        });
      }, 400);

      // Step progression with realistic timing
      const stepMessages = [
        {
          message: "Initializing AI Agent...",
          submessage: "Preparing Gemini Vision for multi-image analysis",
          duration: 1500
        },
        {
          message: "Analyzing product images...",
          submessage: "Processing visual content and extracting product details",
          duration: 3000
        },
        {
          message: "Setting Things Up...",
          submessage: "Initializing your listing and product image",
          duration: 2000
        },
        {
          message: "Generating content...",
          submessage: "Creating title, description, and SEO-optimized tags",
          duration: 2500
        }
      ];

      let currentStepIndex = 0;
      const progressSteps = () => {
        if (currentStepIndex < stepMessages.length) {
          const step = stepMessages[currentStepIndex];
          setCurrentStep(currentStepIndex);
          setAiMessage(step.message);
          setAiSubmessage(step.submessage);

          setTimeout(() => {
            currentStepIndex++;
            progressSteps();
          }, step.duration);
        }
      };

      progressSteps();
    } else if (status === "ready") {
      setProgress(100);
      setCurrentStep(aiProgressSteps.length);
      setAiMessage("Analysis Complete!");
      setAiSubmessage("Your product listing is ready for review and publishing");
    } else if (status === "error") {
      setProgress(0);
      setCurrentStep(-1);
    } else {
      setCurrentStep(-1);
      setAiMessage("");
      setAiSubmessage("");
    }

    return () => {
      if (interval) clearInterval(interval);
      if (stepInterval) clearInterval(stepInterval);
    };
  }, [status, aiProgressSteps.length]);

  const handleChoose = () => {
    multiInputRef.current?.click();
  };

  const onMultipleFiles = (fileList) => {
    if (!fileList || fileList.length === 0) return;
    const filesArray = Array.from(fileList);
    if (filesArray.length > 5) {
      setError("Maximum 5 images allowed");
      return;
    }

    setFiles(filesArray);
    setPreviews(filesArray.map(f => URL.createObjectURL(f)));
    setError(null);
    setAnalysisResult(null);
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result.split(',')[1]); // Remove data:image/jpeg;base64, prefix
      reader.onerror = reject;
    });
  };

  const handleUpload = async () => {
    if (files.length === 0 && !textPrompt.trim()) return;

    const startTime = Date.now();
    setStatus("uploading");
    setError(null);

    try {
      setStatus("processing");

      const images = await Promise.all(
        files.map(async (file) => ({
          fileName: file.name,
          fileType: file.type,
          imageData: await fileToBase64(file)
        }))
      );

      const response = await axios.post(`${API_URL}/api/upload-more`, {
        images,
        textPrompt: textPrompt.trim() || null
      }, { timeout: 120000 }); // Longer timeout for multiple images

      const ms = Date.now() - startTime;
      setProcessingTime(ms);

      if (response.data.success) {
        const payload = response.data.data;
        
        // Use the actual selected image URL from the server response (S3 URL)
        const selectedImageUrl = payload.imageUrl || payload.imageAnalysis?.selectedImage?.url;
        const selectedImageIndex = payload.imageAnalysis?.selectedImage?.index || 0;

        // Always prioritize S3 URL over local blob URLs
        const imageToDisplay = selectedImageUrl || previews[selectedImageIndex] || previews[0];
        
        console.log('🖼️ Image URL from server:', selectedImageUrl);
        console.log('🖼️ Final image to display:', imageToDisplay);
        
        setAnalysisResult({
          ...payload,
          imageUrl: selectedImageUrl, // Ensure we use the S3 URL in analysis results
          multiImageAnalysis: response.data.data.imageAnalysis
        });
        setStatus("ready");

        addUpload({
          previewUrl: selectedImageUrl || imageToDisplay, // Always prefer S3 URL for storage
          title: payload.generatedContent?.title || "Untitled product",
          box: payload.shippingData?.singleItem?.recommendedBox || "—",
          createdAt: Date.now(),
          shopifyHandle: null,
          multiImage: true,
          totalImages: files.length,
          selectedImageIndex,
          selectedImageUrl,
          s3ImageUrl: selectedImageUrl // Store S3 URL separately for reference
        });
      } else {
        throw new Error(response.data.details || 'Analysis failed');
      }
    } catch (err) {
      console.error('Upload/Analysis Error:', err);
      setStatus("error");
      if (err.code === 'ECONNREFUSED') setError('Cannot connect to analysis server. Is it running on port 3002?');
      else if (err.response?.data?.details) setError(err.response.data.details);
      else if (err.message?.includes('timeout')) setError('Analysis timed out.');
      else setError(err.message || 'Analysis failed.');
    }
  };

  const handleRetry = () => { 
    setStatus("idle"); 
    setError(null); 
    setAnalysisResult(null); 
    setTextPrompt(""); 
    setFiles([]);
    setPreviews([]);
  };

  return (
    <Container className="upload">
      <div className="cols" style={{ alignItems: 'stretch', gap: '16px' }}>
        <AIAgentWrapper
          isActive={status === "processing" || status === "uploading"}
          className="card"
          style={{
            flex: '1',
            display: 'flex',
            flexDirection: 'column',
            minHeight: '400px',
            height: 'auto'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <p className="label">1) Upload product images</p>
            {(status === "processing" || status === "uploading") && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="ai-loading-dots">
                  <div className="ai-loading-dot"></div>
                  <div className="ai-loading-dot"></div>
                  <div className="ai-loading-dot"></div>
                </div>
                <span style={{ fontSize: '12px', color: '#10b981', fontWeight: '600' }}>
                  AI Agent Active
                </span>
              </div>
            )}
          </div>

          <div className="dropzone">
            {previews.length > 0 ? (
              <div className="image-grid-container">
                {previews.map((preview, index) => {
                  // Check if this is the selected image after analysis
                  const isSelected = analysisResult && 
                    analysisResult.imageAnalysis?.selectedImage?.index === index;
                  const s3ImageUrl = analysisResult?.imageUrl;
                  
                  return (
                    <div 
                      key={index} 
                      className={`image-grid-item ${isSelected ? 'selected' : ''}`}
                      style={{
                        border: isSelected ? '3px solid #10b981' : '1px solid #e5e7eb',
                        boxShadow: isSelected ? '0 4px 12px rgba(16, 185, 129, 0.3)' : 'none'
                      }}
                    >
                      <ImageWithFallback 
                        src={isSelected && s3ImageUrl ? s3ImageUrl : preview} 
                        alt={`preview ${index + 1}`} 
                        className="image-grid-img" 
                        onError={(e) => {
                          // Fallback to local preview if S3 URL fails
                          if (e.target.src !== preview) {
                            console.warn('S3 image failed to load, falling back to local preview');
                            e.target.src = preview;
                          }
                        }}
                      />
                      <div className={`image-grid-badge ${isSelected ? 'selected' : ''}`}
                           style={{
                             background: isSelected ? '#10b981' : '#6b7280',
                             color: 'white'
                           }}>
                        {isSelected ? '✓' : index + 1}
                      </div>
                      {isSelected && (
                        <div style={{
                          position: 'absolute',
                          bottom: '4px',
                          left: '4px',
                          right: '4px',
                          background: 'rgba(16, 185, 129, 0.9)',
                          color: 'white',
                          fontSize: '10px',
                          padding: '2px 4px',
                          borderRadius: '4px',
                          textAlign: 'center',
                          fontWeight: '600'
                        }}>
                          Selected
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="dz-empty">
                <Upload size={28} />
                <p className="muted">Select Image(s)</p>
              </div>
            )}
            <div className="row gap">
              <button className="btn" onClick={handleChoose}>
                Choose images {files.length > 0 ? `(${files.length})` : ""}
              </button>
              {(files.length > 0 || textPrompt.trim()) && (
                <button
                  className={`btn ${status === "processing" ? "ai-primary" : "primary"}`}
                  disabled={status === "uploading" || status === "processing"}
                  onClick={handleUpload}
                >
                  {status === "processing" ? (
                    <>
                      <Wand2 size={16} />
                      Working...
                    </>
                  ) : (
                    <>
                      <Zap size={16} />
                      Get Started
                    </>
                  )}
                </button>
              )}
            </div>
            <input
              ref={multiInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => onMultipleFiles(e.target.files)}
            />
          </div>

          {/* Text Prompt Section */}
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
            <p className="label" style={{ marginBottom: '8px' }}>Optional: Add a Prompt</p>
            <textarea
              className="text-input"
              placeholder="Describe your product or provide additional context..."
              value={textPrompt}
              onChange={(e) => setTextPrompt(e.target.value)}
              disabled={status === "uploading" || status === "processing"}
              style={{
                width: '100%',
                minHeight: '80px',
                resize: 'vertical',
                fontSize: '14px',
                lineHeight: '1.4'
              }}
            />
            <p className="muted" style={{ marginTop: '4px', fontSize: '11px' }}>
              Help us better understand your product with additional context or specific requirements.
            </p>
          </div>

          {files.length > 0 && status === "idle" && (
            <p className="muted" style={{ marginTop: '8px', fontSize: '12px' }}>
              Our agent will analyze your images and select the best ones for your listing.
            </p>
          )}
        </AIAgentWrapper>

        <div className="card" style={{
          flex: '1',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '400px',
          height: 'auto'
        }}>
          <p className="label">2) AI Agent Status</p>

          {/* AI Status Message */}
          {aiMessage && (
            <AIStatusMessage
              message={aiMessage}
              submessage={aiSubmessage}
              type={status === "error" ? "error" : status === "ready" ? "completed" : "processing"}
              icon={status === "error" ? AlertCircle : status === "ready" ? CheckCircle : Wand2}
            />
          )}

          {/* AI Progress Steps */}
          {(status === "processing" || status === "ready") && (
            <AIProgressSteps
              steps={aiProgressSteps}
              currentStep={currentStep}
            />
          )}

          <div style={{ flex: '1', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
            {status === "error" && (
              <div className="result" style={{borderColor: '#ef4444', background: '#fef2f2'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626'}}>
                  <AlertCircle size={16} />
                  <p className="result-title" style={{color: '#dc2626', margin: 0}}>Analysis Failed</p>
                </div>
                <p style={{margin: '8px 0', fontSize: '14px', color: '#7f1d1d'}}>{error}</p>
                <button className="btn ai-secondary" onClick={handleRetry}>
                  <Zap size={16} />
                  Try Again
                </button>
              </div>
            )}

            {status === "idle" && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                color: '#6b7280',
                textAlign: 'center',
                gap: '12px',
                minHeight: '250px'
              }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
                  border: '2px solid rgba(16, 185, 129, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Wand2 size={24} color="#10b981" />
                </div>
                <div>
                  <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                    {files.length === 0 ? "Agent Online" : "Ready to Analyze"}
                  </div>
                  <div style={{ fontSize: '13px' }}>
                    {files.length === 0 ? "Upload image(s) to begin" : `${files.length} image(s) selected. Click on Get Started to continue.`}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {status === "ready" && analysisResult && (
        <AIAgentWrapper
          isActive={true}
          className="card"
          style={{ marginTop: '16px', width: '100%', boxSizing: 'border-box', minWidth: '100%' }}
        >
          <div style={{ width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
            <AnalysisResults result={analysisResult} processingTime={processingTime} />
          </div>
        </AIAgentWrapper>
      )}
    </Container>
  );
};

// ======= NEW: Login and Dashboard (demo) =======
const LoginPage = ({ onLoggedIn }) => {
  const [name, setName] = useState("");
  const [store, setStore] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!name || !store) {
      setError("Enter your name and Shopify store domain");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await login({ name, email, storeDomain: store });
      onLoggedIn();
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="upload">
      <div className="cols">
        <div className="card">
          <p className="label">Login</p>
          <form onSubmit={submit} className="dropzone" style={{ gap: 10 }}>
            {error && (
              <div className="result" style={{borderColor: '#ef4444', background: '#fef2f2', marginBottom: '10px'}}>
                <p style={{color: '#dc2626', margin: 0, fontSize: '14px'}}>{error}</p>
              </div>
            )}
            <input className="text-input" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} disabled={loading} />
            <input className="text-input" placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
            <input className="text-input" placeholder="Shopify store (e.g. my-shop.myshopify.com)" value={store} onChange={(e) => setStore(e.target.value)} disabled={loading} />
            <button className="btn primary" type="submit" disabled={loading}>
              <LogIn size={16}/> {loading ? "Logging in..." : "Continue"}
            </button>
            <p className="muted" style={{ marginTop: 4 }}>Used to personalize your dashboard.</p>
          </form>
        </div>

        <div className="card">
          <p className="label">What you get</p>
          <div className="result">
            <ul className="bullets">
              <li>Connects to <b>your</b> store</li>
              <li>Shows past uploads & time saved</li>
              <li>One-click publish to Shopify (from Upload page)</li>
            </ul>
          </div>
        </div>
      </div>
    </Container>
  );
};

const DashboardPage = ({ user, onLogout }) => {
  const items = getUploads();
  const timeSavedMin = items.length * 30;       // demo assumption
  const aiCost = (items.length * 0.12).toFixed(2);

  return (
    <Container className="upload">
      <div className="cols">
        <div className="card">
          <p className="label">Account</p>
          <div className="dropzone" style={{ alignItems: "flex-start", textAlign: "left" }}>
            <p><b>Name:</b> {user?.name || "—"}</p>
            <p><b>Store:</b> {user?.storeDomain || "—"}</p>
            <p><b>Logged in:</b> {user?.loggedInAt ? new Date(user.loggedInAt).toLocaleString() : "—"}</p>
            <div className="row gap">
              <button className="btn" onClick={onLogout}><LogOut size={16}/> Log out</button>
              <a className="btn" href="#upload"><Upload size={16}/> Go to Uploader</a>
            </div>
          </div>
        </div>

        <div className="card">
          <p className="label">Impact</p>
          <div className="kpis">
            <div className="card kpi"><div className="big">{items.length}</div><div className="sub">Listings created</div></div>
            <div className="card kpi"><div className="big">~{timeSavedMin}m</div><div className="sub">Time saved</div></div>
            <div className="card kpi"><div className="big">${aiCost}</div><div className="sub">AI cost (est)</div></div>
          </div>

          <div className="result" style={{ marginTop: 12 }}>
            <p className="result-title">Past uploads</p>
            {items.length === 0 ? (
              <p className="muted">No uploads yet. Try the Uploader.</p>
            ) : (
              <div className="list-grid">
                {items.map((p, idx) => (
                  <div key={idx} className="card" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <ImageWithFallback src={p.previewUrl} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{p.title || "Untitled product"}</div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {new Date(p.createdAt).toLocaleString()} • {p.box || "Box TBD"}
                      </div>
                    </div>
                    {p.shopifyHandle ? (
                      <a className="btn" href={`https://${user?.storeDomain}/products/${p.shopifyHandle}`} target="_blank" rel="noreferrer">View</a>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Container>
  );
};

// ========= Checkout Demo Page =========
const CheckoutDemoPage = () => {
  const [selectedShipping, setSelectedShipping] = useState(null);

  const handleShippingSelect = (shippingOption) => {
    setSelectedShipping(shippingOption);
    console.log('Selected shipping option:', shippingOption);
  };

  return (
    <Container className="upload">
      <div className="cols">
        {/* Cart Summary */}
        <div className="card">
          <h2 className="label">Your Order</h2>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>3× Canvas Tote Bag</span>
              <span>$75.00</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>1× LEGO Architecture Set</span>
              <span>$79.99</span>
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '12px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '600' }}>
              <span>Subtotal</span>
              <span>$154.99</span>
            </div>
            {selectedShipping && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                  <span>Shipping ({selectedShipping.name})</span>
                  <span>${selectedShipping.cost.toFixed(2)}</span>
                </div>
                <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '12px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', fontSize: '18px', color: 'var(--brand)' }}>
                  <span>Total</span>
                  <span>${(154.99 + selectedShipping.cost).toFixed(2)}</span>
                </div>
              </>
            )}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: 'var(--bg-weak)',
              padding: '12px',
              borderRadius: '8px',
              marginTop: '16px'
            }}
          >
            <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Box size={16} /> Items to Ship
            </h4>
            <div style={{ fontSize: '13px', color: 'var(--text-weak)' }}>
              • 3 soft canvas bags (15"×12"×6" each, 0.8 lbs)<br />
              • 1 LEGO set box (18"×14"×3", 2.5 lbs)<br />
              <br />
              <strong>Challenge:</strong> Shopify would normally use 4 separate boxes, but AI optimization can find better combinations.
            </div>
          </motion.div>
        </div>

        {/* Shipping Options */}
        <ShippingOptimizer onShippingSelect={handleShippingSelect} />
      </div>
    </Container>
  );
};

// ========= Root =========
export default function App() {
  const { route, nav } = useHashRoute("home");
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const authed = isAuthenticated();

  // Check authentication on app load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userData = await verifyToken();
        setUser(userData);
      } catch (error) {
        console.error('Auth check failed:', error);
        setUser(null);
      } finally {
        setAuthLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Redirect to login if not authenticated and trying to access protected routes
  useEffect(() => {
    if (!authLoading && !authed && ['upload', 'dashboard', 'shipping'].includes(route)) {
      nav('login');
    }
  }, [route, authed, authLoading, nav]);

  const handleLogin = () => {
    const userData = getUser();
    setUser(userData);
    nav("dashboard");
  };

  const handleLogout = () => {
    setUser(null);
  };

  if (authLoading) {
    return (
      <div className="app">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <Nav onNav={nav} route={route} user={user} onLogout={handleLogout} />
      {route === "home" && <HomePage onStart={() => authed ? nav("upload") : nav("login")} />}
      {route === "upload" && (authed ? <UploadPage /> : <LoginPage onLoggedIn={handleLogin} />)}
      {route === "shipping" && (authed ? <ShippingCalculator /> : <LoginPage onLoggedIn={handleLogin} />)}
      {route === "login" && <LoginPage onLoggedIn={handleLogin} />}
      {route === "dashboard" && (authed ? <DashboardPage user={user} onLogout={handleLogout} /> : <LoginPage onLoggedIn={handleLogin} />)}
      {route === "checkout" && <CheckoutDemoPage />}
      <Footer />
    </div>
  );
}
