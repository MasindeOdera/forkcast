import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables')
}

// Server-side client with service role key (for API routes)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Simplified database interface that mimics MongoDB structure
export const db = {
  users: {
    async find(query = {}) {
      let queryBuilder = supabaseAdmin.from('users').select('*')
      
      if (query.username) {
        queryBuilder = queryBuilder.eq('username', query.username)
      }
      if (query.id) {
        queryBuilder = queryBuilder.eq('id', query.id)
      }
      
      const { data, error } = await queryBuilder
      if (error) throw error
      return data || []
    },
    
    async findOne(query) {
      const results = await this.find(query)
      return results[0] || null
    },
    
    async insertOne(user) {
      const { data, error } = await supabaseAdmin
        .from('users')
        .insert([user])
        .select()
        .single()
      
      if (error) throw error
      return { insertedId: data.id }
    }
  },
  
  meals: {
    async find(query = {}) {
      let queryBuilder = supabaseAdmin
        .from('meals')
        .select(`
          *,
          user:users(id, username)
        `)
        .order('created_at', { ascending: false })
      
      if (query.userId) {
        queryBuilder = queryBuilder.eq('user_id', query.userId)
      }
      if (query.id) {
        queryBuilder = queryBuilder.eq('id', query.id)
      }
      if (query.$or) {
        // Simple search implementation
        const searchTerm = query.$or[0].title?.$regex || ''
        if (searchTerm) {
          queryBuilder = queryBuilder.or(
            `title.ilike.%${searchTerm}%,ingredients.ilike.%${searchTerm}%,instructions.ilike.%${searchTerm}%`
          )
        }
      }
      
      const { data, error } = await queryBuilder
      if (error) throw error
      
      // Transform data to match expected format
      const transformedData = (data || []).map(meal => ({
        id: meal.id,
        userId: meal.user_id,
        title: meal.title,
        ingredients: meal.ingredients,
        instructions: meal.instructions,
        imageUrl: meal.image_url,
        galleryImages: meal.gallery_images ? JSON.parse(meal.gallery_images) : [],
        createdAt: meal.created_at,
        updatedAt: meal.updated_at,
        user: meal.user ? {
          id: meal.user.id,
          username: meal.user.username
        } : null
      }))
      
      // Return object that supports MongoDB-style chaining
      return {
        sort: () => ({
          skip: (skip) => ({
            limit: (limit) => ({
              toArray: () => transformedData.slice(skip, skip + limit)
            })
          })
        }),
        // For direct access without chaining
        length: transformedData.length,
        map: transformedData.map.bind(transformedData),
        filter: transformedData.filter.bind(transformedData),
        // Make it iterable
        [Symbol.iterator]: transformedData[Symbol.iterator].bind(transformedData)
      }
    },
    
    async findOne(query) {
      let queryBuilder = supabaseAdmin
        .from('meals')
        .select(`
          *,
          user:users(id, username)
        `)
      
      if (query.id) {
        queryBuilder = queryBuilder.eq('id', query.id)
      }
      if (query.userId) {
        queryBuilder = queryBuilder.eq('user_id', query.userId)
      }
      
      const { data, error } = await queryBuilder.single()
      if (error) {
        if (error.code === 'PGRST116') return null // Not found
        throw error
      }
      
      // Transform data
      return {
        id: data.id,
        userId: data.user_id,
        title: data.title,
        ingredients: data.ingredients,
        instructions: data.instructions,
        imageUrl: data.image_url,
        galleryImages: data.gallery_images ? JSON.parse(data.gallery_images) : [],
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        user: data.user ? {
          id: data.user.id,
          username: data.user.username
        } : null
      }
    },
    
    async insertOne(meal) {
      const mealData = {
        id: meal.id,
        user_id: meal.userId,
        title: meal.title,
        ingredients: meal.ingredients,
        instructions: meal.instructions,
        image_url: meal.imageUrl,
        gallery_images: meal.galleryImages ? JSON.stringify(meal.galleryImages) : null,
        created_at: meal.createdAt,
        updated_at: meal.updatedAt
      }
      
      const { data, error } = await supabaseAdmin
        .from('meals')
        .insert([mealData])
        .select()
        .single()
      
      if (error) throw error
      return { insertedId: data.id }
    },
    
    async updateOne(query, update) {
      console.log('DEBUG updateOne: query=', query);
      console.log('DEBUG updateOne: update=', update);
      
      const updateData = {}
      if (update.$set.title) updateData.title = update.$set.title
      if (update.$set.ingredients) updateData.ingredients = update.$set.ingredients
      if (update.$set.instructions) updateData.instructions = update.$set.instructions
      if (update.$set.imageUrl) updateData.image_url = update.$set.imageUrl
      if (update.$set.galleryImages) updateData.gallery_images = JSON.stringify(update.$set.galleryImages)
      if (update.$set.updatedAt) updateData.updated_at = update.$set.updatedAt
      
      console.log('DEBUG updateOne: updateData=', updateData);
      
      let queryBuilder = supabaseAdmin.from('meals').update(updateData)
      
      if (query.id) {
        console.log('DEBUG updateOne: Adding id filter:', query.id);
        queryBuilder = queryBuilder.eq('id', query.id)
      }
      if (query.userId) {
        console.log('DEBUG updateOne: Adding userId filter:', query.userId);
        queryBuilder = queryBuilder.eq('user_id', query.userId)
      }
      
      console.log('DEBUG updateOne: About to execute query');
      const { data, error } = await queryBuilder.select()
      console.log('DEBUG updateOne: Query result - data:', data, 'error:', error);
      
      if (error) throw error
      
      const result = {
        matchedCount: data ? data.length : 0,
        modifiedCount: data ? data.length : 0
      }
      
      console.log('DEBUG updateOne: Returning result:', result);
      return result
    },
    
    async deleteOne(query) {
      let queryBuilder = supabaseAdmin.from('meals').delete()
      
      if (query.id) queryBuilder = queryBuilder.eq('id', query.id)
      if (query.userId) queryBuilder = queryBuilder.eq('user_id', query.userId)
      
      const { data, error } = await queryBuilder.select()
      if (error) throw error
      
      return { deletedCount: data ? data.length : 0 }
    }
  },
  
  meal_plans: {
    async find(query = {}) {
      let queryBuilder = supabaseAdmin.from('meal_plans').select(`
        *,
        meal:meals(id, title, image_url, ingredients, instructions),
        user:users(id, username)
      `);
      
      if (query.userId) {
        queryBuilder = queryBuilder.eq('user_id', query.userId);
      }
      if (query.date) {
        queryBuilder = queryBuilder.eq('date', query.date);
      }
      if (query.dateRange) {
        queryBuilder = queryBuilder
          .gte('date', query.dateRange.start)
          .lte('date', query.dateRange.end);
      }
      
      queryBuilder = queryBuilder.order('date', { ascending: true });
      
      const { data, error } = await queryBuilder;
      if (error) throw error;
      
      return (data || []).map(plan => ({
        id: plan.id,
        userId: plan.user_id,
        date: plan.date,
        mealType: plan.meal_type,
        mealId: plan.meal_id,
        meal: plan.meal ? {
          id: plan.meal.id,
          title: plan.meal.title,
          imageUrl: plan.meal.image_url,
          ingredients: plan.meal.ingredients,
          instructions: plan.meal.instructions
        } : null,
        user: plan.user ? {
          id: plan.user.id,
          username: plan.user.username
        } : null,
        createdAt: plan.created_at
      }));
    },
    
    async findOne(query) {
      const results = await this.find(query);
      return results[0] || null;
    },
    
    async insertOne(mealPlan) {
      const planData = {
        user_id: mealPlan.userId,
        date: mealPlan.date,
        meal_type: mealPlan.mealType,
        meal_id: mealPlan.mealId
      };
      
      const { data, error } = await supabaseAdmin
        .from('meal_plans')
        .upsert([planData])
        .select()
        .single();
      
      if (error) throw error;
      return { insertedId: data.id };
    },
    
    async deleteOne(query) {
      let queryBuilder = supabaseAdmin.from('meal_plans').delete();
      
      if (query.userId) queryBuilder = queryBuilder.eq('user_id', query.userId);
      if (query.date) queryBuilder = queryBuilder.eq('date', query.date);
      if (query.mealType) queryBuilder = queryBuilder.eq('meal_type', query.mealType);
      
      const { error, count } = await queryBuilder;
      if (error) throw error;
      
      return { deletedCount: count || 0 };
    }
  }
}

export async function connectToDatabase() {
  // Ensure tables exist
  await initializeTables()
  
  return {
    db: {
      collection: (name) => db[name]
    }
  }
}

export async function initializeTables() {
  try {
    // This is handled by Supabase migrations in the dashboard
    console.log('Supabase tables should be created via SQL in dashboard')
  } catch (error) {
    console.error('Error with Supabase setup:', error)
  }
}

console.log('Supabase database client initialized')