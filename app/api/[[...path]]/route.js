import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { hashPassword, verifyPassword, generateToken, getUserFromToken } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

// Only import cloudinary if configured
let cloudinary = null;
try {
  if (process.env.CLOUDINARY_CLOUD_NAME) {
    cloudinary = require('@/lib/cloudinary').default;
  }
} catch (e) {
  console.log('Cloudinary not configured');
}

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

    if (path === 'health') {
      return withCors(NextResponse.json({ status: 'ok', database: 'connected' }));
    }

    if (path === 'users/me') {
      const user = getUserFromToken(request);
      if (!user) {
        return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
      }
      
      const userData = await db.collection('users').findOne({ id: user.userId });
      
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
        const meals = await db.collection('meals')
          .find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .toArray();

        // Get user info for each meal
        const mealsWithUser = await Promise.all(meals.map(async (meal) => {
          const mealUser = await db.collection('users').findOne(
            { id: meal.userId },
            { projection: { id: 1, username: 1 } }
          );
          return {
            ...meal,
            user: mealUser || { username: 'Unknown User' }
          };
        }));

        return withCors(NextResponse.json(mealsWithUser));
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
          query.date = { $gte: startDate, $lte: endDate };
        }

        const mealPlans = await db.collection('meal_plans').find(query).toArray();
        
        // Get meal details for each plan
        const mealPlansWithDetails = await Promise.all(mealPlans.map(async (plan) => {
          const meal = await db.collection('meals').findOne({ id: plan.mealId });
          return {
            ...plan,
            meal: meal || null,
            isOwn: plan.userId === user.userId
          };
        }));
        
        return withCors(NextResponse.json(mealPlansWithDetails));
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
    return withCors(NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 }));
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

      // Create user
      const hashedPassword = await hashPassword(password);
      const userId = uuidv4();
      
      const user = {
        id: userId,
        username,
        password: hashedPassword,
        createdAt: new Date(),
      };

      await db.collection('users').insertOne(user);

      // Generate token
      const token = generateToken(userId, username);

      return withCors(NextResponse.json({
        token,
        user: {
          id: userId,
          username,
          createdAt: user.createdAt
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
          createdAt: user.createdAt
        }
      }));
    }

    // Admin password reset endpoint
    if (path === 'admin/reset-password') {
      const { adminKey, username, newPassword } = await request.json();
      
      // Verify admin key
      const validAdminKey = process.env.ADMIN_RESET_KEY || 'forkcast-admin-reset-2024';
      if (adminKey !== validAdminKey) {
        return withCors(NextResponse.json({ error: 'Invalid admin key' }, { status: 403 }));
      }

      if (!username || !newPassword) {
        return withCors(NextResponse.json({ error: 'Username and new password are required' }, { status: 400 }));
      }

      if (newPassword.length < 6) {
        return withCors(NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 }));
      }

      // Find user
      const user = await db.collection('users').findOne({ username });
      if (!user) {
        return withCors(NextResponse.json({ error: 'User not found' }, { status: 404 }));
      }

      // Hash new password and update
      const hashedPassword = await hashPassword(newPassword);
      await db.collection('users').updateOne(
        { username },
        { $set: { password: hashedPassword, updatedAt: new Date() } }
      );

      return withCors(NextResponse.json({ 
        message: `Password reset successful for user: ${username}` 
      }));
    }

    // Password reset request from users (stores request for admin to review)
    if (path === 'password-reset-request') {
      const { username, message } = await request.json();
      
      if (!username || username.trim().length === 0) {
        return withCors(NextResponse.json({ error: 'Username is required' }, { status: 400 }));
      }

      // Check if user exists
      const user = await db.collection('users').findOne({ username: username.trim() });
      if (!user) {
        // Don't reveal if user exists or not for security
        // But still "accept" the request
      }

      // Store the password reset request
      const resetRequest = {
        id: uuidv4(),
        username: username.trim(),
        message: message || '',
        status: 'pending',
        createdAt: new Date(),
      };

      await db.collection('password_reset_requests').insertOne(resetRequest);

      return withCors(NextResponse.json({ 
        message: 'Password reset request submitted successfully. An admin will review your request.' 
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

        // Use upsert to avoid duplicates
        await db.collection('meal_plans').updateOne(
          { userId: user.userId, date, mealType },
          { 
            $set: { 
              userId: user.userId,
              date,
              mealType,
              mealId,
              updatedAt: new Date()
            },
            $setOnInsert: {
              id: uuidv4(),
              createdAt: new Date()
            }
          },
          { upsert: true }
        );

        return withCors(NextResponse.json({ success: true }));
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

      if (!cloudinary) {
        return withCors(NextResponse.json({ error: 'Image upload is not configured' }, { status: 500 }));
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

        // Call the AI service
        try {
          const aiResponse = await fetch('http://localhost:5001/suggest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, ingredients, dietary, cuisine, mealType })
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            return withCors(NextResponse.json({ suggestions: aiData.suggestions }));
          }
        } catch (aiError) {
          console.log('AI service not available, using fallback:', aiError.message);
        }

        // Fallback mock suggestions if AI service is not available
        const mockSuggestions = [
          {
            name: "Mediterranean Quinoa Bowl",
            description: "A healthy and colorful bowl packed with protein and fresh vegetables",
            ingredients: ["1 cup quinoa", "Cherry tomatoes", "Cucumber", "Feta cheese", "Olives", "Red onion", "Olive oil", "Lemon juice"],
            cookingTime: "25 minutes",
            difficulty: "Easy"
          },
          {
            name: "Honey Garlic Glazed Salmon",
            description: "Perfectly seared salmon with a sweet and savory glaze",
            ingredients: ["Salmon fillet", "Honey", "Garlic", "Soy sauce", "Ginger", "Sesame seeds", "Green onions"],
            cookingTime: "20 minutes",
            difficulty: "Medium"
          },
          {
            name: "Creamy Tuscan Chicken",
            description: "Tender chicken in a rich sun-dried tomato and spinach cream sauce",
            ingredients: ["Chicken breast", "Sun-dried tomatoes", "Spinach", "Heavy cream", "Parmesan", "Garlic", "Italian herbs"],
            cookingTime: "30 minutes",
            difficulty: "Medium"
          }
        ];

        return withCors(NextResponse.json({ suggestions: mockSuggestions }));
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
    return withCors(NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 }));
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
      
      // Check if meal exists and belongs to user
      const existingMeal = await db.collection('meals').findOne({ 
        id: mealId, 
        userId: user.userId 
      });
      
      if (!existingMeal) {
        return withCors(NextResponse.json({ error: 'Meal not found or unauthorized' }, { status: 404 }));
      }

      // Update meal
      const updateData = {
        ...(title && { title }),
        ...(ingredients && { ingredients }),
        ...(instructions && { instructions }),
        ...(imageUrl !== undefined && { imageUrl }),
        updatedAt: new Date(),
      };

      await db.collection('meals').updateOne(
        { id: mealId, userId: user.userId },
        { $set: updateData }
      );

      const updatedMeal = await db.collection('meals').findOne({ id: mealId });
      return withCors(NextResponse.json(updatedMeal));
    }

    return withCors(NextResponse.json({ error: 'Not found' }, { status: 404 }));
    
  } catch (error) {
    console.error('PUT Error:', error);
    return withCors(NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 }));
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

      // Delete from Cloudinary if image exists and cloudinary is configured
      if (existingMeal.imageUrl && cloudinary) {
        try {
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
    return withCors(NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 }));
  }
}
