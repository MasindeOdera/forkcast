# 🚀 Getting Started

This guide walks you through setting up Forkcast for local development.

## Prerequisites
- Node.js 18+ installed
- MongoDB running locally or a MongoDB Atlas account
- Cloudinary account (free tier available)

## Environment Setup

### 1. Clone and install dependencies

```bash
cd /app
yarn install
```

### 2. Environment Variables

Create or verify your `.env` file contains:

```env
# Database
MONGO_URL=mongodb://localhost:27017
DB_NAME=forkcast

# Application
NEXT_PUBLIC_BASE_URL=https://your-deployment-url.example.com
JWT_SECRET=your_super_secret_jwt_key_for_forkcast_app_2024

# Cloudinary (Image Upload)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=Forkcast

# AI Features
EMERGENT_LLM_KEY=your_emergent_llm_key
```

> ⚠️ Never commit real secrets to source control. The values above are placeholders.

### 3. Start the development server

```bash
# For local development
yarn dev

# Or with custom configuration
NODE_OPTIONS='--max-old-space-size=512' next dev --hostname 0.0.0.0 --port 3000
```

### 4. Open your browser

Navigate to `http://localhost:3000`
