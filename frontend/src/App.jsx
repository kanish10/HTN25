import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Upload, Wand2, Box, Zap, CheckCircle, Github, ExternalLink } from "lucide-react";
import "./App.css"; // <- plain CSS

// ------- Tiny hash router -------
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

// ------- Reusable UI -------
const Container = ({ className = "", children }) => (
  <div className={`container ${className}`}>{children}</div>
);

const Nav = ({ onNav, route }) => (
  <header className="nav">
    <Container className="nav-inner">
      <div className="brand">
        <Box size={22} />
        <span className="brand-name">ShopBrain</span>
      </div>
      <nav className="nav-links">
        <button className={`link ${route === "home" ? "active" : ""}`} onClick={() => onNav("home")}>Home</button>
        <button className={`link ${route === "upload" ? "active" : ""}`} onClick={() => onNav("upload")}>Upload</button>
        <a className="pill" href="https://github.com/" target="_blank" rel="noreferrer">
          <Github size={14} /> Repo
        </a>
      </nav>
    </Container>
  </header>
);

const Footer = () => (
  <footer className="footer">
    <Container className="footer-inner">
      <p>© {new Date().getFullYear()} ShopBrain. Built at Hack the North.</p>
      <p className="made-with">
        <span className="chip">AI ✨</span>
      </p>
    </Container>
  </footer>
);

// ------- Pages -------
const HomePage = ({ onStart }) => (
  <>
    <section className="hero">
      <Container className="hero-grid">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="hero-title">
            AI-Powered Product Listing & Shipping Optimization
          </h1>
          <p className="hero-sub">
            Drop in a product photo. ShopBrain drafts your title, description, SEO,
            and recommends the cheapest box that fits—then publishes to Shopify.
          </p>
          <div className="hero-actions">
            <button className="btn primary" onClick={onStart}>
              <Upload size={16} /> Try the Uploader
            </button>
            <a className="btn ghost" href="#upload" onClick={onStart}>
              See how it works <ExternalLink size={16} />
            </a>
          </div>
          <ul className="benefits">
            <li><CheckCircle size={16} /> 30–60 min → ~30 sec per product</li>
            <li><CheckCircle size={16} /> 20–40% lower shipping with better box picks</li>
            <li><CheckCircle size={16} /> A/B titles & SEO tags included</li>
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="card stack">
            <div className="row">
              <div className="icon-box"><Wand2 size={18} /></div>
              <div>
                <p className="row-title">From photo → listing</p>
                <p className="row-sub">Title, bullets, FAQ, SEO in one go.</p>
              </div>
            </div>
            <div className="row">
              <div className="icon-box"><Box size={18} /></div>
              <div>
                <p className="row-title">Smart box pick</p>
                <p className="row-sub">Cheapest box that fits—dim weight aware.</p>
              </div>
            </div>
            <div className="row">
              <div className="icon-box"><Zap size={18} /></div>
              <div>
                <p className="row-title">One-click publish</p>
                <p className="row-sub">Push to Shopify with metafields.</p>
              </div>
            </div>
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
              <p className="card-sub">
                {[
                  "Drop a product image (JPG/PNG).",
                  "AI drafts title, bullets, FAQ and picks a box.",
                  "Review → Publish to Shopify in one click.",
                ][i]}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  </>
);

const UploadPage = () => {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | uploading | processing | ready
  const [preview, setPreview] = useState(null);

  const handleChoose = () => inputRef.current?.click();
  const onFile = (f) => {
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleUpload = async () => {
    if (!file) return;
    setStatus("uploading");
    await new Promise((r) => setTimeout(r, 600));
    setStatus("processing");
    await new Promise((r) => setTimeout(r, 1200));
    setStatus("ready");
  };

  return (
    <Container className="upload">
      <div className="cols">
        <div className="card">
          <p className="label">1) Upload product image</p>
          <div className="dropzone">
            {preview ? (
              <img src={preview} alt="preview" className="preview" />
            ) : (
              <div className="dz-empty">
                <Upload size={28} />
                <p className="muted">Drag & drop or choose a JPG/PNG (under 5MB)</p>
              </div>
            )}

            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <div className="row gap">
              <button className="btn" onClick={handleChoose}>Choose file</button>
              <button className="btn primary" disabled={!file || status === "uploading"} onClick={handleUpload}>
                Upload
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <p className="label">2) Status</p>
          <ol className="status">
            {[
              { key: "uploading", label: "Uploading to storage" },
              { key: "processing", label: "Analyzing & generating content" },
              { key: "ready", label: "Ready to publish" },
            ].map(({ key, label }) => (
              <li key={key} className={`status-row ${status === key ? "active" : status === "idle" ? "" : "dim"}`}>
                <span className={`dot ${status === key ? "pulse" : ""}`} />
                <span className={`status-text ${status === key ? "bold" : ""}`}>{label}</span>
              </li>
            ))}
          </ol>

          {status === "ready" && (
            <div className="result">
              <p className="result-title">Draft results</p>
              <ul className="bullets">
                <li>Title: Premium Canvas Tote Bag — Everyday Carry</li>
                <li>Bullets: Lightweight • Zipper • Interior pocket • Durable canvas • 16×14×4 in</li>
                <li>Recommended box: Medium Mailer (cheapest)</li>
              </ul>
              <div className="row gap">
                <button className="btn primary">Publish to Shopify</button>
                <button className="btn">Edit details</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Container>
  );
};

// ------- Root -------
export default function App() {
  const { route, nav } = useHashRoute("home");
  return (
    <div className="app">
      <Nav onNav={nav} route={route} />
      {route === "home" ? <HomePage onStart={() => nav("upload")} /> : <UploadPage />}
      <Footer />
    </div>
  );
}
