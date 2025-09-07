import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/supabase-db';
import { hashPassword, verifyPassword, generateToken, getUserFromToken } from '@/lib/auth';
import { MealSuggestionService } from '@/lib/llm-service';
import cloudinary from '@/lib/cloudinary';
import { v4 as uuidv4 } from 'uuid';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Handle OPTIONS request for CORS
export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

// Helper function to add CORS headers to responses
function withCors(response) {
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

export async function GET(request, { params }) {
  try {
    const { db } = await connectToDatabase();
    const path = params.path?.join('/') || '';
    const url = new URL(request.url);

    if (path === 'users/me') {
      const user = getUserFromToken(request);
      if (!user) {
        return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
      }
      
      const userData = await db.collection('users').findOne(
        { id: user.userId }
      );
      
      if (!userData) {
        return withCors(NextResponse.json({ error: 'User not found' }, { status: 404 }));
      }
      
      // Manually exclude password field for security
      const { password, ...userDataWithoutPassword } = userData;
      
      return withCors(NextResponse.json(userDataWithoutPassword));
    }

    if (path === 'meals') {
      const user = getUserFromToken(request);
      const skip = parseInt(url.searchParams.get('skip') || '0');
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const search = url.searchParams.get('search') || '';
      const userId = url.searchParams.get('userId');

      let query = {};
      
      // If userId is specified, get meals for that specific user
      if (userId) {
        query.userId = userId;
      }
      
      // Add search functionality
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { ingredients: { $regex: search, $options: 'i' } },
          { instructions: { $regex: search, $options: 'i' } }
        ];
      }

      try {
        const mealsResult = await db.collection('meals').find(query);
        
        // Handle both array response and MongoDB-style chaining
        let meals;
        if (Array.isArray(mealsResult)) {
          meals = mealsResult.slice(skip, skip + limit);
        } else if (mealsResult.sort) {
          meals = await mealsResult
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .toArray();
        } else {
          // Fallback for other response types
          meals = [];
        }

        return withCors(NextResponse.json(meals));
      } catch (error) {
        console.error('Error fetching meals:', error);
        return withCors(NextResponse.json({ 
          error: 'Failed to fetch meals',
          details: error.message 
        }, { status: 500 }));
      }
    }

    if (path === 'meal-plans') {
      const user = getUserFromToken(request);
      if (!user) {
        return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
      }

      const startDate = url.searchParams.get('startDate');
      const endDate = url.searchParams.get('endDate');
      const includeOthers = url.searchParams.get('includeOthers') === 'true';

      try {
        let query = {};
        
        if (!includeOthers) {
          query.userId = user.userId;
        }
        
        if (startDate && endDate) {
          query.dateRange = { start: startDate, end: endDate };
        }

        const mealPlans = await db.collection('meal_plans').find(query);
        
        // Add ownership information
        const mealPlansWithOwnership = mealPlans.map(plan => ({
          ...plan,
          isOwn: plan.userId === user.userId
        }));
        
        return withCors(NextResponse.json(mealPlansWithOwnership));
      } catch (error) {
        console.error('Error fetching meal plans:', error);
        return withCors(NextResponse.json({ 
          error: 'Failed to fetch meal plans',
          details: error.message 
        }, { status: 500 }));
      }
    }

    if (path.startsWith('meals/') && path.split('/').length === 2) {
      const mealId = path.split('/')[1];
      const meal = await db.collection('meals').findOne({ id: mealId });
      
      if (!meal) {
        return withCors(NextResponse.json({ error: 'Meal not found' }, { status: 404 }));
      }

      // Get user info
      const userData = await db.collection('users').findOne(
        { id: meal.userId },
        { projection: { id: 1, username: 1 } }
      );

      const mealWithUser = {
        ...meal,
        user: userData || { username: 'Unknown User' }
      };

      return withCors(NextResponse.json(mealWithUser));
    }

    return withCors(NextResponse.json({ error: 'Not found' }, { status: 404 }));
    
  } catch (error) {
    console.error('GET Error:', error);
    return withCors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }));
  }
}

