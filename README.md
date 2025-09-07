# 🍴 Forkcast - Your Personal Meal Planning Companion

Forkcast is a modern meal planning app built with Next.js 15, MongoDB, and AI-powered suggestions. Create, share, and discover amazing meal ideas with photos, ingredients, and step-by-step cooking instructions.

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
- **Next.js 15**: Latest version with App Router
- **MongoDB**: NoSQL database for flexible data storage
- **Cloudinary**: Professional image hosting and optimization
- **JWT Authentication**: Secure token-based authentication
- **Emergent LLM**: AI-powered meal suggestions using GPT-4

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- MongoDB running locally or a MongoDB Atlas account
- Cloudinary account (free tier available)

### Environment Setup

1. **Clone and install dependencies:**
```bash
cd /app
yarn install
```

2. **Environment Variables:**
Create or verify your `.env` file contains:
```env
# Database
MONGO_URL=mongodb://localhost:27017
DB_NAME=forkcast

# Application
NEXT_PUBLIC_BASE_URL=https://forkcast-planner.preview.emergentagent.com
JWT_SECRET=your_super_secret_jwt_key_for_forkcast_app_2024

# Cloudinary (Image Upload)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=dfdyheeak
CLOUDINARY_API_KEY=679475337779761
CLOUDINARY_API_SECRET=GjSftW8JgQPpgx_Y2jayaazoSoM
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=Forkcast

# AI Features
EMERGENT_LLM_KEY=sk-emergent-592094f3002F7B1005
```

3. **Start the development server:**
```bash
# For local development
yarn dev

# Or with custom configuration
NODE_OPTIONS='--max-old-space-size=512' next dev --hostname 0.0.0.0 --port 3000
```

4. **Open your browser:**
Navigate to `http://localhost:3000`

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
- **Framework**: Next.js 15 with App Router
- **Styling**: Tailwind CSS + Radix UI components
- **Icons**: Lucide React
- **Notifications**: Sonner for toast messages
- **Image Upload**: Direct Cloudinary integration

### Backend
- **API Routes**: Next.js API routes with catch-all routing
- **Database**: MongoDB with native driver
- **Authentication**: JWT tokens with bcryptjs hashing
- **File Upload**: Cloudinary integration with validation
- **AI Integration**: OpenAI-compatible API via Emergent LLM

### Database Schema

#### Users Collection
```javascript
{
  id: "uuid",
  username: "string",
  password: "hashed_string",
  createdAt: "date"
}
```

#### Meals Collection
```javascript
{
  id: "uuid",
  userId: "uuid",
  title: "string",
  ingredients: "string",
  instructions: "string",
  imageUrl: "string|null",
  createdAt: "date",
  updatedAt: "date"
}
```

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/users/me` - Get current user info

### Meals
- `GET /api/meals` - Get all meals (with optional filters)
- `POST /api/meals` - Create new meal
- `GET /api/meals/{id}` - Get specific meal
- `PUT /api/meals/{id}` - Update meal (owner only)
- `DELETE /api/meals/{id}` - Delete meal (owner only)

### File Upload
- `POST /api/upload` - Upload image to Cloudinary

### AI Features
- `POST /api/meal-suggestions` - Get AI-powered meal suggestions

## 🎨 UI Components

### Key Components
- `AuthForm` - Login/registration form with validation
- `MealCard` - Meal display card with actions
- `MealForm` - Create/edit meal form with image upload
- `ImageUpload` - Cloudinary image upload component
- `MealSuggestions` - AI-powered meal suggestion interface

### Design System
- **Colors**: Semantic color system with dark mode support
- **Typography**: Inter font family for clean readability
- **Layout**: Responsive grid system with mobile-first approach
- **Interactions**: Smooth animations and hover effects

## 🔒 Security Features

- **Password Hashing**: bcryptjs with salt rounds
- **JWT Tokens**: Secure authentication with 7-day expiry
- **Input Validation**: Comprehensive validation on both client and server
- **File Upload Security**: Type and size validation for images
- **CORS Configuration**: Proper cross-origin resource sharing setup

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

## 🐛 Troubleshooting

### Common Issues

1. **"JSON parsing error" when creating meals**
   - Ensure all required fields are filled
   - Check network connectivity
   - Verify API endpoints are accessible

2. **Image upload fails**
   - Check Cloudinary credentials in `.env`
   - Ensure image is under 10MB
   - Verify image format is supported (JPG, PNG, GIF, WebP)

3. **AI suggestions not working**
   - Verify `EMERGENT_LLM_KEY` is set correctly
   - Check internet connectivity
   - Ensure prompt is descriptive enough

### Development Tips

1. **MongoDB Connection Issues**
   ```bash
   # Start MongoDB locally
   mongod --dbpath /path/to/your/db
   ```

2. **Clear Browser Data**
   - Clear localStorage if experiencing auth issues
   - Hard refresh the page (Ctrl+F5)

3. **Check Logs**
   ```bash
   # View Next.js logs
   yarn dev
   
   # Check supervisor logs (production)
   sudo supervisorctl status
   ```

## 🚀 Deployment

The app is currently deployed and accessible at:
**https://forkcast-planner.preview.emergentagent.com**

For local deployment, ensure all environment variables are properly configured and MongoDB is accessible.

## 🤝 Contributing

This is a complete MVP with all requested features:
- ✅ User management with authentication
- ✅ Meal creation with photo upload
- ✅ Meal browsing and discovery
- ✅ AI-powered meal suggestions
- ✅ Beautiful, responsive UI
- ✅ Production-ready code

## 📄 License

Built for personal meal planning and sharing. Enjoy cooking! 🍽️

---

**Happy Cooking with Forkcast! 🍴✨**