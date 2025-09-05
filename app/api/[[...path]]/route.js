import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { hashPassword, verifyPassword, generateToken, getUserFromToken } from '@/lib/auth';
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
        { id: user.userId },
        { projection: { password: 0 } }
      );
      
      if (!userData) {
        return withCors(NextResponse.json({ error: 'User not found' }, { status: 404 }));
      }
      
      return withCors(NextResponse.json(userData));
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

      const meals = await db.collection('meals')
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();

      // Get user info for each meal
      const mealsWithUsers = await Promise.all(
        meals.map(async (meal) => {
          const userData = await db.collection('users').findOne(
            { id: meal.userId },
            { projection: { id: 1, username: 1 } }
          );
          return {
            ...meal,
            user: userData || { username: 'Unknown User' }
          };
        })
      );

      return withCors(NextResponse.json(mealsWithUsers));
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

    if (path === 'meals') {
      const user = getUserFromToken(request);
      if (!user) {
        return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
      }

      const { title, ingredients, instructions, imageUrl } = await request.json();
      
      if (!title || !ingredients || !instructions) {
        return withCors(NextResponse.json({ error: 'Title, ingredients, and instructions are required' }, { status: 400 }));
      }

      const mealId = uuidv4();
      const meal = {
        id: mealId,
        userId: user.userId,
        title,
        ingredients,
        instructions,
        imageUrl: imageUrl || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.collection('meals').insertOne(meal);

      return withCors(NextResponse.json(meal));
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

    return withCors(NextResponse.json({ error: 'Not found' }, { status: 404 }));
    
  } catch (error) {
    console.error('DELETE Error:', error);
    return withCors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }));
  }
}