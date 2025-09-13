import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Upload, Wand2, Box, Zap, CheckCircle, Github, ExternalLink,
  AlertCircle, ChevronDown, ChevronUp, Package, Tag, DollarSign, Truck,
  LogIn, LogOut, User
} from "lucide-react";
import axios from "axios";
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

  const tabs = [
    { id: "overview", label: "Overview", icon: Package },
    { id: "content", label: "Content", icon: Tag },
    { id: "shipping", label: "Shipping", icon: Truck },
    { id: "pricing", label: "Pricing", icon: DollarSign }
  ];

  return (
    <div className="result">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p className="result-title">
          🎉 Analysis Complete {processingTime > 0 && (
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
                    display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px',
                    borderBottom: activeTab === tab.id ? '2px solid var(--brand)' : '2px solid transparent'
                  }}
                >
                  <IconComponent size={14} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div style={{ minHeight: '200px' }}>
            {activeTab === "overview" && (
              <div style={{ display: 'grid', gap: '12px' }}>
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
              <div style={{ display: 'grid', gap: '12px' }}>
                <div className="card" style={{ padding: '12px' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600' }}>Generated Title</h4>
                  <p style={{ margin: 0, fontWeight: '600', fontSize: '16px' }}>{result.generatedContent.title}</p>
                </div>
                <div className="card" style={{ padding: '12px' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600' }}>Description</h4>
                  <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.5' }}>{result.generatedContent.description}</p>
                </div>
                <div className="card" style={{ padding: '12px' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600' }}>Bullet Points</h4>
                  <ul style={{ margin: 0, paddingLeft: '16px' }}>
                    {result.generatedContent.bulletPoints.map((point, i) => (
                      <li key={i} style={{ fontSize: '14px', marginBottom: '4px' }}>{point}</li>
                    ))}
                  </ul>
                </div>
                <div className="card" style={{ padding: '12px' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600' }}>SEO Tags</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {result.generatedContent.seoTags.map((tag, i) => (
                      <span key={i} className="chip" style={{ fontSize: '12px', background: 'var(--chip)' }}>{tag}</span>
                    ))}
                  </div>
                </div>
                {result.generatedContent.abVariants && (
                  <div className="card" style={{ padding: '12px' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600' }}>A/B Test Variants</h4>
                    <div style={{ display: 'grid', gap: '8px' }}>
                      <div><strong>Variant A:</strong> {result.generatedContent.abVariants.titleA}</div>
                      <div><strong>Variant B:</strong> {result.generatedContent.abVariants.titleB}</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "shipping" && (
              <div style={{ display: 'grid', gap: '12px' }}>
                <div className="card" style={{ padding: '12px', background: '#f0f9ff' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600' }}>Recommended Shipping</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--brand)' }}>
                        {result.shippingData.singleItem.recommendedBox}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>Box Type</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '18px', fontWeight: '600', color: '#059669' }}>
                        ${result.shippingData.singleItem.shippingCost}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>Shipping Cost</div>
                    </div>
                  </div>
                  <div style={{ marginTop: '8px', padding: '8px', background: '#dcfce7', borderRadius: '6px' }}>
                    <div style={{ fontSize: '14px', color: '#166534', fontWeight: '600' }}>
                      💰 {result.shippingData.savings.description}
                    </div>
                  </div>
                </div>
                <div className="card" style={{ padding: '12px' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600' }}>Bulk Shipping Options</h4>
                  {result.shippingData.bulkOrders?.map((bulk, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < result.shippingData.bulkOrders.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <span>{bulk.quantity} items - {bulk.recommendedBox}</span>
                      <span><strong>${bulk.costPerItem}/item</strong> (${bulk.totalCost} total)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "pricing" && (
              <div style={{ display: 'grid', gap: '12px' }}>
                <div className="card" style={{ padding: '12px' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600' }}>Suggested Price Range</h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div>
                      <div style={{ fontSize: '24px', fontWeight: '600', color: '#059669' }}>
                        ${result.extractedData.suggestedPrice.min}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>Minimum</div>
                    </div>
                    <div style={{ fontSize: '20px', color: '#6b7280' }}>→</div>
                    <div>
                      <div style={{ fontSize: '24px', fontWeight: '600', color: '#059669' }}>
                        ${result.extractedData.suggestedPrice.max}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>Maximum</div>
                    </div>
                  </div>
                </div>
                <div className="card" style={{ padding: '12px' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600' }}>AI Processing Costs</h4>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {result.generatedContent.aiCosts.breakdown.map((cost, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                        <span>{cost.service} - {cost.operation}</span>
                        <span><strong>${cost.cost.toFixed(3)}</strong></span>
                      </div>
                    ))}
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontWeight: '600' }}>
                      <span>Total AI Cost</span>
                      <span style={{ color: 'var(--brand)' }}>${result.generatedContent.aiCosts.total}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      <div className="row gap" style={{ marginTop: '16px' }}>
        <button className="btn primary">Publish to Shopify</button>
        <button className="btn" onClick={() => console.log('Full analysis:', result)}>
          Export Data
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
          {authed ? (
            <>
              <button className={`link ${route === "dashboard" ? "active" : ""}`} onClick={() => onNav("dashboard")}>Dashboard</button>
              <button className="link" onClick={() => { clearAuth(); onNav("login"); }}><LogOut size={14}/> Logout</button>
            </>
          ) : (
            <button className={`link ${route === "login" ? "active" : ""}`} onClick={() => onNav("login")}><LogIn size={14}/> Login</button>
          )}
          <a className="pill" href="https://github.com/" target="_blank" rel="noreferrer">
            <Github size={14} /> Repo
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
            <div className="row"><div className="icon-box"><Box size={18} /></div><div><p className="row-title">Smart box pick</p><p className="row-sub">Cheapest box that fits—dim weight aware.</p></div></div>
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
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | uploading | processing | ready | error
  const [preview, setPreview] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [error, setError] = useState(null);
  const [processingTime, setProcessingTime] = useState(0);

  const handleChoose = () => inputRef.current?.click();
  const onFile = (f) => {
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setError(null);
    setAnalysisResult(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    const startTime = Date.now();
    setStatus("uploading");
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', file);

      setStatus("processing");

      // Call your analysis server (keep your existing API_URL)
      const response = await axios.post(`${API_URL}/api/direct-upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000
      });

      const ms = Date.now() - startTime;
      setProcessingTime(ms);

      if (response.data.success) {
        const payload = response.data.data;
        setAnalysisResult(payload);
        setStatus("ready");

        // ---- save to local history for dashboard
        addUpload({
          previewUrl: preview,
          title: payload.generatedContent?.title || "Untitled product",
          box: payload.shippingData?.singleItem?.recommendedBox || "—",
          createdAt: Date.now(),
          shopifyHandle: null // set after publish
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
      <div className="cols">
        <div className="card">
          <p className="label">1) Upload product image</p>
          <div className="dropzone">
            {preview ? <img src={preview} alt="preview" className="preview" /> : (
              <div className="dz-empty">
                <Upload size={28} />
                <p className="muted">Drag & drop or choose a JPG/PNG (under 5MB)</p>
              </div>
            )}
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            <div className="row gap">
              <button className="btn" onClick={handleChoose}>Choose file</button>
              <button className="btn primary" disabled={!file || status === "uploading" || status === "processing"} onClick={handleUpload}>
                {status === "processing" ? "Analyzing..." : "Analyze with AI"}
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <p className="label">2) Status</p>
          <ol className="status">
            {[
              { key: "uploading", label: "Processing image..." },
              { key: "processing", label: "🧠 Gemini Vision analyzing product" },
              { key: "ready", label: "Analysis complete!" },
            ].map(({ key, label }) => (
              <li key={key} className={`status-row ${status === key ? "active" : status === "idle" || status === "error" ? "" : "dim"}`}>
                <span className={`dot ${status === key ? "pulse" : ""}`} />
                <span className={`status-text ${status === key ? "bold" : ""}`}>{label}</span>
              </li>
            ))}
          </ol>

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

          {status === "ready" && analysisResult && (
            <AnalysisResults result={analysisResult} processingTime={processingTime} />
          )}

          {status === "processing" && (
            <div className="result" style={{background: '#f0f9ff', borderColor: '#0ea5e9'}}>
              <p className="result-title">🧠 AI is analyzing your product...</p>
              <p style={{margin: '8px 0', fontSize: '14px', color: '#0369a1'}}>
                Gemini Vision is extracting product details, generating content, and optimizing shipping. This usually takes 5–15 seconds.
              </p>
            </div>
          )}
        </div>
      </div>
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

// ========= Root =========
export default function App() {
  const { route, nav } = useHashRoute("home");
  const authed = Boolean(getAuth());

  return (
    <div className="app">
      <Nav onNav={nav} route={route} />
      {route === "home" && <HomePage onStart={() => nav("upload")} />}
      {route === "upload" && <UploadPage />}
      {route === "login" && <LoginPage onLoggedIn={() => nav("dashboard")} />}
      {route === "dashboard" && (authed ? <DashboardPage onLogout={() => { clearAuth(); nav("login"); }} /> : <LoginPage onLoggedIn={() => nav("dashboard")} />)}
      <Footer />
    </div>
  );
}
