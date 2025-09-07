# 🍴 Forkcast - Your Personal Meal Planning Companion

Forkcast is a modern meal planning app built with Next.js 15, Supabase (PostgreSQL), and AI-powered suggestions. Create, share, and discover amazing meal ideas with photos, ingredients, and step-by-step cooking instructions. Features intelligent meal planning calendar with drag-and-drop functionality.

## ✨ Features

### Core Features ✅
- **User Authentication**: Secure JWT-based registration and login with password visibility toggle
- **Meal Management**: Create, edit, delete, and organize your meal ideas with gallery support
- **Photo Upload**: High-quality image uploads via Cloudinary integration + placeholder images
- **Meal Discovery**: Browse and search meals from other users with smart duplicate filtering
- **Weekly Meal Planner**: Interactive calendar with drag-and-drop meal scheduling
- **Responsive Design**: Beautiful UI built with Radix UI components and mobile-optimized layout

### Enhanced User Experience 🎨
- **Password Visibility Toggle**: Eye/EyeOff icons to show/hide passwords during login/registration
- **Placeholder Images**: Beautiful ChefHat icon placeholders for meals without photos
- **Smart Duplicate Filtering**: Copied community meals automatically hidden from discovery
- **Button Layout**: Vertical button arrangement for better mobile experience
- **Gallery Support**: Multiple image uploads with thumbnail navigation
- **Drag & Drop**: Intuitive meal scheduling by dragging meals to calendar slots

### AI-Powered Features 🤖
- **Enhanced AI Ideas Section**: Generates draggable meal cards from AI suggestions
- **Interactive Meal Planning**: Drag AI-generated meals directly to weekly calendar
- **Personalized Suggestions**: Based on ingredients, dietary preferences, and cuisine styles
- **AI Meal Categories**: Support for breakfast, lunch, dinner, snacks, desserts, and appetizers
- **Contextual Recommendations**: Smart suggestions based on user preferences and available ingredients

### Community Features 👥
- **Meal Sharing**: Share your creations with the Forkcast community
- **Community Discovery**: Browse meals from other users with attribution
- **Smart Copy System**: "Add to My Meal Plan" with automatic duplicate prevention
- **User Attribution**: Clear meal ownership with "by username" badges
- **Clean Data**: Production-ready with test data cleanup procedures

### Technical Features 🛠️
- **Next.js 15**: Latest version with App Router and React Server Components
- **Supabase**: PostgreSQL database with real-time capabilities
- **Cloudinary**: Professional image hosting and optimization
- **JWT Authentication**: Secure token-based authentication with proper error handling
- **Emergent LLM**: AI-powered meal suggestions using advanced language models
- **DND Kit**: Professional drag-and-drop functionality with accessibility support

## 🚀 Quick Start

### Environment Setup

1. **Clone and install dependencies:**
```bash
cd /app
yarn install
```

2. **Environment Variables:**
Create or verify your `.env` file contains:
```env
# Database (Supabase PostgreSQL)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

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

3. **Database Setup (Supabase):**
Execute the following SQL commands in your Supabase SQL editor:
```sql
-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create meals table
CREATE TABLE IF NOT EXISTS meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  ingredients TEXT NOT NULL,
  instructions TEXT NOT NULL,
  image_url TEXT,
  gallery_images JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create meal_plans table for calendar functionality
CREATE TABLE IF NOT EXISTS meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  meal_id UUID REFERENCES meals(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  meal_type VARCHAR(20) NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date, meal_type)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_meals_user_id ON meals(user_id);
CREATE INDEX IF NOT EXISTS idx_meals_created_at ON meals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meal_plans_user_date ON meal_plans(user_id, date);
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
   - Use the password visibility toggle (eye icon) to show/hide your password
2. **Explore**: Browse meals from other users in the "Discover" tab
   - Meals you've copied from other users won't appear as duplicates
3. **Create**: Add your own meals with photos, ingredients, and instructions
   - Upload multiple images for a meal gallery
   - Meals without photos show beautiful placeholder images
