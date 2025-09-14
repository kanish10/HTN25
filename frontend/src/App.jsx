import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Upload, Wand2, Box, Zap, CheckCircle, ExternalLink,
  AlertCircle, ChevronDown, ChevronUp, Package, Tag, DollarSign, Truck,
  LogIn, LogOut, User, Calculator
} from "lucide-react";
import axios from "axios";
import ShippingCalculator from "./ShippingCalculator";
import ShippingOptimizer from "./ShippingOptimizer";
import "./App.css"; // keep your current CSS

// ========= Config =========
const API_URL = "http://localhost:3002";

// ========= Demo auth + local storage =========
const AUTH_KEY = "sb_auth";
const UPLOADS_KEY = "sb_uploads";

const getAuth = () => {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY) || "null"); } catch { return null; }
};
const setAuth = (obj) => localStorage.setItem(AUTH_KEY, JSON.stringify(obj));
const clearAuth = () => localStorage.removeItem(AUTH_KEY);

const getUploads = () => {
  try { return JSON.parse(localStorage.getItem(UPLOADS_KEY) || "[]"); } catch { return []; }
};
const addUpload = (item) => {
  const arr = getUploads();
  arr.unshift(item);
  localStorage.setItem(UPLOADS_KEY, JSON.stringify(arr.slice(0, 50)));
};

