# 🍴 Forkcast - Your Personal Meal Planning Companion

Forkcast is a modern meal planning app built with Next.js, Supabase (Postgres), Cloudinary, and AI-powered suggestions. Create, share, and discover amazing meal ideas with photos, ingredients, and step-by-step cooking instructions.

> 📚 Looking for setup, API reference, service explanations, or debugging help? See the [`docs/`](./docs) folder.

## ✨ Features

### Core Features ✅
- **User Authentication**: Secure JWT-based registration and login
- **Meal Management**: Create, edit, delete, and organize your meal ideas
- **Photo Upload**: High-quality image uploads via Cloudinary integration
- **Meal Discovery**: Browse and search meals from other users
- **Responsive Design**: Beautiful UI built with Radix UI components

### AI-Powered Features 🤖
- **AI Meal Suggestions**: Get personalized meal ideas based on:
  - Available ingredients
  - Dietary preferences (vegetarian, vegan, keto, etc.)
  - Cuisine preferences (Italian, Mexican, Indian, etc.)
  - Meal type (breakfast, lunch, dinner, snacks)
  - Custom prompts and preferences

### Technical Features 🛠️
- **Next.js 14**: App Router, React Server Components
- **Supabase (Postgres)**: Managed Postgres for relational data storage
- **Cloudinary**: Professional image hosting and optimization
- **JWT Authentication**: Secure token-based authentication
- **Emergent LLM**: AI-powered meal suggestions via an OpenAI-compatible API

## 🎯 How to Use

### Getting Started
1. **Register/Login**: Create a new account or login with existing credentials
2. **Explore**: Browse meals from other users in the "Discover" tab
3. **Create**: Add your own meals with photos, ingredients, and instructions
4. **AI Suggestions**: Get personalized meal ideas in the "AI Ideas" tab

### Adding a Meal
1. Click "Add Meal" button
2. Fill in meal details:
   - **Title**: Give your meal a catchy name
   - **Photo**: Upload a high-quality image (optional)
   - **Ingredients**: List all ingredients, one per line
   - **Instructions**: Step-by-step cooking instructions
3. Click "Create Meal" to save

### AI Meal Suggestions
1. Go to the "AI Ideas" tab
2. Describe what you're looking for
3. Optionally specify:
   - Available ingredients
   - Dietary preferences
   - Cuisine style
   - Meal type
4. Click "Get AI Meal Suggestions" for personalized ideas

## 🏗️ Architecture

### Frontend
- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS + Radix UI components
- **Icons**: Lucide React
- **Notifications**: Sonner for toast messages
- **Image Upload**: Direct Cloudinary integration

### Backend
- **API Routes**: Next.js API routes with catch-all routing (`app/api/[[...path]]/route.js`)
- **Database**: Supabase (Postgres) accessed via `@supabase/supabase-js`
- **Authentication**: JWT tokens with bcryptjs hashing
- **File Upload**: Cloudinary integration with validation
- **AI Integration**: OpenAI-compatible API via Emergent LLM

### Design System
- **Colors**: Semantic color system with dark mode support
- **Typography**: Inter font family for clean readability
- **Layout**: Responsive grid system with mobile-first approach
- **Interactions**: Smooth animations and hover effects

## 🌟 Advanced Features

### Search & Filter
- Full-text search across meal titles, ingredients, and instructions
- Filter by user, dietary preferences, and cuisine types
- Real-time search results

### Image Optimization
- Automatic image compression and optimization via Cloudinary
- Multiple size variants for different use cases
- WebP format support for modern browsers

### AI Integration
- Context-aware meal suggestions
- Dietary restriction support
- Ingredient-based recommendations
- Multiple cuisine style support

## 📱 Mobile Responsiveness

Forkcast is fully responsive and works great on:
- Desktop computers (1200px+)
- Tablets (768px - 1199px)
- Mobile phones (320px - 767px)

---

**Happy Cooking with Forkcast! 🍴✨**