4. **Plan**: Use the "AI Ideas" tab for intelligent meal planning
   - Drag AI-generated meals directly to your weekly calendar
5. **Schedule**: Organize meals using the Weekly Planner calendar
   - Drag and drop meals to specific days and meal times

### Adding a Meal
1. Click "Add Meal" button (+ icon in header or tabs)
2. Fill in meal details:
   - **Title**: Give your meal a catchy name
   - **Photo**: Upload a high-quality image (optional - placeholder will show if none)
   - **Gallery**: Add multiple images to create a photo gallery
   - **Ingredients**: List all ingredients, one per line
   - **Instructions**: Step-by-step cooking instructions
3. Click "Create Meal" to save
4. Meals appear in your "My Meals" tab and are available for planning

### Enhanced AI Meal Suggestions
1. Go to the "AI Ideas" tab in the meal planning section
2. Fill out the AI suggestion form:
   - **Prompt**: Describe what you're looking for (required)
   - **Ingredients**: List ingredients you have available
   - **Dietary Preferences**: Select from vegetarian, vegan, keto, etc.
   - **Cuisine Style**: Choose from Italian, Mexican, Indian, etc.
   - **Meal Type**: Select breakfast, lunch, dinner, snack, etc.
3. Click "Get AI Meal Suggestions" for personalized ideas
4. **New Features**:
   - AI suggestions appear as interactive, draggable meal cards
   - Drag cards directly to calendar slots for instant meal planning
   - Click "Add to My Recipes" to permanently save AI meals
   - Switch seamlessly between AI Ideas and Weekly Planner tabs

### Weekly Meal Planning
1. Navigate to the meal planning section and select "Weekly Planner"
2. **Drag & Drop**: Drag meals from the meal selector to calendar slots
3. **Calendar Navigation**: Use Previous/Next Week buttons to plan ahead
4. **Meal Types**: Schedule breakfast, lunch, and dinner for each day
5. **Community Integration**: Toggle "Show Community" to see meals from other users
6. **Persistence**: Your meal plans are automatically saved and persist across sessions

## 🏗️ Architecture

### Frontend
- **Framework**: Next.js 15 with App Router
- **Styling**: Tailwind CSS + Radix UI components
- **Icons**: Lucide React
- **Notifications**: Sonner for toast messages
- **Image Upload**: Direct Cloudinary integration

### Backend
- **API Routes**: Next.js API routes with comprehensive catch-all routing
- **Database**: Supabase (PostgreSQL) with real-time capabilities and MongoDB-style interface
- **Authentication**: JWT tokens with bcryptjs hashing and secure session management
- **File Upload**: Cloudinary integration with validation and error handling
- **AI Integration**: Emergent LLM with OpenAI-compatible API for advanced meal suggestions
- **Drag & Drop**: Server-side meal plan persistence with calendar integration

### Database Schema (Supabase PostgreSQL)

#### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Meals Table
```sql
CREATE TABLE meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  ingredients TEXT NOT NULL,
  instructions TEXT NOT NULL,
  image_url TEXT,
  gallery_images JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Meal Plans Table (Calendar Functionality)
```sql
CREATE TABLE meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  meal_id UUID REFERENCES meals(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  meal_type VARCHAR(20) NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date, meal_type)
);
```

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration with validation
- `POST /api/auth/login` - User login with JWT generation
- `GET /api/users/me` - Get current user info (authenticated)

### Meals
- `GET /api/meals` - Get all meals (with optional filters and pagination)
- `POST /api/meals` - Create new meal with gallery support
- `GET /api/meals/{id}` - Get specific meal with user details
- `PUT /api/meals/{id}` - Update meal (owner only)
- `DELETE /api/meals/{id}` - Delete meal with Cloudinary cleanup (owner only)
- `GET /api/meals?userId={id}` - Get meals by specific user

### Meal Planning (New)
- `GET /api/meal-plans` - Get meal plans for date range
- `POST /api/meal-plans` - Create/update meal plan for specific date and meal type
- `DELETE /api/meal-plans` - Remove meal from plan

### File Upload
- `POST /api/upload` - Upload image to Cloudinary with validation

### AI Features
- `POST /api/meal-suggestions` - Get AI-powered meal suggestions with enhanced parsing

## 🎨 UI Components

### Enhanced Components
- `AuthForm` - Login/registration form with password visibility toggle
- `MealCard` - Meal display card with gallery navigation and placeholder images
- `MealForm` - Create/edit meal form with multi-image upload support
- `MealPlanningCalendar` - Interactive weekly calendar with drag-and-drop
- `MealSuggestions` - Enhanced AI interface with draggable meal cards
- `ImageUpload` - Cloudinary single image upload component
- `GalleryUpload` - Multiple image upload with thumbnail preview

### New Components
- `MealSuggestionForm` - AI meal suggestion form with dietary preferences
- Enhanced meal selector dialogs with community integration
- Placeholder image components with ChefHat icons
- Drag-and-drop meal cards with visual feedback

### Design System
- **Colors**: Semantic color system with dark mode support and consistent theming
- **Typography**: Inter font family for clean readability across all devices
- **Layout**: Responsive grid system with mobile-first approach and flexible components
- **Interactions**: Smooth animations, hover effects, and drag-and-drop visual feedback
- **Accessibility**: Keyboard navigation, screen reader support, and ARIA labels
- **Placeholders**: Consistent placeholder images with cooking-themed icons

## 🔒 Security Features

- **Password Hashing**: bcryptjs with salt rounds for secure password storage
- **JWT Tokens**: Secure authentication with 7-day expiry and proper validation
- **Input Validation**: Comprehensive validation on both client and server sides
- **File Upload Security**: Type, size, and format validation for images
- **CORS Configuration**: Proper cross-origin resource sharing setup
- **SQL Injection Prevention**: Parameterized queries and proper sanitization
- **XSS Protection**: Input sanitization and output encoding
- **Rate Limiting**: API endpoint protection against abuse

## 🌟 Advanced Features

### Enhanced Search & Filter
- Full-text search across meal titles, ingredients, and instructions
- Smart duplicate filtering to prevent showing copied community meals
- Filter by user, dietary preferences, and cuisine types with real-time results
- Community meal discovery with attribution and ownership indicators

### Professional Image Management
- Automatic image compression and optimization via Cloudinary
- Multiple size variants for different use cases (thumbnails, full-size, etc.)
- WebP format support for modern browsers
- Gallery support with thumbnail navigation
- **New**: Beautiful placeholder images with ChefHat icons for meals without photos

### Advanced AI Integration
- Context-aware meal suggestions with enhanced parsing
- Dietary restriction support (vegetarian, vegan, keto, gluten-free, etc.)
- Ingredient-based recommendations with availability checking
- Multiple cuisine style support (Italian, Mexican, Indian, Thai, etc.)
- **New**: Interactive draggable AI meal cards for instant meal planning
- **New**: Direct integration with weekly meal planning calendar

### Interactive Meal Planning
- **New**: Weekly calendar view with visual meal scheduling
- **New**: Drag-and-drop functionality for intuitive meal planning
- **New**: Persistent meal plans that sync across devices
- **New**: Community meal integration with smart filtering
- **New**: Meal type organization (breakfast, lunch, dinner)
- **New**: Calendar navigation with week-by-week planning

## 🧹 Data Management & Cleanup

### Production Data Quality
- **Test Data Cleanup**: Automated scripts to remove test/debug accounts
- **User Data Validation**: Proper input validation and sanitization
- **Database Integrity**: Foreign key constraints and data consistency checks
- **Performance Optimization**: Indexed queries and efficient data retrieval

### Development Tools
- **Cleanup Scripts**: Available for removing test data from production
- **Database Migrations**: SQL scripts for easy database setup
- **Data Validation**: Server-side validation for all user inputs
- **Error Handling**: Comprehensive error handling with user-friendly messages

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