export async function POST(request, { params }) {
  try {
    const { db } = await connectToDatabase();
    const path = params.path?.join('/') || '';

    if (path === 'auth/register') {
      const { username, password } = await request.json();
      
      if (!username || !password) {
        return withCors(NextResponse.json({ error: 'Username and password are required' }, { status: 400 }));
      }

      if (password.length < 6) {
        return withCors(NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 }));
      }

      // Check if user already exists
      const existingUser = await db.collection('users').findOne({ username });
      if (existingUser) {
        return withCors(NextResponse.json({ error: 'Username already exists' }, { status: 400 }));
      }

      // Create user - fix the date field name to match Supabase schema
      const hashedPassword = await hashPassword(password);
      const userId = uuidv4();
      
      const user = {
        id: userId,
        username,
        password: hashedPassword,
        created_at: new Date(), // Changed from createdAt to created_at
      };

      await db.collection('users').insertOne(user);

      // Generate token
      const token = generateToken(userId, username);

      return withCors(NextResponse.json({
        token,
        user: {
          id: userId,
          username,
          createdAt: user.created_at // Return as createdAt for frontend consistency
        }
      }));
    }

    if (path === 'auth/login') {
      const { username, password } = await request.json();
      
      if (!username || !password) {
        return withCors(NextResponse.json({ error: 'Username and password are required' }, { status: 400 }));
      }

      // Find user
      const user = await db.collection('users').findOne({ username });
      if (!user) {
        return withCors(NextResponse.json({ error: 'Invalid credentials' }, { status: 401 }));
      }

      // Verify password
      const isValidPassword = await verifyPassword(password, user.password);
      if (!isValidPassword) {
        return withCors(NextResponse.json({ error: 'Invalid credentials' }, { status: 401 }));
      }

      // Generate token
      const token = generateToken(user.id, user.username);

      return withCors(NextResponse.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          createdAt: user.created_at || user.createdAt
        }
      }));
    }

    if (path === 'meals') {
      const user = getUserFromToken(request);
      if (!user) {
        return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
      }

      let requestData;
      try {
        requestData = await request.json();
      } catch (error) {
        return withCors(NextResponse.json({ 
          error: 'Invalid JSON data. Please check your input and try again.' 
        }, { status: 400 }));
      }

      const { title, ingredients, instructions, imageUrl } = requestData;
      
      // More detailed validation with specific error messages
      const errors = [];
      if (!title || title.trim().length === 0) {
        errors.push('Meal title is required');
      }
      if (!ingredients || ingredients.trim().length === 0) {
        errors.push('Ingredients list is required');
      }
      if (!instructions || instructions.trim().length === 0) {
        errors.push('Cooking instructions are required');
      }
      
      if (errors.length > 0) {
        return withCors(NextResponse.json({ 
          error: 'Please fill in all required fields:', 
          details: errors 
        }, { status: 400 }));
      }

      const mealId = uuidv4();
      const meal = {
        id: mealId,
        userId: user.userId,
        title: title.trim(),
        ingredients: ingredients.trim(),
        instructions: instructions.trim(),
        imageUrl: imageUrl || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      try {
        await db.collection('meals').insertOne(meal);
        return withCors(NextResponse.json(meal));
      } catch (dbError) {
        console.error('Database error:', dbError);
        return withCors(NextResponse.json({ 
          error: 'Failed to save meal. Please try again.' 
        }, { status: 500 }));
      }
    }

    if (path === 'meal-plans') {
      const user = getUserFromToken(request);
      if (!user) {
        return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
      }

      try {
        const { date, mealType, mealId } = await request.json();
        
        if (!date || !mealType || !mealId) {
          return withCors(NextResponse.json({ 
            error: 'Date, meal type, and meal ID are required' 
          }, { status: 400 }));
        }

        const mealPlan = {
          userId: user.userId,
          date,
          mealType,
          mealId
        };

        await db.collection('meal_plans').insertOne(mealPlan);
        return withCors(NextResponse.json({ success: true, mealPlan }));
      } catch (error) {
        console.error('Error creating meal plan:', error);
        return withCors(NextResponse.json({ 
          error: 'Failed to create meal plan',
          details: error.message 
        }, { status: 500 }));
      }
    }

    if (path === 'upload') {
      const user = getUserFromToken(request);
      if (!user) {
        return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
      }

      const formData = await request.formData();
      const file = formData.get('file');
      
      if (!file) {
        return withCors(NextResponse.json({ error: 'No file provided' }, { status: 400 }));
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        return withCors(NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 400 }));
      }

      // Validate file type
      if (!file.type.includes('image')) {
        return withCors(NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 }));
      }

      // Convert file to buffer
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Convert buffer to base64
      const fileStr = buffer.toString('base64');
      const fileUri = `data:${file.type};base64,${fileStr}`;

      // Upload to Cloudinary
      const uploadResult = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload(
          fileUri,
          {
            folder: 'forkcast/meals',
            resource_type: 'image',
            quality: 'auto:eco',
            public_id: `meal-${user.userId}-${Date.now()}`,
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
      });

      return withCors(NextResponse.json({
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        width: uploadResult.width,
        height: uploadResult.height
      }));
    }

    if (path === 'meal-suggestions') {
      const user = getUserFromToken(request);
      if (!user) {
        return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
      }

      try {
        const { prompt, ingredients, dietary, cuisine, mealType } = await request.json();
        
        if (!prompt || prompt.trim().length === 0) {
          return withCors(NextResponse.json({ 
            error: 'Please describe what kind of meal you\'re looking for' 
          }, { status: 400 }));
        }

        const apiKey = process.env.EMERGENT_LLM_KEY;
        if (!apiKey) {
          return withCors(NextResponse.json({ 
            error: 'AI service is not configured' 
          }, { status: 500 }));
        }

        const mealService = new MealSuggestionService(apiKey);
        const suggestions = await mealService.getMealSuggestions(prompt, {
          ingredients,
          dietary,
          cuisine,
          mealType
        });

        return withCors(NextResponse.json({ suggestions }));
      } catch (error) {
        console.error('Meal suggestion error:', error);
        return withCors(NextResponse.json({ 
          error: 'Failed to generate meal suggestions. Please try again.' 
        }, { status: 500 }));
      }
    }

    return withCors(NextResponse.json({ error: 'Not found' }, { status: 404 }));
    
  } catch (error) {
    console.error('POST Error:', error);
    return withCors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }));
  }
}

