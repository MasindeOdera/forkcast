import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Lazy admin client. We DO NOT throw at module load because that would
// break the Next.js build (route collection / SSG) when env vars aren't
// present at build time (e.g., during the Emergent build pipeline).
// The error is instead surfaced at request time when the client is used.
let _supabaseAdmin = null
function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error(
        'Missing Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY). ' +
        'Set them in the deployment secrets manager.'
      )
    }
    _supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }
  return _supabaseAdmin
}

// Backwards-compat export – proxy so calls like `supabaseAdmin.from(...)`
// still work but only initialise on first use.
export const supabaseAdmin = new Proxy(
  {},
  {
    get(_target, prop) {
      const client = getSupabaseAdmin()
      const value = client[prop]
      return typeof value === 'function' ? value.bind(client) : value
    },
  }
)

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
      const updateData = {}
      if (update.$set.title) updateData.title = update.$set.title
      if (update.$set.ingredients) updateData.ingredients = update.$set.ingredients
      if (update.$set.instructions) updateData.instructions = update.$set.instructions
      if (update.$set.imageUrl) updateData.image_url = update.$set.imageUrl
      if (update.$set.galleryImages) updateData.gallery_images = JSON.stringify(update.$set.galleryImages)
      if (update.$set.updatedAt) updateData.updated_at = update.$set.updatedAt
      
      let queryBuilder = supabaseAdmin.from('meals').update(updateData)
      
      if (query.id) queryBuilder = queryBuilder.eq('id', query.id)
      if (query.userId) queryBuilder = queryBuilder.eq('user_id', query.userId)
      
      const { data, error } = await queryBuilder.select()
      if (error) throw error
      
      return {
        matchedCount: data ? data.length : 0,
        modifiedCount: data ? data.length : 0
      }
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
  },

  // ---------------------------------------------------------------------
  // pantry_items \u2014 Kitchen feature (see docs/features/kitchen.md)
  // ---------------------------------------------------------------------
  // Snake_case columns in Postgres, camelCase in the API layer. All rows
  // are scoped by user_id at the query level (defence in depth on top of
  // RLS \u2014 the server uses service_role which bypasses RLS).
  pantry_items: {
    async find(query = {}) {
      let qb = supabaseAdmin
        .from('pantry_items')
        .select('*')
        .order('added_at', { ascending: false });

      if (query.userId) qb = qb.eq('user_id', query.userId);
      if (query.id)     qb = qb.eq('id', query.id);
      if (query.barcode) qb = qb.eq('barcode', query.barcode);

      const { data, error } = await qb;
      if (error) throw error;

      return (data || []).map((row) => ({
        id: row.id,
        userId: row.user_id,
        name: row.name,
        barcode: row.barcode,
        quantity: row.quantity,
        unit: row.unit,
        expiresAt: row.expires_at,
        addedAt: row.added_at,
      }));
    },

    async findOne(query) {
      const rows = await this.find(query);
      return rows[0] || null;
    },

    async insertOne(item) {
      const row = {
        user_id: item.userId,
        name: item.name,
        barcode: item.barcode || null,
        quantity: item.quantity ?? null,
        unit: item.unit || null,
        expires_at: item.expiresAt || null,
      };
      const { data, error } = await supabaseAdmin
        .from('pantry_items')
        .insert([row])
        .select()
        .single();
      if (error) throw error;
      return { insertedId: data.id, item: {
        id: data.id,
        userId: data.user_id,
        name: data.name,
        barcode: data.barcode,
        quantity: data.quantity,
        unit: data.unit,
        expiresAt: data.expires_at,
        addedAt: data.added_at,
      } };
    },

    async updateOne(query, update) {
      const patch = {};
      const set = update.$set || update;
      if (set.name !== undefined)      patch.name       = set.name;
      if (set.barcode !== undefined)   patch.barcode    = set.barcode;
      if (set.quantity !== undefined)  patch.quantity   = set.quantity;
      if (set.unit !== undefined)      patch.unit       = set.unit;
      if (set.expiresAt !== undefined) patch.expires_at = set.expiresAt;

      let qb = supabaseAdmin.from('pantry_items').update(patch);
      if (query.id)     qb = qb.eq('id', query.id);
      if (query.userId) qb = qb.eq('user_id', query.userId);

      const { data, error } = await qb.select();
      if (error) throw error;
      return {
        matchedCount:  data ? data.length : 0,
        modifiedCount: data ? data.length : 0,
      };
    },

    async deleteOne(query) {
      let qb = supabaseAdmin.from('pantry_items').delete();
      if (query.id)     qb = qb.eq('id', query.id);
      if (query.userId) qb = qb.eq('user_id', query.userId);
      const { data, error } = await qb.select();
      if (error) throw error;
      return { deletedCount: data ? data.length : 0 };
    },
  },

  // ---------------------------------------------------------------------
  // shopping_list_items \u2014 Kitchen feature
  // ---------------------------------------------------------------------
  // Rows are always fetched sorted by (checked asc, added_at asc) so the
  // unchecked items float to the top of the list.
  shopping_list_items: {
    async find(query = {}) {
      let qb = supabaseAdmin
        .from('shopping_list_items')
        .select('*')
        .order('checked', { ascending: true })
        .order('added_at', { ascending: true });

      if (query.userId)  qb = qb.eq('user_id', query.userId);
      if (query.id)      qb = qb.eq('id', query.id);
      if (query.checked !== undefined) qb = qb.eq('checked', query.checked);

      const { data, error } = await qb;
      if (error) throw error;

      return (data || []).map((row) => ({
        id: row.id,
        userId: row.user_id,
        name: row.name,
        checked: row.checked,
        sourceMealId: row.source_meal_id,
        addedAt: row.added_at,
      }));
    },

    async findOne(query) {
      const rows = await this.find(query);
      return rows[0] || null;
    },

    async insertOne(item) {
      const row = {
        user_id:        item.userId,
        name:           item.name,
        checked:        item.checked ?? false,
        source_meal_id: item.sourceMealId || null,
      };
      const { data, error } = await supabaseAdmin
        .from('shopping_list_items')
        .insert([row])
        .select()
        .single();
      if (error) throw error;
      return { insertedId: data.id, item: {
        id: data.id,
        userId: data.user_id,
        name: data.name,
        checked: data.checked,
        sourceMealId: data.source_meal_id,
        addedAt: data.added_at,
      } };
    },

    // Bulk-insert used by /shopping-list/generate. Skips items whose name
    // already exists (case-insensitive) for that user so re-generating
    // the list doesn't create duplicates.
    async insertMany(userId, names, sourceMealIds = {}) {
      if (!names?.length) return { inserted: 0 };
      const existing = await this.find({ userId });
      const existingNames = new Set(
        existing.map((i) => i.name.trim().toLowerCase())
      );
      const rows = names
        .filter((n) => n && !existingNames.has(n.trim().toLowerCase()))
        .map((n) => ({
          user_id: userId,
          name: n.trim(),
          checked: false,
          source_meal_id: sourceMealIds[n] || null,
        }));
      if (!rows.length) return { inserted: 0 };
      const { error } = await supabaseAdmin.from('shopping_list_items').insert(rows);
      if (error) throw error;
      return { inserted: rows.length };
    },

    async updateOne(query, update) {
      const patch = {};
      const set = update.$set || update;
      if (set.name !== undefined)    patch.name    = set.name;
      if (set.checked !== undefined) patch.checked = set.checked;

      let qb = supabaseAdmin.from('shopping_list_items').update(patch);
      if (query.id)     qb = qb.eq('id', query.id);
      if (query.userId) qb = qb.eq('user_id', query.userId);

      const { data, error } = await qb.select();
      if (error) throw error;
      return {
        matchedCount:  data ? data.length : 0,
        modifiedCount: data ? data.length : 0,
      };
    },

    async deleteOne(query) {
      let qb = supabaseAdmin.from('shopping_list_items').delete();
      if (query.id)      qb = qb.eq('id', query.id);
      if (query.userId)  qb = qb.eq('user_id', query.userId);
      if (query.checked !== undefined) qb = qb.eq('checked', query.checked);
      const { data, error } = await qb.select();
      if (error) throw error;
      return { deletedCount: data ? data.length : 0 };
    },
  },

  // ---------------------------------------------------------------------
  // barcode_cache — Kitchen feature (server-side barcode → product cache)
  // ---------------------------------------------------------------------
  // Shared, cross-user cache backing lib/barcode-lookup.js. Motivation:
  // Open Food Facts frequently rate-limits Vercel's shared outbound IP,
  // so cold-path scans that "work in tests" (from developer machines)
  // fail in production. Once ANY user has scanned a code we remember
  // the result globally — repeat scans return in ~30ms without ever
  // touching OFF.
  //
  // Rows expire (soft-TTL via `expires_at` column). Callers should
  // filter on `expires_at > now()` — that's `getFresh` below. Stale
  // rows are periodically DELETE-swept but a stale read is also just
  // fine as a "treat as miss" signal.
  //
  // See db/migrations/003_barcode_cache.sql for the schema.
  barcode_cache: {
    /**
     * Return a non-stale cached lookup for `code`, or null. Never
     * throws — a Supabase outage just means we fall through to the
     * upstream chain, which is exactly what we want.
     */
    async getFresh(code) {
      try {
        const { data, error } = await supabaseAdmin
          .from('barcode_cache')
          .select('*')
          .eq('code', code)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle();
        if (error) {
          // PGRST116 = no rows, everything else logged and swallowed.
          if (error.code !== 'PGRST116') {
            console.warn('[barcode_cache] getFresh error:', error.message);
          }
          return null;
        }
        return data || null;
      } catch (err) {
        console.warn('[barcode_cache] getFresh threw:', err?.message || err);
        return null;
      }
    },

    /**
     * Upsert a cache row. `expiresAt` is a Date. Best-effort — never
     * throws (a write failure just means the next scan re-queries OFF).
     */
    async upsert(row) {
      try {
        const payload = {
          code:       row.code,
          found:      !!row.found,
          name:       row.name || null,
          brand:      row.brand || null,
          image:      row.image || null,
          quantity:   row.quantity || null,
          source:     row.source || 'none',
          expires_at: row.expiresAt instanceof Date ? row.expiresAt.toISOString() : row.expiresAt,
        };
        const { error } = await supabaseAdmin
          .from('barcode_cache')
          .upsert([payload], { onConflict: 'code' });
        if (error) console.warn('[barcode_cache] upsert error:', error.message);
      } catch (err) {
        console.warn('[barcode_cache] upsert threw:', err?.message || err);
      }
    },

    /**
     * Delete a cached entry (e.g. when a user reports bad data).
     * Best-effort.
     */
    async invalidate(code) {
      try {
        const { error } = await supabaseAdmin
          .from('barcode_cache')
          .delete()
          .eq('code', code);
        if (error) console.warn('[barcode_cache] invalidate error:', error.message);
      } catch (err) {
        console.warn('[barcode_cache] invalidate threw:', err?.message || err);
      }
    },
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