// ========= Analysis Results (your component, unchanged) =========
const AnalysisResults = ({ result, processingTime }) => {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [publishStatus, setPublishStatus] = useState("idle"); // idle | publishing | success | error
  const [publishError, setPublishError] = useState(null);
  const [publishResult, setPublishResult] = useState(null);

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
                      <img
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
        <div className="result" style={{ marginTop: '16px', background: '#f0fdf4', borderColor: '#22c55e' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#15803d' }}>
            <CheckCircle size={16} />
            <p className="result-title" style={{ color: '#15803d', margin: 0 }}>Published Successfully!</p>
          </div>
          <p style={{ margin: '8px 0', fontSize: '14px', color: '#166534' }}>
            Product created in Shopify as draft. You can review and activate it.
          </p>
          <div className="row gap">
            <a className="btn" href={publishResult.productUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={14} /> Edit in Shopify
            </a>
            <a className="btn" href={publishResult.publicUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={14} /> View Product
            </a>
          </div>
        </div>
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
          className="btn primary"
          disabled={publishStatus === "publishing" || publishStatus === "success"}
          onClick={handlePublishToShopify}
        >
          {publishStatus === "publishing" ? "Publishing..." :
           publishStatus === "success" ? "Published ✓" :
           "Publish to Shopify"}
        </button>
      </div>
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
const Nav = ({ onNav, route }) => {
  const authed = Boolean(getAuth());
  return (
    <header className="nav">
      <Container className="nav-inner">
        <div className="brand">
          <Box size={22} />
          <span className="brand-name">ShopBrain</span>
        </div>
        <nav className="nav-links">
          <button className={`link ${route === "home" ? "active" : ""}`} onClick={() => onNav("home")}>Home</button>
          <button className={`link ${route === "upload" ? "active" : ""}`} onClick={() => onNav("upload")}>Upload</button>
          {/* <button className={`link ${route === "shipping" ? "active" : ""}`} onClick={() => onNav("shipping")}>
            <Calculator size={14} /> Shipping
          </button>
          <button className={`link ${route === "checkout" ? "active" : ""}`} onClick={() => onNav("checkout")}>
            <Package size={14} /> Checkout Demo
          </button> */}
          {authed ? (
            <>
              <button className={`link ${route === "dashboard" ? "active" : ""}`} onClick={() => onNav("dashboard")}>Dashboard</button>
              <button className="link" onClick={() => { clearAuth(); onNav("login"); }}><LogOut size={14}/> Logout</button>
            </>
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
      <p>© {new Date().getFullYear()} ShopBrain. Built at Hack the North.</p>
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

// Upload page: keep your look; when analysis finishes, we save to dashboard
const UploadPage = () => {
  const multiInputRef = useRef(null);
  const [files, setFiles] = useState([]); // For images
  const [status, setStatus] = useState("idle"); // idle | uploading | processing | ready | error
  const [previews, setPreviews] = useState([]); // For image previews
  const [analysisResult, setAnalysisResult] = useState(null);
  const [error, setError] = useState(null);
  const [processingTime, setProcessingTime] = useState(0);
  const [progress, setProgress] = useState(0);

  React.useEffect(() => {
    let interval = null;
    if (status === "processing") {
      setProgress(0);
      interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 95) {
            clearInterval(interval);
            return 95;
          }
          const increment = Math.random() * 10;
          return Math.min(prev + increment, 95);
        });
      }, 500);
    } else if (status === "ready" || status === "error") {
      setProgress(status === "ready" ? 100 : 0);
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [status]);

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
    if (files.length === 0) return;

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
        images
      }, { timeout: 120000 }); // Longer timeout for multiple images

      const ms = Date.now() - startTime;
      setProcessingTime(ms);

      if (response.data.success) {
        const payload = response.data.data;
        setAnalysisResult({
          ...payload,
          multiImageAnalysis: response.data.data.imageAnalysis
        });
        setStatus("ready");

        // Use the actual selected image URL from the server response
        const selectedImageUrl = payload.imageUrl || payload.imageAnalysis?.selectedImage?.url;
        const selectedImageIndex = payload.imageAnalysis?.selectedImage?.index || 0;

        // Use server image URL when available
        const imageToDisplay = selectedImageUrl || (previews[selectedImageIndex] || previews[0]);

        addUpload({
          previewUrl: imageToDisplay,
          title: payload.generatedContent?.title || "Untitled product",
          box: payload.shippingData?.singleItem?.recommendedBox || "—",
          createdAt: Date.now(),
          shopifyHandle: null,
          multiImage: true,
          totalImages: files.length,
          selectedImageIndex,
          selectedImageUrl
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

  const handleRetry = () => { setStatus("idle"); setError(null); setAnalysisResult(null); };

  return (
    <Container className="upload">
      <div className="cols" style={{ alignItems: 'stretch', gap: '16px' }}>
        <div className="card" style={{ flex: '2.3', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <p className="label">1) Upload product images</p>
          </div>

          <div className="dropzone">
            {previews.length > 0 ? (
              <div className="image-grid-container">
                {previews.map((preview, index) => (
                  <div key={index} className="image-grid-item">
                    <img src={preview} alt={`preview ${index + 1}`} className="image-grid-img" />
                    <div className="image-grid-badge">
                      {index + 1}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="dz-empty">
                <Upload size={28} />
                <p className="muted">Choose 1-5 images • AI will pick the best one</p>
              </div>
            )}
            <div className="row gap">
              <button className="btn" onClick={handleChoose}>
                Choose images {files.length > 0 ? `(${files.length})` : ""}
              </button>
              {files.length > 0 && (
                <button
                  className="btn primary"
                  disabled={status === "uploading" || status === "processing"}
                  onClick={handleUpload}
                >
                  {status === "processing" ? "Analyzing..." : "Analyze & Pick Best"}
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

          {files.length > 0 && (
            <p className="muted" style={{ marginTop: '8px', fontSize: '12px' }}>
              AI will analyze all {files.length} images and automatically select the best one for your listing
            </p>
          )}
        </div>

        <div className="card" style={{ flex: '1', display: 'flex', flexDirection: 'column' }}>
          <p className="label">2) Status</p>
          <ol className="status">
            {[
              { key: "uploading", label: "Processing images..." },
              { key: "processing", label: "Gemini analyzing & selecting best image" },
              { key: "ready", label: "Analysis complete!" },
            ].map(({ key, label }) => (
              <li key={key} className={`status-row ${status === key ? "active" : status === "idle" || status === "error" ? "" : "dim"}`}>
                <span className={`dot ${status === key ? "pulse" : ""}`} />
                <span className={`status-text ${status === key ? "bold" : ""}`}>{label}</span>
              </li>
            ))}
          </ol>

          <div style={{ flex: '1', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
            {status === "error" && (
              <div className="result" style={{borderColor: '#ef4444', background: '#fef2f2'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626'}}>
                  <AlertCircle size={16} />
                  <p className="result-title" style={{color: '#dc2626', margin: 0}}>Analysis Failed</p>
                </div>
                <p style={{margin: '8px 0', fontSize: '14px', color: '#7f1d1d'}}>{error}</p>
                <button className="btn" onClick={handleRetry}>Try Again</button>
              </div>
            )}

            {status === "processing" && (
              <div className="result" style={{background: '#f0f9ff', borderColor: '#0ea5e9'}}>
                <p className="result-title">AI is analyzing your product...</p>
                <p style={{margin: '8px 0', fontSize: '14px', color: '#0369a1'}}>
                  Gemini Vision is extracting product details, generating content, and optimizing shipping. This usually takes 5–15 seconds.
                </p>
                <div className="progress-bar-container">
                  <div className="progress-bar" style={{ width: `${progress}%` }}></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {status === "ready" && analysisResult && (
        <div className="card" style={{ marginTop: '16px', width: '100%', boxSizing: 'border-box', minWidth: '100%' }}>
          <div style={{ width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
            <AnalysisResults result={analysisResult} processingTime={processingTime} />
          </div>
        </div>
      )}
    </Container>
  );
};

// ======= NEW: Login and Dashboard (demo) =======
const LoginPage = ({ onLoggedIn }) => {
  const [name, setName] = useState("");
  const [store, setStore] = useState("");
  const [email, setEmail] = useState("");

  const submit = (e) => {
    e.preventDefault();
    if (!name || !store) return alert("Enter your name and Shopify store domain");
    setAuth({ name, email, storeDomain: store, loggedInAt: Date.now() });
    onLoggedIn();
  };

  return (
    <Container className="upload">
      <div className="cols">
        <div className="card">
          <p className="label">Login</p>
          <form onSubmit={submit} className="dropzone" style={{ gap: 10 }}>
            <input className="text-input" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="text-input" placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="text-input" placeholder="Shopify store (e.g. my-shop.myshopify.com)" value={store} onChange={(e) => setStore(e.target.value)} />
            <button className="btn primary" type="submit"><LogIn size={16}/> Continue</button>
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

const DashboardPage = ({ onLogout }) => {
  const auth = getAuth();
  const items = getUploads();
  const timeSavedMin = items.length * 30;       // demo assumption
  const aiCost = (items.length * 0.12).toFixed(2);

  return (
    <Container className="upload">
      <div className="cols">
        <div className="card">
          <p className="label">Account</p>
          <div className="dropzone" style={{ alignItems: "flex-start", textAlign: "left" }}>
            <p><b>Name:</b> {auth?.name || "—"}</p>
            <p><b>Store:</b> {auth?.storeDomain || "—"}</p>
            <p><b>Logged in:</b> {auth?.loggedInAt ? new Date(auth.loggedInAt).toLocaleString() : "—"}</p>
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
                    <img src={p.previewUrl} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{p.title || "Untitled product"}</div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {new Date(p.createdAt).toLocaleString()} • {p.box || "Box TBD"}
                      </div>
                    </div>
                    {p.shopifyHandle ? (
                      <a className="btn" href={`https://${auth?.storeDomain}/products/${p.shopifyHandle}`} target="_blank" rel="noreferrer">View</a>
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
  const authed = Boolean(getAuth());

  return (
    <div className="app">
      <Nav onNav={nav} route={route} />
      {route === "home" && <HomePage onStart={() => nav("upload")} />}
      {route === "upload" && <UploadPage />}
      {route === "shipping" && <ShippingCalculator />}
      {route === "checkout" && <CheckoutDemoPage />}
      {route === "login" && <LoginPage onLoggedIn={() => nav("dashboard")} />}
      {route === "dashboard" && (authed ? <DashboardPage onLogout={() => { clearAuth(); nav("login"); }} /> : <LoginPage onLoggedIn={() => nav("dashboard")} />)}
      <Footer />
    </div>
  );
}
