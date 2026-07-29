import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/supabase-db';
import { hashPassword, verifyPassword, generateToken, getUserFromToken } from '@/lib/auth';
import { MealSuggestionService } from '@/lib/llm-service';
import cloudinary from '@/lib/cloudinary';
import { v4 as uuidv4 } from 'uuid';
import { runLookupChain, runDiagnosis } from '@/lib/barcode-lookup';

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

/**
 * validateIsoDate — strict `YYYY-MM-DD` calendar date validator.
 * Returns an error string if invalid, or null if OK. Catches both
 * malformed strings (e.g. "hello") AND impossible calendars (e.g.
 * "2024-13-45", "2024-02-31") by round-tripping through Date and
 * comparing back to the input.
 *
 * Used by the pantry endpoints for `expiresAt`; safe to reuse anywhere
 * we accept an ISO date without a time component.
 */
function validateIsoDate(input) {
  if (typeof input !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return 'expiresAt must be YYYY-MM-DD';
  }
  // Parse in UTC to avoid the classic "-1 day" surprise when the
  // server timezone is west of UTC.
  const d = new Date(input + 'T00:00:00Z');
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== input) {
    return 'expiresAt is not a valid calendar date';
  }
  return null;
}

// ---------------------------------------------------------------------
// Barcode helpers live in lib/barcode-lookup.js
// See docs/operations/debugging.md for the debugging runbook.
// ---------------------------------------------------------------------


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

    // -----------------------------------------------------------------
    // Kitchen: GET /api/pantry \u2014 list all pantry items for the user
    // -----------------------------------------------------------------
    if (path === 'pantry') {
      const user = getUserFromToken(request);
      if (!user) {
        return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
      }
      const items = await db.collection('pantry_items').find({ userId: user.userId });
      return withCors(NextResponse.json(items));
    }

    // -----------------------------------------------------------------
    // Kitchen: GET /api/shopping-list \u2014 list all shopping list items
    // -----------------------------------------------------------------
    if (path === 'shopping-list') {
      const user = getUserFromToken(request);
      if (!user) {
        return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
      }
      const items = await db.collection('shopping_list_items').find({ userId: user.userId });
      return withCors(NextResponse.json(items));
    }

    // -----------------------------------------------------------------
    // Kitchen: GET /api/barcode-lookup?code=<barcode>
    // -----------------------------------------------------------------
    // Fast path — walks the source chain (four Open Facts sister
    // databases + UPCitemdb trial) and returns the first hit, or
    // {found:false} if no source knows this code. All heavy lifting
    // lives in lib/barcode-lookup.js so this handler stays minimal.
    //
    // Debugging: if this returns found:false but the product genuinely
    // exists, call GET /api/barcode-diagnose?code=<code> to see per-
    // source verdicts. See docs/operations/debugging.md for a runbook.
    if (path === 'barcode-lookup') {
      const user = getUserFromToken(request);
      if (!user) {
        return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
      }
      const rawCode = url.searchParams.get('code');
      if (!rawCode || !/^\d{6,14}$/.test(rawCode)) {
        return withCors(NextResponse.json({ error: 'Invalid barcode' }, { status: 400 }));
      }
      // ?bypassCache=1 forces a cold upstream lookup, bypassing (and
      // NOT writing back to) the Supabase barcode_cache. Useful when a
      // user reports a stale-cache incident and you want to see what
      // Open Food Facts is returning right now. Requires auth so it
      // can't be used to melt our OFF quota anonymously.
      const bypassCache = url.searchParams.get('bypassCache') === '1';
      console.log(`[barcode] lookup ${rawCode}${bypassCache ? ' (bypassCache)' : ''}`);
      const result = await runLookupChain(rawCode, { bypassCache });
      return withCors(NextResponse.json(result));
    }

    // -----------------------------------------------------------------
    // Kitchen: GET /api/barcode-diagnose?code=<barcode>
    // -----------------------------------------------------------------
    // Verbose diagnostic — runs the FULL source chain (no early exit)
    // and returns a per-source breakdown so you can see which upstream
    // gave what. Useful when a user reports a scan that didn't resolve
    // even though the product exists in Open Food Facts.
    //
    // Example:
    //   curl -H "Authorization: Bearer <token>" \
    //     "https://forkcast-six.vercel.app/api/barcode-diagnose?code=4056489592068"
    //
    // Returns 200 always (never a 5xx from lookup errors). The
    // `attempts[]` array contains one entry per (variant × source)
    // combination that was queried.
    //
    // Auth: requires a logged-in session, same as barcode-lookup.
    if (path === 'barcode-diagnose') {
      const user = getUserFromToken(request);
      if (!user) {
        return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
      }
      const rawCode = url.searchParams.get('code');
      if (!rawCode || !/^\d{6,14}$/.test(rawCode)) {
        return withCors(NextResponse.json({ error: 'Invalid barcode' }, { status: 400 }));
      }
      console.log(`[barcode] diagnose ${rawCode}`);
      const result = await runDiagnosis(rawCode);
      return withCors(NextResponse.json(result));
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
        const { prompt, ingredients, dietary, cuisine, mealType, usePantry } = await request.json();
        
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

        // Kitchen integration: when usePantry is true, fold pantry
        // contents (minus expired items) into the ingredients list so
        // the LLM only proposes meals the user can actually cook now.
        let mergedIngredients = Array.isArray(ingredients) ? [...ingredients] : [];
        if (usePantry) {
          try {
            const pantry = await db.collection('pantry_items').find({ userId: user.userId });
            const today = new Date().toISOString().slice(0, 10);
            const fresh = pantry.filter(
              (p) => !p.expiresAt || p.expiresAt >= today
            );
            mergedIngredients = Array.from(new Set([
              ...mergedIngredients,
              ...fresh.map((p) => p.name),
            ]));
          } catch (pantryErr) {
            // Non-fatal: if pantry lookup fails, still generate ideas.
            console.warn('Pantry merge failed; continuing without it:', pantryErr?.message);
          }
        }

        const mealService = new MealSuggestionService(apiKey);
        const suggestions = await mealService.getMealSuggestions(prompt, {
          ingredients: mergedIngredients,
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

    // -----------------------------------------------------------------
    // Kitchen: POST /api/pantry \u2014 add a pantry item
    // -----------------------------------------------------------------
    // Body: { name, barcode?, quantity?, unit?, expiresAt? }
    if (path === 'pantry') {
      const user = getUserFromToken(request);
      if (!user) {
        return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
      }
      let body;
      try { body = await request.json(); }
      catch { return withCors(NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })); }

      const name = (body.name || '').trim();
      if (!name) {
        return withCors(NextResponse.json({ error: 'Item name is required' }, { status: 400 }));
      }
      // Strict expiry validation \u2014 accept ISO date (YYYY-MM-DD) AND
      // reject impossible calendars like "2024-13-45". We check format
      // first (cheap) then parse and round-trip through toISOString to
      // catch out-of-range days/months.
      if (body.expiresAt) {
        const err = validateIsoDate(body.expiresAt);
        if (err) return withCors(NextResponse.json({ error: err }, { status: 400 }));
      }
      const { item } = await db.collection('pantry_items').insertOne({
        userId: user.userId,
        name,
        barcode: body.barcode || null,
        quantity: body.quantity ?? null,
        unit: body.unit || null,
        expiresAt: body.expiresAt || null,
      });
      return withCors(NextResponse.json(item));
    }

    // -----------------------------------------------------------------
    // Kitchen: POST /api/shopping-list \u2014 add manual shopping list item
    // -----------------------------------------------------------------
    // Body: { name, sourceMealId? }
    if (path === 'shopping-list') {
      const user = getUserFromToken(request);
      if (!user) {
        return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
      }
      let body;
      try { body = await request.json(); }
      catch { return withCors(NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })); }

      const name = (body.name || '').trim();
      if (!name) {
        return withCors(NextResponse.json({ error: 'Item name is required' }, { status: 400 }));
      }
      const { item } = await db.collection('shopping_list_items').insertOne({
        userId: user.userId,
        name,
        sourceMealId: body.sourceMealId || null,
      });
      return withCors(NextResponse.json(item));
    }

    // -----------------------------------------------------------------
    // Kitchen: POST /api/shopping-list/generate \u2014 build shopping list
    // from the week's planned meals.
    // -----------------------------------------------------------------
    // Body: { startDate, endDate }  (ISO YYYY-MM-DD)
    // Aggregates every ingredient across all meal_plans in the range
    // whose meal belongs to this user. Duplicates (case-insensitive) are
    // de-duped and existing shopping list items are preserved.
    if (path === 'shopping-list/generate') {
      const user = getUserFromToken(request);
      if (!user) {
        return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
      }
      let body;
      try { body = await request.json(); }
      catch { return withCors(NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })); }

      const { startDate, endDate } = body;
      if (!startDate || !endDate) {
        return withCors(NextResponse.json({
          error: 'startDate and endDate are required'
        }, { status: 400 }));
      }

      const plans = await db.collection('meal_plans').find({
        userId: user.userId,
        dateRange: { start: startDate, end: endDate },
      });

      // Aggregate ingredients across every planned meal in the range.
      const nameToSource = {};
      for (const plan of plans) {
        if (!plan?.meal?.ingredients) continue;
        const lines = String(plan.meal.ingredients)
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean);
        for (const line of lines) {
          const key = line.toLowerCase();
          if (!(key in nameToSource)) nameToSource[key] = { name: line, sourceMealId: plan.meal.id };
        }
      }

      const uniqueNames = Object.values(nameToSource).map((n) => n.name);
      const sourceMap = {};
      for (const v of Object.values(nameToSource)) sourceMap[v.name] = v.sourceMealId;

      const { inserted } = await db.collection('shopping_list_items').insertMany(
        user.userId, uniqueNames, sourceMap
      );

      const items = await db.collection('shopping_list_items').find({ userId: user.userId });
      return withCors(NextResponse.json({ inserted, items }));
    }

    return withCors(NextResponse.json({ error: 'Not found' }, { status: 404 }));
    
  } catch (error) {
    console.error('POST Error:', error);
    const message = error?.message || 'Internal server error';
    // Surface database connection failures explicitly so they're easy to diagnose
    const isDbError =
      /ECONNREFUSED|MongoServerSelectionError|Missing Supabase|fetch failed|getaddrinfo|Supabase/i.test(message);
    return withCors(
      NextResponse.json(
        {
          error: isDbError
            ? 'Database is unavailable. Please contact the administrator.'
            : 'Internal server error',
          details: process.env.NODE_ENV === 'production' ? undefined : message,
        },
        { status: 500 }
      )
    );
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

      console.log(`DEBUG PUT: updateData=`, updateData);

      const result = await db.collection('meals').updateOne(
        { id: mealId, userId: user.userId },
        { $set: updateData }
      );

      console.log(`DEBUG PUT: updateOne result=`, result);
      console.log(`DEBUG PUT: matchedCount=${result.matchedCount}, modifiedCount=${result.modifiedCount}`);

      if (result.matchedCount === 0) {
        return withCors(NextResponse.json({ error: 'Meal not found' }, { status: 404 }));
      }

      const updatedMeal = await db.collection('meals').findOne({ id: mealId });
      return withCors(NextResponse.json(updatedMeal));
    }

    // -----------------------------------------------------------------
    // Kitchen: PUT /api/pantry/:id \u2014 update a pantry item
    // -----------------------------------------------------------------
    if (path.startsWith('pantry/') && path.split('/').length === 2) {
      const itemId = path.split('/')[1];
      const body = await request.json();
      // Same strict expiry validation as POST /api/pantry when the
      // field is being changed. Undefined = "don't touch it" so this
      // path is skipped for name-only or quantity-only updates.
      if (body.expiresAt !== undefined && body.expiresAt !== null) {
        const err = validateIsoDate(body.expiresAt);
        if (err) return withCors(NextResponse.json({ error: err }, { status: 400 }));
      }
      const result = await db.collection('pantry_items').updateOne(
        { id: itemId, userId: user.userId },
        { $set: body }
      );
      if (result.matchedCount === 0) {
        return withCors(NextResponse.json({ error: 'Item not found' }, { status: 404 }));
      }
      const updated = await db.collection('pantry_items').findOne({ id: itemId, userId: user.userId });
      return withCors(NextResponse.json(updated));
    }

    // -----------------------------------------------------------------
    // Kitchen: PUT /api/shopping-list/:id \u2014 toggle checked / rename
    // -----------------------------------------------------------------
    if (path.startsWith('shopping-list/') && path.split('/').length === 2) {
      const itemId = path.split('/')[1];
      const body = await request.json();
      const result = await db.collection('shopping_list_items').updateOne(
        { id: itemId, userId: user.userId },
        { $set: body }
      );
      if (result.matchedCount === 0) {
        return withCors(NextResponse.json({ error: 'Item not found' }, { status: 404 }));
      }
      const updated = await db.collection('shopping_list_items').findOne({ id: itemId, userId: user.userId });
      return withCors(NextResponse.json(updated));
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
    const url = new URL(request.url);
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

    // -----------------------------------------------------------------
    // Kitchen: DELETE /api/pantry/:id \u2014 remove a pantry item
    // -----------------------------------------------------------------
    if (path.startsWith('pantry/') && path.split('/').length === 2) {
      const itemId = path.split('/')[1];
      const result = await db.collection('pantry_items').deleteOne({
        id: itemId, userId: user.userId,
      });
      if (result.deletedCount === 0) {
        return withCors(NextResponse.json({ error: 'Item not found' }, { status: 404 }));
      }
      return withCors(NextResponse.json({ message: 'Item removed' }));
    }

    // -----------------------------------------------------------------
    // Kitchen: DELETE /api/shopping-list \u2014 clear all checked items
    //          DELETE /api/shopping-list/:id \u2014 remove single item
    // -----------------------------------------------------------------
    if (path === 'shopping-list') {
      const clearChecked = url.searchParams.get('checked') === 'true';
      const result = await db.collection('shopping_list_items').deleteOne({
        userId: user.userId,
        ...(clearChecked ? { checked: true } : {}),
      });
      return withCors(NextResponse.json({ deleted: result.deletedCount }));
    }
    if (path.startsWith('shopping-list/') && path.split('/').length === 2) {
      const itemId = path.split('/')[1];
      const result = await db.collection('shopping_list_items').deleteOne({
        id: itemId, userId: user.userId,
      });
      if (result.deletedCount === 0) {
        return withCors(NextResponse.json({ error: 'Item not found' }, { status: 404 }));
      }
      return withCors(NextResponse.json({ message: 'Item removed' }));
    }

    // -----------------------------------------------------------------
    // Kitchen: DELETE /api/barcode-cache?code=<code>
    // -----------------------------------------------------------------
    // Manual cache invalidation. Any logged-in user can nuke a bad
    // cache entry — the cache is shared, so this benefits everyone.
    // Called by the client from UnknownBarcodeDialog's "Report bad
    // data" affordance (see components/kitchen/UnknownBarcodeDialog.js)
    // and by ops from a shell one-liner. No `code` param → no-op 400
    // to prevent accidentally wiping the whole table.
    if (path === 'barcode-cache') {
      const code = url.searchParams.get('code');
      if (!code || !/^\d{6,14}$/.test(code)) {
        return withCors(NextResponse.json({ error: 'Invalid barcode' }, { status: 400 }));
      }
      await db.collection('barcode_cache').invalidate(code);
      console.log(`[barcode] cache invalidated for ${code} by user ${user.userId}`);
      return withCors(NextResponse.json({ invalidated: code }));
    }

    return withCors(NextResponse.json({ error: 'Not found' }, { status: 404 }));
    
  } catch (error) {
    console.error('DELETE Error:', error);
    return withCors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }));
  }
}