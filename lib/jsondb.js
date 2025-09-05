// Simple JSON file database for development/testing
// In production, you can easily migrate to a real database later

let users = [];
let meals = [];

// Simple in-memory database with persistence simulation
export const db = {
  users: {
    async find(query = {}) {
      if (query.username) {
        return users.filter(user => user.username === query.username);
      }
      if (query.id) {
        return users.filter(user => user.id === query.id);
      }
      return users;
    },
    
    async findOne(query) {
      const results = await this.find(query);
      return results[0] || null;
    },
    
    async insertOne(user) {
      users.push(user);
      return { insertedId: user.id };
    }
  },
  
  meals: {
    async find(query = {}) {
      let results = meals;
      
      if (query.userId) {
        results = results.filter(meal => meal.userId === query.userId);
      }
      
      if (query.id) {
        results = results.filter(meal => meal.id === query.id);
      }
      
      if (query.$or) {
        // Simple search implementation
        const searchTerm = query.$or[0].title?.$regex || '';
        results = results.filter(meal => 
          meal.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          meal.ingredients.toLowerCase().includes(searchTerm.toLowerCase()) ||
          meal.instructions.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
      
      return {
        sort: (sortOptions) => ({
          skip: (skip) => ({
            limit: (limit) => ({
              toArray: () => {
                let sorted = [...results];
                
                // Sort by createdAt desc (most recent first)
                if (sortOptions.createdAt === -1) {
                  sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                }
                
                // Apply skip and limit
                return sorted.slice(skip, skip + limit);
              }
            })
          })
        })
      };
    },
    
    async findOne(query) {
      let results = meals;
      
      if (query.id) {
        results = results.filter(meal => meal.id === query.id);
      }
      
      if (query.userId) {
        results = results.filter(meal => meal.userId === query.userId);
      }
      
      return results[0] || null;
    },
    
    async insertOne(meal) {
      meals.push(meal);
      return { insertedId: meal.id };
    },
    
    async updateOne(query, update) {
      const mealIndex = meals.findIndex(meal => 
        meal.id === query.id && meal.userId === query.userId
      );
      
      if (mealIndex !== -1) {
        meals[mealIndex] = { ...meals[mealIndex], ...update.$set };
        return { matchedCount: 1, modifiedCount: 1 };
      }
      
      return { matchedCount: 0, modifiedCount: 0 };
    },
    
    async deleteOne(query) {
      const mealIndex = meals.findIndex(meal => 
        meal.id === query.id && meal.userId === query.userId
      );
      
      if (mealIndex !== -1) {
        meals.splice(mealIndex, 1);
        return { deletedCount: 1 };
      }
      
      return { deletedCount: 0 };
    }
  }
};

export async function connectToDatabase() {
  // Simulate database connection
  return { 
    db: {
      collection: (name) => db[name]
    }
  };
}

// Add some sample data for testing
users.push({
  id: 'sample-user-1',
  username: 'demo',
  password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeblUcYbhyL4K5Qhm', // "password123"
  createdAt: new Date()
});

meals.push({
  id: 'sample-meal-1',
  userId: 'sample-user-1',
  title: 'Demo Spaghetti Carbonara',
  ingredients: `400g spaghetti
200g pancetta or guanciale
4 large eggs
100g Pecorino Romano cheese
Black pepper to taste
Salt for pasta water`,
  instructions: `1. Boil salted water and cook spaghetti according to package directions
2. While pasta cooks, dice pancetta and cook in a large pan until crispy
3. In a bowl, whisk together eggs, grated cheese, and black pepper
4. Reserve 1 cup pasta water before draining
5. Add hot pasta to the pan with pancetta
6. Remove from heat and quickly mix in egg mixture
7. Add pasta water gradually until creamy
8. Serve immediately with extra cheese and pepper`,
  imageUrl: null,
  createdAt: new Date(),
  updatedAt: new Date()
});

console.log('JSON Database initialized with sample data');