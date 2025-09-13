# 🧠 ShopBrain: AI-Powered Product Listing & Shipping Optimization

ShopBrain transforms a single product image into a complete Shopify listing with optimized shipping calculations in under 30 seconds.

## 🎯 Project Overview

- **Image Analysis**: Gemini Vision extracts product details
- **Smart Content Generation**: Martian routes to optimal LLMs for each content type  
- **Shipping Optimization**: Custom bin-packing algorithm saves 20-40% on shipping
- **A/B Testing**: Generate multiple title/description variants
- **One-Click Publishing**: Direct to Shopify with all metadata

## 🏗️ Project Structure

```
HTN2025/
├── frontend/           # React + Vite frontend
│   ├── src/
│   │   ├── App.js      # Main React component
│   │   ├── App.css     # Styling
│   │   └── main.jsx    # React entry point
│   ├── package.json
│   └── index.html
├── backend/            # Node.js + Express backend
│   ├── src/
│   │   └── server.js   # Express server
│   ├── package.json
│   └── .env.example    # Environment variables template
├── docs/
│   └── database-schema.md  # DynamoDB schema documentation
└── objective.md        # Original project requirements
```

## 🚀 Getting Started

### Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your API keys
npm run dev
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

## 🛠️ Tech Stack

- **Frontend**: React + Vite
- **Backend**: Node.js + Express
- **Storage**: AWS S3 (images) + DynamoDB (metadata)
- **AI**: Gemini Vision + Martian Router + Multiple LLMs
- **Deployment**: Cloudflare Workers/Pages
- **E-commerce**: Shopify Admin API

## 📋 API Endpoints

1. `POST /api/upload` → S3 presigned URL → Store image
2. `POST /api/analyze/:productId` → Gemini Vision → Extract specs → Generate content → Calculate shipping
3. `POST /api/publish/:productId` → Publish to Shopify

## ⚙️ Environment Variables

See `backend/.env.example` for required environment variables:
- AWS credentials
- AI service API keys (Gemini, Martian)
- Shopify store credentials

## 📊 Database Schema

See `docs/database-schema.md` for the complete DynamoDB schema structure.