-- Create meal_plans table for Forkcast application
-- This table stores the weekly meal planning calendar data

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
CREATE INDEX IF NOT EXISTS idx_meal_plans_user_date ON meal_plans(user_id, date);
CREATE INDEX IF NOT EXISTS idx_meal_plans_meal_id ON meal_plans(meal_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_date ON meal_plans(date);

-- Verify table creation
SELECT 'meal_plans table created successfully' as status;

-- Check existing data
SELECT COUNT(*) as meal_plans_count FROM meal_plans;