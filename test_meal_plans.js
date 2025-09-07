const { supabaseAdmin } = require('./lib/supabase-db.js');

async function testMealPlans() {
  console.log('🔍 Testing meal plans functionality...');
  
  try {
    // Test 1: Check if meal_plans table exists
    console.log('\n1. Checking meal_plans table...');
    const { data: tableData, error: tableError } = await supabaseAdmin
      .from('meal_plans')
      .select('*')
      .limit(1);
    
    if (tableError) {
      console.log('❌ Error accessing meal_plans table:', tableError.message);
      if (tableError.message.includes('relation') && tableError.message.includes('does not exist')) {
        console.log('🚨 CRITICAL: meal_plans table does not exist in Supabase!');
        console.log('📋 You need to run the SQL commands in Supabase to create the table.');
        return;
      }
    } else {
      console.log('✅ meal_plans table exists');
    }
    
    // Test 2: Count existing meal plans
    console.log('\n2. Counting existing meal plans...');
    const { count, error: countError } = await supabaseAdmin
      .from('meal_plans')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.log('❌ Error counting meal plans:', countError.message);
    } else {
      console.log(`📊 Found ${count} meal plans in database`);
    }
    
    // Test 3: Check users table
    console.log('\n3. Checking users table...');
    const { count: userCount, error: userError } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    if (userError) {
      console.log('❌ Error counting users:', userError.message);
    } else {
      console.log(`👥 Found ${userCount} users in database`);
    }
    
    // Test 4: Check meals table
    console.log('\n4. Checking meals table...');
    const { count: mealCount, error: mealError } = await supabaseAdmin
      .from('meals')
      .select('*', { count: 'exact', head: true });
    
    if (mealError) {
      console.log('❌ Error counting meals:', mealError.message);
    } else {
      console.log(`🍽️ Found ${mealCount} meals in database`);
    }
    
    // Test 5: Sample meal plans with relationships
    console.log('\n5. Testing meal plans with relationships...');
    const { data: samplePlans, error: sampleError } = await supabaseAdmin
      .from('meal_plans')
      .select(`
        *,
        meal:meals(id, title, image_url),
        user:users(id, username)
      `)
      .limit(5);
    
    if (sampleError) {
      console.log('❌ Error fetching sample meal plans:', sampleError.message);
    } else {
      console.log(`📋 Sample meal plans (${samplePlans.length}):`);
      samplePlans.forEach((plan, index) => {
        console.log(`  ${index + 1}. ${plan.date} ${plan.meal_type}: ${plan.meal?.title || 'Unknown meal'} by ${plan.user?.username || 'Unknown user'}`);
      });
    }
    
  } catch (error) {
    console.log('❌ Unexpected error:', error.message);
  }
}

testMealPlans();