export async function PUT(request, { params }) {
  try {
    const { db } = await connectToDatabase();
    const path = params.path?.join('/') || '';
    const user = getUserFromToken(request);
    
    if (!user) {
      return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
    }

    if (path.startsWith('meals/') && path.split('/').length === 2) {
      const mealId = path.split('/')[1];
      const { title, ingredients, instructions, imageUrl } = await request.json();
      
      console.log(`DEBUG PUT: mealId=${mealId}, userId=${user.userId}`);
      
      // Check if meal exists and belongs to user
      const existingMeal = await db.collection('meals').findOne({ 
        id: mealId, 
        userId: user.userId 
      });
      
      console.log(`DEBUG PUT: existingMeal found=${!!existingMeal}`);
      if (existingMeal) {
        console.log(`DEBUG PUT: existingMeal.id=${existingMeal.id}, existingMeal.userId=${existingMeal.userId}`);
      }
      
      if (!existingMeal) {
        return withCors(NextResponse.json({ error: 'Meal not found or unauthorized' }, { status: 404 }));
      }

      // Update meal
      const updateData = {
        ...(title && { title }),
        ...(ingredients && { ingredients }),
        ...(instructions && { instructions }),
        ...(imageUrl && { imageUrl }),
        updatedAt: new Date(),
      };

      const result = await db.collection('meals').updateOne(
        { id: mealId, userId: user.userId },
        { $set: updateData }
      );

      if (result.matchedCount === 0) {
        return withCors(NextResponse.json({ error: 'Meal not found' }, { status: 404 }));
      }

      const updatedMeal = await db.collection('meals').findOne({ id: mealId });
      return withCors(NextResponse.json(updatedMeal));
    }

    return withCors(NextResponse.json({ error: 'Not found' }, { status: 404 }));
    
  } catch (error) {
    console.error('PUT Error:', error);
    return withCors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }));
  }
}

export async function DELETE(request, { params }) {
  try {
    const { db } = await connectToDatabase();
    const path = params.path?.join('/') || '';
    const user = getUserFromToken(request);
    
    if (!user) {
      return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
    }

    if (path.startsWith('meals/') && path.split('/').length === 2) {
      const mealId = path.split('/')[1];
      
      // Check if meal exists and belongs to user
      const existingMeal = await db.collection('meals').findOne({ 
        id: mealId, 
        userId: user.userId 
      });
      
      if (!existingMeal) {
        return withCors(NextResponse.json({ error: 'Meal not found or unauthorized' }, { status: 404 }));
      }

      // Delete from Cloudinary if image exists
      if (existingMeal.imageUrl) {
        try {
          // Extract public ID from Cloudinary URL
          const publicId = existingMeal.imageUrl.split('/').pop().split('.')[0];
          await cloudinary.uploader.destroy(`forkcast/meals/${publicId}`);
        } catch (cloudinaryError) {
          console.warn('Failed to delete image from Cloudinary:', cloudinaryError);
        }
      }

      // Delete meal from database
      const result = await db.collection('meals').deleteOne({ 
        id: mealId, 
        userId: user.userId 
      });

      if (result.deletedCount === 0) {
        return withCors(NextResponse.json({ error: 'Meal not found' }, { status: 404 }));
      }

      return withCors(NextResponse.json({ message: 'Meal deleted successfully' }));
    }

    if (path === 'meal-plans') {
      const user = getUserFromToken(request);
      if (!user) {
        return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
      }

      try {
        const { date, mealType } = await request.json();
        
        if (!date || !mealType) {
          return withCors(NextResponse.json({ 
            error: 'Date and meal type are required' 
          }, { status: 400 }));
        }

        const result = await db.collection('meal_plans').deleteOne({
          userId: user.userId,
          date,
          mealType
        });

        if (result.deletedCount === 0) {
          return withCors(NextResponse.json({ error: 'Meal plan not found' }, { status: 404 }));
        }

        return withCors(NextResponse.json({ message: 'Meal plan removed successfully' }));
      } catch (error) {
        console.error('Error removing meal plan:', error);
        return withCors(NextResponse.json({ 
          error: 'Failed to remove meal plan',
          details: error.message 
        }, { status: 500 }));
      }
    }

    return withCors(NextResponse.json({ error: 'Not found' }, { status: 404 }));
    
  } catch (error) {
    console.error('DELETE Error:', error);
    return withCors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }));
  }
}